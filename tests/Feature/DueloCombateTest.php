<?php

namespace Tests\Feature;

use App\Events\DueloGolpe;
use App\Events\DueloIniciado;
use App\Events\DueloRespondido;
use App\Events\DueloTerminado;
use App\Models\Duelo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Parte (c): el combate. El servidor es el árbitro de cada espadazo. */
class DueloCombateTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $beto;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([DueloGolpe::class, DueloTerminado::class, DueloIniciado::class, DueloRespondido::class]);
        // Tiempo congelado: cada test lo avanza a mano para medir los milisegundos exactos.
        Carbon::setTestNow(Carbon::parse('2026-10-12 18:00:00.000'));
        $this->ana = User::factory()->create(['name' => 'Ana', 'sala' => 'arena'])->fresh();
        $this->beto = User::factory()->create(['name' => 'Beto', 'sala' => 'arena'])->fresh();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function avanzar(int $ms): void
    {
        Carbon::setTestNow(now()->addMilliseconds($ms));
    }

    /** Duelo ya aceptado y con la cuenta 3-2-1 terminada. */
    private function dueloActivo(): Duelo
    {
        return Duelo::create([
            'retador_id' => $this->ana->id,
            'retado_id' => $this->beto->id,
            'estado' => 'activo',
            'expira_at' => now(),
            'empieza_at' => now()->subSecond(),
        ]);
    }

    private function golpe(User $quien, Duelo $duelo, ?int $objetivo = null)
    {
        return $this->actingAs($quien)->postJson("/duelos/{$duelo->id}/golpe", [
            'objetivo_id' => $objetivo ?? $duelo->rivalDe($quien->id),
            'dir' => 'derecha',
        ]);
    }

    public function test_un_golpe_valido_resta_una_vida_y_se_emite_a_la_arena(): void
    {
        $duelo = $this->dueloActivo();

        $this->golpe($this->ana, $duelo)->assertOk()
            ->assertJsonPath('data.golpe', true)
            ->assertJsonPath("data.vidas.{$this->beto->id}", 2);

        $this->assertSame(2, $duelo->fresh()->vidas_retado);
        Event::assertDispatched(DueloGolpe::class, fn (DueloGolpe $e) => $e->broadcastOn()->name === 'presence-arena.1'
            && $e->broadcastWith()['golpeado_id'] === $this->beto->id);
    }

    public function test_no_se_puede_golpear_fuera_de_un_duelo(): void
    {
        $pendiente = Duelo::create(['retador_id' => $this->ana->id, 'retado_id' => $this->beto->id, 'estado' => 'pendiente', 'expira_at' => now()->addSeconds(10)]);

        $this->golpe($this->ana, $pendiente)->assertUnprocessable()->assertJsonPath('errors.duelo.0', 'El duelo no está en curso.');
        $this->assertSame(3, $pendiente->fresh()->vidas_retado);
    }

    public function test_no_te_podes_golpear_a_vos_mismo(): void
    {
        $duelo = $this->dueloActivo();

        $this->golpe($this->ana, $duelo, $this->ana->id)->assertUnprocessable()
            ->assertJsonPath('errors.duelo.0', 'No te podés golpear a vos mismo.');
        $this->assertSame([3, 3], [$duelo->fresh()->vidas_retador, $duelo->fresh()->vidas_retado]);
    }

    public function test_un_espectador_no_puede_golpear(): void
    {
        $duelo = $this->dueloActivo();
        $caro = User::factory()->create(['sala' => 'arena']);

        $this->actingAs($caro)->postJson("/duelos/{$duelo->id}/golpe", ['objetivo_id' => $this->beto->id, 'dir' => 'abajo'])
            ->assertForbidden();
    }

    public function test_no_se_puede_golpear_antes_del_ya(): void
    {
        $duelo = $this->dueloActivo();
        $duelo->update(['empieza_at' => now()->addSeconds(2)]); // todavía en la cuenta 3-2-1

        $this->golpe($this->ana, $duelo)->assertUnprocessable();
    }

    public function test_no_se_puede_golpear_mas_rapido_que_el_cooldown(): void
    {
        $duelo = $this->dueloActivo();

        $this->golpe($this->ana, $duelo)->assertOk();
        $this->avanzar(300); // < 600 ms
        $this->golpe($this->ana, $duelo)->assertTooManyRequests();

        $this->assertSame(2, $duelo->fresh()->vidas_retado);
    }

    public function test_el_rival_es_invulnerable_800_ms_despues_de_un_golpe(): void
    {
        $duelo = $this->dueloActivo();

        $this->golpe($this->ana, $duelo)->assertOk()->assertJsonPath('data.golpe', true);
        $this->avanzar(700); // pasó el cooldown (600) pero no la invulnerabilidad (800)
        $this->golpe($this->ana, $duelo)->assertOk()
            ->assertJsonPath('data.golpe', false)
            ->assertJsonPath('data.motivo', 'invulnerable');
        $this->assertSame(2, $duelo->fresh()->vidas_retado);

        $this->avanzar(700); // 1400 ms desde el primer golpe
        $this->golpe($this->ana, $duelo)->assertOk()->assertJsonPath('data.golpe', true);
        $this->assertSame(1, $duelo->fresh()->vidas_retado);
    }

    public function test_los_milisegundos_se_guardan_en_la_base(): void
    {
        $duelo = $this->dueloActivo();
        $this->avanzar(123);
        $this->golpe($this->ana, $duelo)->assertOk();

        // Si se perdieran los milisegundos, el cooldown se mediría en segundos enteros.
        $this->assertSame(123, (int) $duelo->fresh()->ataque_retador_at->format('v'));
    }

    public function test_el_duelo_termina_al_llegar_a_cero_vidas(): void
    {
        $duelo = $this->dueloActivo();

        foreach ([1, 2, 3] as $i) {
            $this->golpe($this->ana, $duelo)->assertOk()->assertJsonPath('data.golpe', true);
            $this->avanzar(900);
        }

        $duelo->refresh();
        $this->assertSame('terminado', $duelo->estado);
        $this->assertSame(0, $duelo->vidas_retado);
        $this->assertSame([$this->ana->id, $this->beto->id], [$duelo->ganador_id, $duelo->perdedor_id]);
        $this->assertFalse($duelo->empate);
        $this->assertSame(3, $duelo->duracion); // 1 s de cuenta ya pasada + 2 × 0,9 s
        Event::assertDispatched(DueloTerminado::class, fn (DueloTerminado $e) => $e->broadcastWith()['ganador_id'] === $this->ana->id);
    }

    public function test_no_se_puede_golpear_en_un_duelo_terminado(): void
    {
        $duelo = $this->dueloActivo();
        $duelo->update(['estado' => 'terminado', 'ganador_id' => $this->ana->id, 'perdedor_id' => $this->beto->id]);

        $this->golpe($this->beto, $duelo)->assertUnprocessable()->assertJsonPath('errors.duelo.0', 'El duelo no está en curso.');
    }

    public function test_no_se_puede_golpear_despues_de_los_60_segundos(): void
    {
        $duelo = $this->dueloActivo();
        $this->avanzar(60_000);

        $this->golpe($this->ana, $duelo)->assertUnprocessable();
    }

    public function test_al_aceptar_arranca_el_duelo_en_los_extremos_del_ring(): void
    {
        $duelo = Duelo::create(['retador_id' => $this->ana->id, 'retado_id' => $this->beto->id, 'estado' => 'pendiente', 'expira_at' => now()->addSeconds(10)]);

        $this->actingAs($this->beto)->postJson("/duelos/{$duelo->id}/aceptar")->assertOk();

        Event::assertDispatched(DueloIniciado::class, function (DueloIniciado $e) {
            $datos = $e->broadcastWith();

            return $e->broadcastOn()->name === 'presence-arena.1'
                && $datos['retador']['x'] === $datos['ring']['x0'] + 1
                && $datos['retado']['x'] === $datos['ring']['x1'] - 1
                && $datos['empieza_en_ms'] === 3000;
        });
    }

    public function test_en_curso_informa_el_duelo_a_los_que_llegan_tarde(): void
    {
        $this->actingAs($this->ana)->getJson('/duelos/en-curso')->assertOk()->assertJsonPath('data', null);

        $duelo = $this->dueloActivo();
        $caro = User::factory()->create(['sala' => 'arena']);
        $this->actingAs($caro)->getJson('/duelos/en-curso')->assertOk()
            ->assertJsonPath('data.duelo_id', $duelo->id)
            ->assertJsonPath("data.vidas.{$this->beto->id}", 3);
    }
}
