<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One line of chat: either relayed from the Minecraft server by the bridge or
 * typed by a signed-in player on the Live Chat page. Rows are insert-only.
 *
 * @property string $player
 * @property string|null $uuid
 * @property string $message
 * @property string $source
 * @property int|null $user_id
 * @property Carbon $sent_at
 */
class ChatMessage extends Model
{
    protected $fillable = ['player', 'uuid', 'message', 'source', 'user_id', 'hash', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }
}
