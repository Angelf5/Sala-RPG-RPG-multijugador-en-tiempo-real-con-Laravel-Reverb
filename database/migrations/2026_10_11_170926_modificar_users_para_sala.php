<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El login de la sala es solo con nombre: email y password pasan a ser opcionales
 * y se agregan los datos del personaje (género, color y última posición en el mapa).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();

            $table->enum('genero', ['chico', 'chica'])->default('chico')->after('name');
            $table->char('color', 7)->default('#3498db')->after('genero');
            $table->unsignedTinyInteger('x')->default(15)->after('color');
            $table->unsignedTinyInteger('y')->default(18)->after('x');
            $table->string('dir', 6)->default('arriba')->after('y');
            $table->timestamp('ultima_vez')->nullable()->after('dir');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['genero', 'color', 'x', 'y', 'dir', 'ultima_vez']);
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
