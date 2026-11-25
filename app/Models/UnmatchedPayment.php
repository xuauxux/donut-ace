<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A payment the bot saw that matched no open deposit request: wrong amount,
 * expired request, or money sent out of the blue. Held for manual review.
 *
 * @property string $player
 * @property int $game_amount
 * @property string|null $raw
 * @property bool $resolved
 */
class UnmatchedPayment extends Model
{
    protected $fillable = ['player', 'game_amount', 'raw', 'resolved'];

    protected function casts(): array
    {
        return ['resolved' => 'boolean'];
    }
}
