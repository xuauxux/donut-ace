<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An in-progress ladder round (mines, chicken, tower…). The hazard layout lives
 * in `state` and never leaves the server while the round is open.
 *
 * @property string $id
 * @property int $user_id
 * @property string $game
 * @property string $status
 * @property int $bet
 * @property int $payout
 * @property array<string, mixed> $state
 */
#[Fillable(['id', 'user_id', 'game', 'status', 'bet', 'payout', 'state'])]
class ArcadeRound extends Model
{
    public const OPEN = 'open';

    public const WON = 'won';

    public const LOST = 'lost';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'bet' => 'integer',
            'payout' => 'integer',
            'state' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
