<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A coin → in-game money payout.
 *
 * Coins are debited when the request is created. The bot claims one request at
 * a time, sends a single /pay, and reports the result. A failed payout is
 * refunded; an unconfirmed one stays reserved for a human to check.
 *
 * @property int $id
 * @property int $user_id
 * @property string $player
 * @property int $game_amount
 * @property int $tax
 * @property int $coins
 * @property string $status
 * @property string|null $reason
 * @property string|null $receipt
 * @property string|null $claim_event_id
 * @property Carbon|null $claimed_at
 * @property Carbon|null $completed_at
 */
class Withdrawal extends Model
{
    protected $fillable = [
        'user_id',
        'player',
        'game_amount',
        'tax',
        'coins',
        'status',
        'reason',
        'receipt',
        'claim_event_id',
        'claimed_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
