<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A bot callback id we have already handled, so a retried delivery is a no-op.
 */
class BotEvent extends Model
{
    protected $table = 'bot_events';

    protected $primaryKey = 'event_id';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['event_id', 'kind', 'created_at'];
}
