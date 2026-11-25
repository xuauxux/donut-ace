<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Site login name; the email a starter kit used to require is now optional.
            $table->string('username', 16)->nullable()->unique()->after('name');
            // IGN typed at signup. Informational until the in-game link proves it.
            $table->string('minecraft_ign_claim', 16)->nullable()->after('username');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn(['username', 'minecraft_ign_claim']);
        });
    }
};
