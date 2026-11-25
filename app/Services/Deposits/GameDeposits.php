<?php

namespace App\Services\Deposits;

use App\Models\GameDeposit;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Wallet\WalletService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;

/**
 * Shared bits of the in-game deposit system: the receipt parser, the bot's IGN,
 * and the one place coins are actually credited.
 *
 * The bot relays "<player> paid you $1.5m"; this class re-parses that line so a
 * compromised or buggy bridge cannot invent amounts, and the credit is written
 * with an idempotent ledger key so retries never pay twice.
 */
class GameDeposits
{
    /** "youri67 paid you $1.5m" / "youri67 sent you 250,000" */
    private const PATTERN = '/(?<![A-Za-z0-9_])([A-Za-z0-9_]{3,16})\s+(?:paid|sent)\s+you\s+\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kKmMbB])?/iu';

    public function __construct(private readonly WalletService $wallet) {}

    /** The account players pay: configured, or learned from the bot's own login. */
    public function botIgn(): ?string
    {
        $configured = trim((string) config('casino.deposit.bot_ign'));
        if ($configured !== '') {
            return $configured;
        }

        $learned = Cache::get('mc:deposit:bot');

        return is_string($learned) && $learned !== '' ? $learned : null;
    }

    /** With no MC_DEPOSIT_BOT_IGN set, trust the first name a signed bot reports. */
    public function rememberBot(string $ign): void
    {
        if (trim((string) config('casino.deposit.bot_ign')) !== '') {
            return;
        }

        if (preg_match('/^[A-Za-z0-9_]{3,16}$/', $ign)) {
            Cache::put('mc:deposit:bot', $ign, now()->addDays(30));
        }
    }

    /** @return array{player: string, game_amount: int, raw: string}|null */
    public function parse(string $text): ?array
    {
        $clean = trim((string) preg_replace(['/§./u', '/\s+/u'], ['', ' '], $text));

        if (! preg_match(self::PATTERN, $clean, $m)) {
            return null;
        }

        $value = (float) str_replace(',', '', $m[2]);
        $multiplier = match (strtolower($m[3] ?? '')) {
            'k' => 1_000,
            'm' => 1_000_000,
            'b' => 1_000_000_000,
            default => 1,
        };

        $amount = (int) round($value * $multiplier);

        if ($amount < 1) {
            return null;
        }

        return ['player' => strtolower($m[1]), 'game_amount' => $amount, 'raw' => mb_substr($clean, 0, 300)];
    }

    /** in-game dollars → site coins (minor units, 100 per coin) */
    public function coinsFor(int $gameAmount): int
    {
        return intdiv($gameAmount * (int) config('casino.deposit.coins_per_million') * 100, 1_000_000);
    }

    /**
     * Credits a matched payment. Safe to call twice with the same event id: the
     * ledger key and the wallet reference are both derived from it.
     */
    public function credit(User $user, int $coins, int $gameAmount, string $raw, string $eventId): GameDeposit
    {
        $key = hash('sha256', 'bot:'.$eventId);

        try {
            $deposit = GameDeposit::create([
                'tx_key' => $key,
                'player' => (string) $user->minecraft_username,
                'user_id' => $user->id,
                'status' => 'credited',
                'raw' => mb_substr($raw, 0, 300),
                'game_amount' => $gameAmount,
                'coins' => $coins,
                'seen_at' => now(),
            ]);
        } catch (QueryException) {
            // Already written by an earlier attempt of the same event.
            return GameDeposit::query()->where('tx_key', $key)->firstOrFail();
        }

        $this->wallet->credit($user, $coins, WalletTransaction::DEPOSIT, 'mc-deposit-'.$eventId);

        return $deposit;
    }
}
