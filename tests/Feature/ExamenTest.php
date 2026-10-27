<?php

namespace Tests\Feature;

use App\Models\Pregunta;
use App\Models\User;
use App\Services\ExamenService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamenTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = DatabaseSeeder::class;

    public function test_devuelve_5_preguntas_distintas_con_su_libro(): void
    {
        $data = $this->actingAs(User::factory()->create())->getJson('/examen')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonStructure(['data' => [['id', 'pregunta', 'opciones', 'correcta', 'explicacion', 'libro' => ['slug', 'titulo']]]])
            ->json('data');

        $this->assertCount(5, array_unique(array_column($data, 'id')));
        foreach ($data as $pregunta) {
            $this->assertCount(4, $pregunta['opciones']);
            $this->assertContains($pregunta['correcta'], [0, 1, 2, 3]);
        }
    }

    public function test_al_mezclar_la_correcta_sigue_siendo_la_misma_respuesta(): void
    {
        $servicio = new ExamenService;

        foreach (Pregunta::all() as $original) {
            $mezclada = $servicio->mezclar($original);

            $this->assertEqualsCanonicalizing($original->opciones, $mezclada['opciones']);
            $this->assertSame($original->opciones[$original->correcta], $mezclada['opciones'][$mezclada['correcta']]);
        }
    }

    public function test_la_correcta_no_queda_siempre_en_el_mismo_lugar(): void
    {
        $servicio = new ExamenService;
        $pregunta = Pregunta::firstOrFail();

        $posiciones = collect(range(1, 60))->map(fn () => $servicio->mezclar($pregunta)['correcta'])->unique();

        // Con 60 mezclas, que nunca cambie de lugar es prácticamente imposible (4^-59).
        $this->assertGreaterThan(1, $posiciones->count());
    }

    public function test_todas_las_preguntas_apuntan_a_un_libro_que_existe(): void
    {
        $this->assertSame(0, Pregunta::doesntHave('libro')->count());
    }

    public function test_el_examen_requiere_login(): void
    {
        $this->getJson('/examen')->assertUnauthorized();
    }
}
