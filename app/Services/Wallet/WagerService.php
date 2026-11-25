<?php

namespace App\Services\Wallet;

use App\Models\User;
use App\Models\WalletTransaction;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Settles one bet: debit, resolve the round, credit any win — inside a single
 * transaction with per-round references so nothing can be charged or paid twice.
 */
final class WagerService
{
    public function __construct(private readonly WalletService $wallet) {}

    /**
     * @param  Closure(): array{total_win: int, multiplier?: float}  $round
     * @return array<string, mixed>
     */
    public function play(User $user, string $gameId, int $bet, Closure $round): array
    {
        return DB::transaction(function () use ($user, $gameId, $bet, $round) {
            $roundId = (string) Str::ulid();
            $outcome = $round();

            $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$roundId, $gameId);

            if (($outcome['total_win'] ?? 0) > 0) {
                $this->wallet->credit($user, (int) $outcome['total_win'], WalletTransaction::GAME_OUT, 'win-'.$roundId, $gameId);
            }

            return $outcome + ['round_id' => $roundId, 'balance' => (int) $user->fresh()->balance];
        });
    }
}
