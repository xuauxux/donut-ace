<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            // The in-game name, capped the way Minecraft caps names.
            $table->string('player', 32);
            $table->uuid('uuid')->nullable();
            $table->string('message', 400);
            // sha256(player | message | sent-at) so a replay or a second bridge
            // posting the same line cannot double up.
            $table->string('hash', 64)->unique();
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->index(['id']);
            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
