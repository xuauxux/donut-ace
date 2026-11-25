<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One-time codes the player sends to the bot in game to prove the IGN.
        Schema::create('link_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });

        // "I am about to send 500m" — the bot's receipt must match one of these.
        Schema::create('deposit_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('player', 16);
            $table->unsignedBigInteger('game_amount');
            $table->unsignedBigInteger('coins');
            $table->string('status', 12)->default('pending')->index(); // pending | completed | expired
            $table->timestamp('expires_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['player', 'game_amount', 'status']);
        });

        // Paid without a matching request: never auto-credit, review by hand.
        Schema::create('unmatched_payments', function (Blueprint $table) {
            $table->id();
            $table->string('player', 16)->index();
            $table->unsignedBigInteger('game_amount');
            $table->string('raw', 300)->nullable();
            $table->boolean('resolved')->default(false)->index();
            $table->timestamps();
        });

        // Idempotency: a bot retry carries the same event id and must not pay twice.
        Schema::create('bot_events', function (Blueprint $table) {
            $table->string('event_id', 64)->primary();
            $table->string('kind', 16);
            $table->timestamp('created_at')->nullable();
        });

        // The whisper-outbox verification experiment is replaced by DM linking.
        Schema::dropIfExists('minecraft_whispers');
        Schema::dropIfExists('minecraft_verifications');
    }

    public function down(): void
    {
        Schema::dropIfExists('bot_events');
        Schema::dropIfExists('unmatched_payments');
        Schema::dropIfExists('deposit_requests');
        Schema::dropIfExists('link_codes');
    }
};
