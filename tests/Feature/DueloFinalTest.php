<?php

namespace Tests\Feature;

use App\Events\DueloGolpe;
use App\Events\DueloIniciado;
use App\Events\DueloRespondido;
use App\Events\DueloTerminado;
use App\Models\Duelo;
use App\Models\User;
use App\Services\PresenciaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Parte (d): cómo termina un duelo (vidas, tiempo, desconexión) y qué queda guardado. */
class DueloFinalTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $beto;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([DueloGolpe::class, DueloTerminado::class, DueloIniciado::class, DueloRespondido::class]);
        Carbon::setTestNow(Carbon::parse('2026-10-12 18:00:00.000'));
        $this->ana = User::factory()->create(['name' => 'Ana', 'sala' => 'arena'])->fresh();
        $this->beto = User::factory()->create(['name' => 'Beto', 'sala' => 'arena'])->fresh();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function dueloActivo(array $cambios = []): Duelo
    {
        return Duelo::create([
            'retador_id' => $this->ana->id,
            'retado_id' => $this->beto->id,
            'estado' => 'activo',
            'expira_at' => now(),
            'empieza_at' => now(),
            ...$cambios,
        ]);
    }

    /** Reverb "dice" si el rival sigue en la arena (true / false / null = no contestó). */
    private function reverbDice(?bool $sigue): void
    {
        $this->app->instance(PresenciaService::class, new class($sigue) extends PresenciaService
        {
            public function __construct(private ?bool $sigue) {}

            public function estaEn(int $userId, string $canal): ?bool
            {
                return $this->sigue;
            }
        });
    }

    // ───── Fin por tiempo ─────

    public function test_al_terminar_el_tiempo_gana_el_que_tiene_mas_vidas(): void
    {
        $duelo = $this->dueloActivo(['vidas_retador' => 1, 'vidas_retado' => 2]);
        Carbon::setTestNow(now()->addSeconds(60));

        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/finalizar")->assertOk();

        $duelo->refresh();
        $this->assertSame('terminado', $duelo->estado);
        $this->assertSame([$this->beto->id, $this->ana->id, false, 60], [$duelo->ganador_id, $duelo->perdedor_id, $duelo->empate, $duelo->duracion]);
        Event::assertDispatched(DueloTerminado::class, fn (DueloTerminado $e) => $e->broadcastWith()['motivo'] === 'tiempo');
    }

    public function test_con_las_mismas_vidas_es_empate(): void
    {
        $duelo = $this->dueloActivo(['vidas_retador' => 2, 'vidas_retado' => 2]);
        Carbon::setTestNow(now()->addSeconds(61));

        $this->actingAs($this->beto)->postJson("/duelos/{$duelo->id}/finalizar")->assertOk();

        $duelo->refresh();
        $this->assertTrue($duelo->empate);
        $this->assertNull($duelo->ganador_id);
        $this->assertNull($duelo->perdedor_id);
    }

    public function test_no_se_puede_finalizar_antes_de_tiempo(): void
    {
        $duelo = $this->dueloActivo();
        Carbon::setTestNow(now()->addSeconds(30));

        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/finalizar")
            ->assertUnprocessable()
            ->assertJsonPath('errors.duelo.0', 'Todavía no se terminó el tiempo.');
        $this->assertSame('activo', $duelo->fresh()->estado);
    }

    public function test_finalizar_dos_veces_avisa_una_sola_vez(): void
    {
        $duelo = $this->dueloActivo();
        Carbon::setTestNow(now()->addSeconds(60));

        // Los dos clientes llegan a 0:00 y avisan casi juntos.
        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/finalizar")->assertOk();
        $this->actingAs($this->beto)->postJson("/duelos/{$duelo->id}/finalizar")->assertOk();

        Event::assertDispatchedTimes(DueloTerminado::class, 1);
    }

    public function test_un_duelo_olvidado_se_cierra_solo_al_consultar(): void
    {
        $duelo = $this->dueloActivo(['vidas_retador' => 3, 'vidas_retado' => 1]);
        Carbon::setTestNow(now()->addMinutes(5)); // se fueron los dos y nadie avisó

        $this->actingAs($this->ana)->getJson('/duelos/ranking')->assertOk();

        $this->assertSame('terminado', $duelo->fresh()->estado);
        $this->assertSame($this->ana->id, $duelo->fresh()->ganador_id);
    }

    // ───── Fin por desconexión ─────

    public function test_si_el_rival_se_desconecta_gana_el_que_se_quedo(): void
    {
        $this->reverbDice(false); // Reverb confirma que Beto ya no está en arena.1
        $duelo = $this->dueloActivo();
        Carbon::setTestNow(now()->addSeconds(12));

        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/abandono")->assertOk();

        $duelo->refresh();
        $this->assertSame([$this->ana->id, $this->beto->id, 12], [$duelo->ganador_id, $duelo->perdedor_id, $duelo->duracion]);
        Event::assertDispatched(DueloTerminado::class, fn (DueloTerminado $e) => $e->broadcastWith()['motivo'] === 'abandono');
    }

    public function test_no_se_gana_por_abandono_si_el_rival_sigue_conectado(): void
    {
        $this->reverbDice(true); // alguien intenta declararse ganador mintiendo
        $duelo = $this->dueloActivo();

        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/abandono")
            ->assertUnprocessable()
            ->assertJsonPath('errors.duelo.0', 'Tu rival sigue conectado a la arena.');
        $this->assertSame('activo', $duelo->fresh()->estado);
    }

    public function test_si_reverb_no_contesta_no_se_decide_el_abandono(): void
    {
        $this->reverbDice(null);
        $duelo = $this->dueloActivo();

        $this->actingAs($this->ana)->postJson("/duelos/{$duelo->id}/abandono")->assertUnprocessable();
        $this->assertSame('activo', $duelo->fresh()->estado);
    }

    public function test_un_espectador_no_puede_reclamar_un_abandono(): void
    {
        $this->reverbDice(false);
        $duelo = $this->dueloActivo();
        $caro = User::factory()->create(['sala' => 'arena']);

        $this->actingAs($caro)->postJson("/duelos/{$duelo->id}/abandono")->assertForbidden();
    }
}
