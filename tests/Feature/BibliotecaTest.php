<?php

namespace Tests\Feature;

use App\Models\Estante;
use App\Models\Libro;
use App\Models\Pregunta;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BibliotecaTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = DatabaseSeeder::class;

    public function test_los_seeders_cargan_4_estantes_34_libros_y_50_preguntas(): void
    {
        $this->assertSame(4, Estante::count());
        $this->assertSame(35, Libro::count());
        $this->assertSame(50, Pregunta::count());
    }

    public function test_los_seeders_son_idempotentes(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(4, Estante::count());
        $this->assertSame(35, Libro::count());
        $this->assertSame(50, Pregunta::count());
    }

    public function test_la_biblioteca_lista_estantes_y_titulos_sin_paginas(): void
    {
        $respuesta = $this->actingAs(User::factory()->create())->getJson('/biblioteca')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.slug', 'apis-datos')
            ->assertJsonStructure(['data' => [['slug', 'nombre', 'icono', 'color', 'descripcion', 'libros' => [['slug', 'titulo', 'clase']]]]]);

        $this->assertSame(35, collect($respuesta->json('data'))->sum(fn ($e) => count($e['libros'])));
        $this->assertStringNotContainsString('paginas', $respuesta->getContent());
    }

    public function test_un_libro_trae_sus_paginas(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/libros/cliente-servidor')
            ->assertOk()
            ->assertJsonPath('data.titulo', 'Cliente-servidor y APIs')
            ->assertJsonPath('data.estante.slug', 'apis-datos')
            ->assertJsonStructure(['data' => ['paginas' => [['texto']], 'en_este_juego']]);
    }

    public function test_un_libro_que_no_existe_da_404(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/libros/no-existe')->assertNotFound();
    }

    public function test_la_biblioteca_requiere_login(): void
    {
        $this->getJson('/biblioteca')->assertUnauthorized();
        $this->getJson('/libros/cliente-servidor')->assertUnauthorized();
    }
}
