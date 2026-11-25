<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A player's declaration that they are about to send a specific amount in game.
 * The bot's receipt only credits when it matches one of these.
 *
 * @property int $user_id
 * @property string $player
 * @property int $game_amount
 * @property int $coins
 * @property string $status
 * @property Carbon $expires_at
 */
class DepositRequest extends Model
{
    protected $fillable = ['user_id', 'player', 'game_amount', 'coins', 'status', 'expires_at', 'completed_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
