<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arcade_rounds', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('game');
            $table->string('status')->default('open'); // open | won | lost
            $table->unsignedBigInteger('bet');
            $table->unsignedBigInteger('payout')->default(0);
            $table->json('state');
            $table->timestamps();

            $table->index(['user_id', 'game', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arcade_rounds');
    }
};
