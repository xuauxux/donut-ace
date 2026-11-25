<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('withdrawals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('player', 16);
            $table->unsignedBigInteger('game_amount');
            $table->unsignedBigInteger('coins');
            // pending | sending | paid | failed | unconfirmed
            $table->string('status', 16)->default('pending')->index();
            $table->string('reason', 160)->nullable();
            $table->string('receipt', 300)->nullable();
            $table->string('claim_event_id', 64)->nullable()->index();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawals');
    }
};
