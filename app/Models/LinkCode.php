<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One-time code the player whispers to the bot to prove which IGN is theirs.
 * Only the hash is stored; the plain code is shown once on the site.
 *
 * @property int $user_id
 * @property string $code_hash
 * @property Carbon $expires_at
 * @property Carbon|null $used_at
 */
class LinkCode extends Model
{
    protected $fillable = ['user_id', 'code_hash', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
