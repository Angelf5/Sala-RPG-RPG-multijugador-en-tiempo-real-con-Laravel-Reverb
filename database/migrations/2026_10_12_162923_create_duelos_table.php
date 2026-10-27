<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Duelos de la arena: desde la invitación hasta el resultado.
 * Estados: pendiente → (rechazado | activo → terminado). Una invitación pendiente vence sola
 * cuando pasa expira_at (no hace falta un proceso que la borre).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('duelos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retador_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('retado_id')->constrained('users')->cascadeOnDelete();
            $table->string('estado', 12)->default('pendiente')->index();
            // nullable(): sin eso, MySQL/MariaDB le pone solo ON UPDATE CURRENT_TIMESTAMP a la primera
            // columna TIMESTAMP NOT NULL, y cada vez que se actualiza el duelo se pisa el vencimiento.
            $table->timestamp('expira_at')->nullable(); // la invitación dura 15 s
            $table->timestamp('empieza_at')->nullable(); // después de la cuenta 3-2-1

            // Combate (parte c): vidas y horarios de los golpes, con milisegundos (precisión 3)
            // para controlar el cooldown de 600 ms y la invulnerabilidad de 800 ms.
            $table->unsignedTinyInteger('vidas_retador')->default(3);
            $table->unsignedTinyInteger('vidas_retado')->default(3);
            $table->timestamp('ataque_retador_at', 3)->nullable();
            $table->timestamp('ataque_retado_at', 3)->nullable();
            $table->timestamp('golpeado_retador_at', 3)->nullable();
            $table->timestamp('golpeado_retado_at', 3)->nullable();

            // Resultado (parte d).
            $table->foreignId('ganador_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('perdedor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('empate')->default(false);
            $table->unsignedSmallInteger('duracion')->nullable(); // segundos
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('duelos');
    }
};
