<?php

namespace App\Services\Deposits;

use App\Models\BotEvent;
use App\Models\DepositRequest;
use App\Models\LinkCode;
use App\Models\UnmatchedPayment;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * The player-facing half of the bot deposit system.
 *
 * Linking: the site shows an 8-character code, the player whispers it to the
 * bot in game, the bot reports it back signed, and the IGN is bound to the
 * account. Deposits: the player says "I am sending 500m", that becomes a pending
 * request, and only a receipt for that player and exactly that amount credits —
 * anything else is parked in unmatched payments for a human.
 */
class BotDeposits
{
    public const LINK_TTL_MINUTES = 10;

    public const REQUEST_TTL_MINUTES = 15;

    public const MAX_PENDING = 3;

    /** No 0/O, 1/I/L: the code gets typed into Minecraft chat by hand. */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(private readonly GameDeposits $deposits) {}

    public function verified(User $user): bool
    {
        return $user->minecraft_username !== null && $user->minecraft_verified_at !== null;
    }

    /** @return array{code?: string, expires_in?: int, error?: string} */
    public function startLink(User $user): array
    {
        // Once an IGN is verified it can only be changed by support. Letting a
        // logged-in session re-link to a new IGN would turn any session theft
        // into a payout to the attacker's own Minecraft account.
        if ($this->verified($user)) {
            return ['error' => 'already_linked'];
        }

        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        LinkCode::query()->where('user_id', $user->id)->whereNull('used_at')->delete();
        LinkCode::create([
            'user_id' => $user->id,
            'code_hash' => hash('sha256', $code),
            'expires_at' => now()->addMinutes(self::LINK_TTL_MINUTES),
        ]);

        return ['code' => $code, 'expires_in' => self::LINK_TTL_MINUTES * 60];
    }

    /** @return array{status: string, ign?: string} */
    public function completeLink(string $eventId, string $player, string $code): array
    {
        return DB::transaction(function () use ($eventId, $player, $code) {
            if (! $this->once($eventId, 'link')) {
                return ['status' => 'duplicate'];
            }

            $player = strtolower($player);

            $row = LinkCode::query()
                ->where('code_hash', hash('sha256', strtoupper($code)))
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->first();

            if ($row === null) {
                return ['status' => 'invalid_code'];
            }

            if (User::query()->where('minecraft_username', $player)->whereKeyNot($row->user_id)->exists()) {
                return ['status' => 'username_taken'];
            }

            $user = User::query()->find($row->user_id);
            if ($user === null) {
                return ['status' => 'invalid_code'];
            }

            // Codes issued before the account was verified must not be able to
            // replace the linked IGN. The same name is an idempotent re-link.
            if ($user->minecraft_verified_at !== null) {
                if (strcasecmp((string) $user->minecraft_username, $player) !== 0) {
                    return ['status' => 'already_linked'];
                }

                $row->forceFill(['used_at' => now()])->save();

                return ['status' => 'linked', 'ign' => $player];
            }

            try {
                // The confirmed name replaces whatever was typed at signup.
                $user->forceFill([
                    'minecraft_username' => $player,
                    'minecraft_verified_at' => now(),
                    'minecraft_ign_claim' => null,
                ])->save();
            } catch (QueryException) {
                return ['status' => 'username_taken'];
            }

            $row->forceFill(['used_at' => now()])->save();

            return ['status' => 'linked', 'ign' => $player];
        });
    }

    /**
     * @return array{ok: bool, error?: string, request?: array<string, mixed>, instructions?: string, expires_in?: int, max_pending?: int, min?: int, max?: int}
     */
    public function createRequest(User $user, int $amount): array
    {
        if (! $this->verified($user)) {
            return ['ok' => false, 'error' => 'not_linked'];
        }

        $min = (int) config('casino.deposit.min_game');
        $max = (int) config('casino.deposit.max_game');

        if ($amount < $min || $amount > $max) {
            return ['ok' => false, 'error' => 'amount_out_of_range', 'min' => $min, 'max' => $max];
        }

        $this->expireStale();

        $open = DepositRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->count();

        if ($open >= self::MAX_PENDING) {
            return ['ok' => false, 'error' => 'too_many_pending', 'max_pending' => self::MAX_PENDING];
        }

        $coins = $this->deposits->coinsFor($amount);

        if ($coins < 1) {
            return ['ok' => false, 'error' => 'amount_too_small'];
        }

        $request = DepositRequest::create([
            'user_id' => $user->id,
            'player' => strtolower((string) $user->minecraft_username),
            'game_amount' => $amount,
            'coins' => $coins,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(self::REQUEST_TTL_MINUTES),
        ]);

        return [
            'ok' => true,
            'expires_in' => self::REQUEST_TTL_MINUTES * 60,
            'request' => $this->present($request),
        ];
    }

    /** @return array{status: string} */
    public function handleDeposit(string $eventId, string $player, int $amount, ?string $raw): array
    {
        return DB::transaction(function () use ($eventId, $player, $amount, $raw) {
            if (! $this->once($eventId, 'deposit')) {
                return ['status' => 'duplicate'];
            }

            $player = strtolower($player);

            // Oldest open request from this player for exactly this amount.
            $request = DepositRequest::query()
                ->where('player', $player)
                ->where('game_amount', $amount)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->orderBy('created_at')
                ->lockForUpdate()
                ->first();

            if ($request === null) {
                UnmatchedPayment::create([
                    'player' => $player,
                    'game_amount' => $amount,
                    'raw' => $raw !== null ? mb_substr($raw, 0, 300) : null,
                ]);

                return ['status' => 'unmatched'];
            }

            $user = User::query()->find($request->user_id);

            if ($user === null) {
                UnmatchedPayment::create([
                    'player' => $player,
                    'game_amount' => $amount,
                    'raw' => $raw !== null ? mb_substr($raw, 0, 300) : null,
                ]);

                return ['status' => 'unmatched'];
            }

            $request->forceFill(['status' => 'completed', 'completed_at' => now()])->save();
            $this->deposits->credit($user, $request->coins, $amount, $raw ?? '', $eventId);

            return ['status' => 'credited'];
        });
    }

    public function expireStale(): void
    {
        DepositRequest::query()
            ->where('status', 'pending')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired', 'updated_at' => now()]);
    }

    /** @return array<string, mixed> */
    public function present(DepositRequest $request): array
    {
        return [
            'id' => $request->id,
            'game_amount' => $request->game_amount,
            'coins' => $request->coins,
            'status' => $request->status,
            'expires_at' => $request->expires_at->toIso8601String(),
            'expires_in' => max(0, (int) now()->diffInSeconds($request->expires_at, false)),
            'at' => $request->created_at?->toIso8601String(),
        ];
    }

    /** Records a bot event id once; true the first time only. */
    private function once(string $eventId, string $kind): bool
    {
        return DB::table('bot_events')->insertOrIgnore([
            'event_id' => $eventId,
            'kind' => $kind,
            'created_at' => now(),
        ]) === 1;
    }
}
