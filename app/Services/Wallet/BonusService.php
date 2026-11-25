<?php

namespace App\Services\Wallet;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;

class BonusService
{
    public function __construct(private readonly WalletService $wallet) {}

    public function grantWelcomeBonus(User $user): void
    {
        $amount = (int) config('casino.welcome_bonus');
        if ($amount > 0) {
            $this->wallet->credit($user, $amount, WalletTransaction::WELCOME_BONUS, 'welcome-'.$user->id);
        }
    }

    public function canClaimDaily(User $user): bool
    {
        return $user->daily_bonus_claimed_at === null
            || $user->daily_bonus_claimed_at->lt(now()->subDay());
    }

    public function nextDailyAt(User $user): ?string
    {
        return $this->canClaimDaily($user) ? null : $user->daily_bonus_claimed_at?->addDay()->toIso8601String();
    }

    public function claimDaily(User $user): bool
    {
        $now = now();
        $cutoff = $now->copy()->subDay();

        // The claim is decided by one conditional UPDATE, never by a read-then-write:
        // parallel requests (or a double click) can only credit the reward once.
        return DB::transaction(function () use ($user, $now, $cutoff) {
            $claimed = User::query()
                ->whereKey($user->id)
                ->where(function ($query) use ($cutoff) {
                    $query->whereNull('daily_bonus_claimed_at')
                        ->orWhere('daily_bonus_claimed_at', '<=', $cutoff);
                })
                ->update([
                    'daily_bonus_claimed_at' => $now,
                    'updated_at' => $now,
                ]);

            if ($claimed !== 1) {
                return false;
            }

            $user->setAttribute('daily_bonus_claimed_at', $now);

            $this->wallet->credit(
                $user,
                (int) config('casino.daily_bonus'),
                WalletTransaction::DAILY_BONUS,
                'daily-'.$user->id.'-'.$now->format('YmdHis'),
            );

            return true;
        });
    }
}
