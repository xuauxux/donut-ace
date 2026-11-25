<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Set only after the player proved they control the IGN (code in game).
            $table->timestamp('minecraft_verified_at')->nullable()->after('minecraft_username');
        });

        Schema::create('minecraft_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ign', 16);
            $table->string('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['user_id', 'expires_at']);
        });

        Schema::create('minecraft_whispers', function (Blueprint $table) {
            $table->id();
            $table->string('ign', 16)->index();
            $table->string('message', 200);
            $table->string('status', 12)->default('pending')->index(); // pending | sent | failed
            $table->string('reason', 120)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('minecraft_whispers');
        Schema::dropIfExists('minecraft_verifications');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('minecraft_verified_at');
        });
    }
};
