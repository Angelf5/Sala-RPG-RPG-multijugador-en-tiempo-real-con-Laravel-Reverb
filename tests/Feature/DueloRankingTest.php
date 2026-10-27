<?php

namespace Tests\Feature;

use App\Models\Duelo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Parte (e): el ranking de victorias (consulta agrupada). */
class DueloRankingTest extends TestCase
{
    use RefreshDatabase;

    private function jugador(string $nombre): User
    {
        return User::factory()->create(['name' => $nombre, 'sala' => 'arena']);
    }

    private function gana(User $ganador, User $perdedor, int $veces = 1): void
    {
        for ($i = 0; $i < $veces; $i++) {
            Duelo::create([
                'retador_id' => $ganador->id, 'retado_id' => $perdedor->id, 'estado' => 'terminado',
                'expira_at' => now(), 'empieza_at' => now(),
                'ganador_id' => $ganador->id, 'perdedor_id' => $perdedor->id, 'empate' => false, 'duracion' => 20,
            ]);
            Carbon::setTestNow(now()->addSecond()); // cada duelo termina un poco después
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_el_ranking_ordena_por_victorias(): void
    {
        [$ana, $beto, $caro] = [$this->jugador('Ana'), $this->jugador('Beto'), $this->jugador('Caro')];
        $this->gana($beto, $ana, 3);
        $this->gana($ana, $caro, 1);
        $this->gana($caro, $beto, 2);

        $this->actingAs($ana)->getJson('/duelos/ranking')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.nombre', 'Beto')
            ->assertJsonPath('data.0.victorias', 3)
            ->assertJsonPath('data.0.posicion', 1)
            ->assertJsonPath('data.1.nombre', 'Caro')
            ->assertJsonPath('data.2.nombre', 'Ana');
    }

    public function test_los_empates_y_los_duelos_sin_terminar_no_suman(): void
    {
        [$ana, $beto] = [$this->jugador('Ana'), $this->jugador('Beto')];
        $this->gana($ana, $beto);
        Duelo::create(['retador_id' => $ana->id, 'retado_id' => $beto->id, 'estado' => 'terminado', 'expira_at' => now(), 'empieza_at' => now(), 'empate' => true]);
        Duelo::create(['retador_id' => $beto->id, 'retado_id' => $ana->id, 'estado' => 'activo', 'expira_at' => now(), 'empieza_at' => now()]);

        $this->actingAs($ana)->getJson('/duelos/ranking')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nombre', 'Ana')
            ->assertJsonPath('data.0.victorias', 1);
    }

    public function test_con_las_mismas_victorias_va_primero_el_que_llego_antes(): void
    {
        [$ana, $beto, $caro] = [$this->jugador('Ana'), $this->jugador('Beto'), $this->jugador('Caro')];
        $this->gana($caro, $ana, 2); // Caro llega a 2 primero
        $this->gana($beto, $ana, 2);

        $this->actingAs($ana)->getJson('/duelos/ranking')->assertOk()
            ->assertJsonPath('data.0.nombre', 'Caro')
            ->assertJsonPath('data.1.nombre', 'Beto');
    }

    public function test_muestra_solo_el_top_10(): void
    {
        $sparring = $this->jugador('Sparring');
        foreach (range(1, 12) as $i) {
            $this->gana($this->jugador("J$i"), $sparring, $i);
        }

        $respuesta = $this->actingAs($sparring)->getJson('/duelos/ranking')->assertOk()->assertJsonCount(10, 'data');
        $this->assertSame('J12', $respuesta->json('data.0.nombre'));
        $this->assertSame(12, $respuesta->json('data.0.victorias'));
        $this->assertSame('J3', $respuesta->json('data.9.nombre'));
    }

    public function test_el_ranking_requiere_login(): void
    {
        $this->getJson('/duelos/ranking')->assertUnauthorized();
    }
}
