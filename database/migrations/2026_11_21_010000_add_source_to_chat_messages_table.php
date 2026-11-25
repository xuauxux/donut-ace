<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // 'game' lines come from the Minecraft bridge, 'site' lines are typed
            // by players on the Live Chat page.
            $table->string('source', 8)->default('game')->after('message')->index();
            $table->foreignId('user_id')->nullable()->after('source')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['source', 'user_id']);
        });
    }
};
