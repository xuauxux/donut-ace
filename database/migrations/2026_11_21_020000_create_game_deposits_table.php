<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // The in-game name payments are matched against, stored lowercase so
            // "Youri67" and "youri67" are the same person.
            $table->string('minecraft_username', 16)->nullable()->unique()->after('name');
        });

        Schema::create('game_deposits', function (Blueprint $table) {
            $table->id();
            // sha256(payer | raw line | second seen): one credit per receipt.
            $table->string('tx_key', 64)->unique();
            $table->string('player', 16)->index();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 16)->default('credited')->index(); // credited | unmatched | rejected
            $table->string('raw', 300);
            $table->unsignedBigInteger('game_amount');
            $table->unsignedBigInteger('coins')->default(0);
            $table->string('reason', 160)->nullable();
            $table->timestamp('seen_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_deposits');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('minecraft_username');
        });
    }
};
