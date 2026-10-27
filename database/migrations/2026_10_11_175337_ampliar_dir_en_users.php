<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La columna "dir" se creó con largo 6, pero "izquierda" tiene 9 letras y "derecha" 7:
 * MySQL rechazaba el UPDATE al guardar la posición. (SQLite, que usan los tests, no controla el largo.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('dir', 9)->default('arriba')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('dir', 6)->default('arriba')->change();
        });
    }
};
