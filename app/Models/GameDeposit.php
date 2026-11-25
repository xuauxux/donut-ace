<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One in-game payment receipt the bot saw, and what it did with it.
 *
 * `unmatched` rows (paid before the player claimed that IGN on the site) are
 * credited automatically the moment someone saves that IGN.
 *
 * @property string $tx_key
 * @property string $player
 * @property int|null $user_id
 * @property string $status
 * @property string $raw
 * @property int $game_amount
 * @property int $coins
 * @property string|null $reason
 * @property Carbon $seen_at
 */
class GameDeposit extends Model
{
    protected $fillable = ['tx_key', 'player', 'user_id', 'status', 'raw', 'game_amount', 'coins', 'reason', 'seen_at'];

    protected function casts(): array
    {
        return ['seen_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
