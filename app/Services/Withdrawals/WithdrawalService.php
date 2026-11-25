<?php

namespace App\Services\Withdrawals;

use App\Models\GameDeposit;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Models\Withdrawal;
use App\Services\Deposits\BotDeposits;
use App\Services\Deposits\GameDeposits;
use App\Services\Wallet\WalletService;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The server-authoritative half of coin → in-game payouts.
 *
 * Safety rules:
 *  - coins are debited before the request enters the queue;
 *  - only one payout is in flight globally, and a claim is marked `sending`
 *    before the bot is allowed to type /pay;
 *  - a crashed bridge never causes an automatic retry (a `sending` row blocks
 *    new claims until it is resolved by hand);
 *  - total payouts can never exceed the in-game money the bot actually
 *    received, so the site cannot promise more than the bot can pay.
 */
class WithdrawalService
{
    public const STATUSES = ['pending', 'sending', 'paid', 'failed', 'unconfirmed'];

    public function __construct(
        private readonly WalletService $wallet,
        private readonly GameDeposits $deposits,
        private readonly BotDeposits $bot,
    ) {}

    /** In-game money the bot should currently hold. */
    public function availableFloat(): int
    {
        $deposited = (int) GameDeposit::query()
            ->where('status', 'credited')
            ->sum('game_amount');

        $committed = Withdrawal::query()
            ->whereIn('status', ['pending', 'sending', 'paid', 'unconfirmed'])
            ->get()
            ->sum(fn (Withdrawal $w) => (int) $w->game_amount + $this->taxFor((int) $w->game_amount, (int) $w->tax));

        return max(0, $deposited - $committed);
    }

    /** DonutSMP's /pay tax, or the exact tax parsed from a receipt. */
    public function taxFor(int $gameAmount, ?int $known = null): int
    {
        if ($known !== null && $known > 0) {
            return $known;
        }

        $bps = max(0, (int) config('casino.withdraw.tax_bps'));

        return $bps > 0 ? intdiv($gameAmount * $bps + 9_999, 10_000) : 0;
    }

    /** Site coins → in-game money at the deposit rate. */
    public function gameForCoins(int $coins): int
    {
        $rate = (int) config('casino.deposit.coins_per_million') * 100;

        return $rate > 0 ? intdiv($coins * 1_000_000, $rate) : 0;
    }

    /** What this user can request right now, in in-game money. */
    public function availableFor(User $user): int
    {
        return max(0, min(
            $this->maxPrincipal($this->availableFloat()),
            $this->gameForCoins((int) $user->balance),
            (int) config('casino.withdraw.max_game'),
        ));
    }

    /** Largest principal whose principal + server tax fits inside the float. */
    private function maxPrincipal(int $float): int
    {
        $bps = max(0, (int) config('casino.withdraw.tax_bps'));

        if ($bps === 0) {
            return max(0, $float);
        }

        $principal = intdiv(max(0, $float) * 10_000, 10_000 + $bps);

        while ($principal > 0 && $principal + $this->taxFor($principal) > $float) {
            $principal--;
        }

        return max(0, $principal);
    }

    /**
     * @return array{ok: bool, error?: string, withdrawal?: array<string, mixed>, min?: int, max?: int, daily?: int, used?: int, available?: int}
     */
    public function create(User $user, int $gameAmount): array
    {
        if (! (bool) config('casino.withdraw.enabled')) {
            return ['ok' => false, 'error' => 'disabled'];
        }

        if (! $this->bot->verified($user)) {
            return ['ok' => false, 'error' => 'not_linked'];
        }

        $min = (int) config('casino.withdraw.min_game');
        $max = (int) config('casino.withdraw.max_game');

        if ($gameAmount < $min || $gameAmount > $max) {
            return ['ok' => false, 'error' => 'amount_out_of_range', 'min' => $min, 'max' => $max];
        }

        $coins = $this->deposits->coinsFor($gameAmount);
        $tax = $this->taxFor($gameAmount);

        if ($coins < 1) {
            return ['ok' => false, 'error' => 'amount_too_small'];
        }

        $this->expireStale();

        try {
            return Cache::lock('mc:withdraw:create', 10)->block(5, function () use ($user, $gameAmount, $tax, $coins) {
                return DB::transaction(function () use ($user, $gameAmount, $tax, $coins) {
                    /** @var User $locked */
                    $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

                    if ($locked->balance < $coins) {
                        return ['ok' => false, 'error' => 'insufficient_balance'];
                    }

                    $open = Withdrawal::query()
                        ->where('user_id', $locked->id)
                        ->whereIn('status', ['pending', 'sending', 'unconfirmed'])
                        ->count();

                    if ($open >= (int) config('casino.withdraw.max_pending')) {
                        return ['ok' => false, 'error' => 'too_many_pending'];
                    }

                    $daily = (int) config('casino.withdraw.daily_game');
                    $used = (int) Withdrawal::query()
                        ->where('user_id', $locked->id)
                        ->where('created_at', '>=', now()->startOfDay())
                        ->whereIn('status', ['pending', 'sending', 'paid', 'unconfirmed'])
                        ->sum('game_amount');

                    if ($used + $gameAmount > $daily) {
                        return ['ok' => false, 'error' => 'daily_limit', 'daily' => $daily, 'used' => $used];
                    }

                    $available = $this->availableFloat();

                    if ($available < $gameAmount + $tax) {
                        return ['ok' => false, 'error' => 'float_low', 'available' => $available];
                    }

                    $withdrawal = Withdrawal::create([
                        'user_id' => $locked->id,
                        'player' => strtolower((string) $locked->minecraft_username),
                        'game_amount' => $gameAmount,
                        'tax' => $tax,
                        'coins' => $coins,
                        'status' => 'pending',
                    ]);

                    try {
                        $this->wallet->debit($locked, $coins, WalletTransaction::WITHDRAWAL, 'mc-withdraw-'.$withdrawal->id);
                    } catch (InvalidArgumentException) {
                        // The outer transaction rolls the row back; report it as
                        // a normal insufficient-balance response.
                        throw new InvalidArgumentException('insufficient balance');
                    }

                    return ['ok' => true, 'withdrawal' => $this->present($withdrawal)];
                });
            });
        } catch (InvalidArgumentException) {
            return ['ok' => false, 'error' => 'insufficient_balance'];
        } catch (LockTimeoutException) {
            return ['ok' => false, 'error' => 'busy'];
        }
    }

    /**
     * Claims the oldest queued payout for the bot. The same event id returns
     * the same withdrawal, so a lost HTTP response cannot claim a second one.
     *
     * @return array{withdrawal: array<string, mixed>|null, busy?: bool}
     */
    public function claim(string $eventId): array
    {
        $this->expireStale();

        try {
            return Cache::lock('mc:withdraw:claim', 10)->block(3, function () use ($eventId) {
                return DB::transaction(function () use ($eventId) {
                    $seen = DB::table('bot_events')->where('event_id', $eventId)->exists();

                    if ($seen) {
                        $same = Withdrawal::query()->where('claim_event_id', $eventId)->first();

                        return ['withdrawal' => $same ? $this->presentForBot($same) : null];
                    }

                    if (Withdrawal::query()->where('status', 'sending')->exists()) {
                        return ['withdrawal' => null, 'busy' => true];
                    }

                    // Idle polls must not fill bot_events with one row every 5s.
                    if (! Withdrawal::query()->where('status', 'pending')->exists()) {
                        return ['withdrawal' => null];
                    }

                    DB::table('bot_events')->insert([
                        'event_id' => $eventId,
                        'kind' => 'withdraw-claim',
                        'created_at' => now(),
                    ]);

                    /** @var Withdrawal|null $withdrawal */
                    $withdrawal = Withdrawal::query()
                        ->where('status', 'pending')
                        ->orderBy('id')
                        ->lockForUpdate()
                        ->first();

                    if ($withdrawal === null || $withdrawal->status !== 'pending') {
                        return ['withdrawal' => null];
                    }

                    $withdrawal->forceFill([
                        'status' => 'sending',
                        'claimed_at' => now(),
                        'claim_event_id' => $eventId,
                    ])->save();

                    return ['withdrawal' => $this->presentForBot($withdrawal)];
                });
            });
        } catch (LockTimeoutException) {
            return ['withdrawal' => null, 'busy' => true];
        }
    }

    /**
     * @return array{status: string, duplicate?: bool, ignored?: bool}
     */
    public function result(int $id, string $status, ?string $receipt, ?string $reason): array
    {
        if (! in_array($status, ['paid', 'failed', 'unconfirmed'], true)) {
            return ['status' => 'invalid'];
        }

        return DB::transaction(function () use ($id, $status, $receipt, $reason) {
            /** @var Withdrawal|null $withdrawal */
            $withdrawal = Withdrawal::query()->whereKey($id)->lockForUpdate()->first();

            if ($withdrawal === null) {
                return ['status' => 'not_found'];
            }

            if ($withdrawal->status !== 'sending') {
                return [
                    'status' => $withdrawal->status,
                    'duplicate' => $withdrawal->status === $status,
                    'ignored' => $withdrawal->status !== $status,
                ];
            }

            $note = $reason !== null ? mb_substr(trim($reason), 0, 160) : null;
            $line = $receipt !== null ? mb_substr(trim($receipt), 0, 300) : null;

            if ($status === 'paid') {
                // A bridge bug must not be able to mark a payout paid on a
                // receipt for a different player or amount.
                if ($line === null || ! $this->receiptMatches($line, (string) $withdrawal->player, (int) $withdrawal->game_amount)) {
                    return ['status' => 'invalid_receipt'];
                }

                $actualTax = $this->taxFromReceipt($line);

                $withdrawal->forceFill([
                    'status' => 'paid',
                    'tax' => $actualTax ?? $withdrawal->tax,
                    'receipt' => $line,
                    'reason' => $note,
                    'completed_at' => now(),
                ])->save();

                return ['status' => 'paid'];
            }

            if ($status === 'failed') {
                $withdrawal->forceFill([
                    'status' => 'failed',
                    'reason' => $note ?? 'bot could not pay',
                    'receipt' => $line,
                    'completed_at' => now(),
                ])->save();

                $user = User::query()->find($withdrawal->user_id);

                if ($user !== null) {
                    $this->wallet->credit(
                        $user,
                        (int) $withdrawal->coins,
                        WalletTransaction::WITHDRAWAL_REFUND,
                        'mc-withdraw-refund-'.$withdrawal->id,
                    );
                }

                return ['status' => 'failed'];
            }

            // Ambiguous: the command may have gone through. Keep the coins and
            // the float reserved; never retry automatically.
            $withdrawal->forceFill([
                'status' => 'unconfirmed',
                'reason' => $note ?? 'no confirmation from the server',
                'receipt' => $line,
                'completed_at' => now(),
            ])->save();

            return ['status' => 'unconfirmed'];
        });
    }

    /** @return array{ok: bool, error?: string} */
    public function cancel(User $user, int $id): array
    {
        return DB::transaction(function () use ($user, $id) {
            /** @var Withdrawal|null $withdrawal */
            $withdrawal = Withdrawal::query()
                ->whereKey($id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($withdrawal === null) {
                return ['ok' => false, 'error' => 'not_found'];
            }

            if ($withdrawal->status !== 'pending') {
                return ['ok' => false, 'error' => 'not_pending'];
            }

            $withdrawal->forceFill([
                'status' => 'failed',
                'reason' => 'cancelled',
                'completed_at' => now(),
            ])->save();

            $this->wallet->credit(
                $user,
                (int) $withdrawal->coins,
                WalletTransaction::WITHDRAWAL_REFUND,
                'mc-withdraw-refund-'.$withdrawal->id,
            );

            return ['ok' => true];
        });
    }

    /** Refunds pending requests the bot never claimed. Never touches sending. */
    public function expireStale(): void
    {
        $minutes = (int) config('casino.withdraw.pending_ttl_minutes');

        if ($minutes < 1) {
            return;
        }

        $stale = Withdrawal::query()
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($minutes))
            ->orderBy('id')
            ->limit(25)
            ->get();

        foreach ($stale as $candidate) {
            DB::transaction(function () use ($candidate) {
                /** @var Withdrawal|null $withdrawal */
                $withdrawal = Withdrawal::query()->whereKey($candidate->id)->lockForUpdate()->first();

                if ($withdrawal === null || $withdrawal->status !== 'pending') {
                    return;
                }

                $withdrawal->forceFill([
                    'status' => 'failed',
                    'reason' => 'expired',
                    'completed_at' => now(),
                ])->save();

                $user = User::query()->find($withdrawal->user_id);

                if ($user !== null) {
                    $this->wallet->credit(
                        $user,
                        (int) $withdrawal->coins,
                        WalletTransaction::WITHDRAWAL_REFUND,
                        'mc-withdraw-refund-'.$withdrawal->id,
                    );
                }
            });
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function pending(int $userId): array
    {
        return Withdrawal::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['pending', 'sending', 'unconfirmed'])
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->map(fn (Withdrawal $w) => $this->present($w))
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    public function recent(int $userId): array
    {
        return Withdrawal::query()
            ->where('user_id', $userId)
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (Withdrawal $w) => $this->present($w))
            ->all();
    }

    /** @return array<string, mixed> */
    public function present(Withdrawal $withdrawal): array
    {
        return [
            'id' => $withdrawal->id,
            'game_amount' => (int) $withdrawal->game_amount,
            'tax' => (int) $withdrawal->tax,
            'coins' => (int) $withdrawal->coins,
            'status' => $withdrawal->status,
            'reason' => $withdrawal->reason,
            'at' => $withdrawal->created_at?->toIso8601String(),
            'completed_at' => $withdrawal->completed_at?->toIso8601String(),
        ];
    }

    /** "You paid Name $10K (+$200 tax)" must name this player and amount. */
    private function receiptMatches(string $receipt, string $player, int $gameAmount): bool
    {
        if (! preg_match('/(?:\byou\s+(?:have\s+)?paid|\bpaid)\s+([A-Za-z0-9_]{3,16})\s+\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMB]?)/i', $receipt, $m)) {
            return false;
        }

        if (strcasecmp($m[1], $player) !== 0) {
            return false;
        }

        $multiplier = match (strtoupper($m[3] ?? '')) {
            'K' => 1_000,
            'M' => 1_000_000,
            'B' => 1_000_000_000,
            default => 1,
        };

        return (int) round((float) str_replace(',', '', $m[2]) * $multiplier) === $gameAmount;
    }

    /** "You paid Name $10K (+$200 tax)" → 200. */
    private function taxFromReceipt(string $receipt): ?int
    {
        if (! preg_match('/\(\s*\+\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMB]?)\s*tax\s*\)/i', $receipt, $m)) {
            return null;
        }

        $multiplier = match (strtoupper($m[2] ?? '')) {
            'K' => 1_000,
            'M' => 1_000_000,
            'B' => 1_000_000_000,
            default => 1,
        };

        return max(0, (int) round((float) str_replace(',', '', $m[1]) * $multiplier));
    }

    /** @return array{id: int, player: string, game_amount: int, coins: int} */
    private function presentForBot(Withdrawal $withdrawal): array
    {
        return [
            'id' => (int) $withdrawal->id,
            'player' => (string) $withdrawal->player,
            'game_amount' => (int) $withdrawal->game_amount,
            'coins' => (int) $withdrawal->coins,
        ];
    }
}
