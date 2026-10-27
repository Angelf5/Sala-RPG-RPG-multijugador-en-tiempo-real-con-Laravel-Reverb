<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('libros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estante_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('titulo');
            $table->string('clase');
            $table->json('paginas');
            $table->text('en_este_juego')->nullable();
            $table->unsignedTinyInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('libros');
    }
};
