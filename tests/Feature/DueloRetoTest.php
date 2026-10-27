<?php

namespace Tests\Feature;

use App\Events\DueloPropuesto;
use App\Events\DueloRespondido;
use App\Models\Duelo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Parte (b): retar a duelo, aceptar y rechazar. */
class DueloRetoTest extends TestCase
{
    use RefreshDatabase;

    private function enLaArena(string $nombre): User
    {
        return User::factory()->create(['name' => $nombre, 'sala' => 'arena', 'x' => 12, 'y' => 5])->fresh();
    }

    public function test_retar_crea_la_invitacion_y_avisa_al_retado_por_su_canal_privado(): void
    {
        Event::fake([DueloPropuesto::class]);
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];

        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id])
            ->assertCreated()
            ->assertJsonPath('data.estado', 'pendiente');

        $duelo = Duelo::firstOrFail();
        $this->assertSame([$ana->id, $beto->id], [$duelo->retador_id, $duelo->retado_id]);
        $this->assertEqualsWithDelta(15, now()->diffInSeconds($duelo->expira_at), 1);

        Event::assertDispatched(DueloPropuesto::class, function (DueloPropuesto $e) use ($beto) {
            return $e->broadcastOn()->name === 'private-App.Models.User.'.$beto->id
                && $e->broadcastWith()['retador']['nombre'] === 'Ana';
        });
    }

    public function test_no_te_podes_retar_a_vos_mismo(): void
    {
        $ana = $this->enLaArena('Ana');

        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $ana->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('retado_id');
    }

    public function test_solo_se_puede_retar_en_la_arena(): void
    {
        Event::fake([DueloPropuesto::class]);
        $ana = $this->enLaArena('Ana');
        $enLaBiblioteca = User::factory()->create()->fresh();

        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $enLaBiblioteca->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.duelo.0', 'Los duelos son en la arena: los dos tienen que estar ahí.');

        $this->actingAs($enLaBiblioteca)->postJson('/duelos', ['retado_id' => $ana->id])->assertUnprocessable();
        $this->assertDatabaseCount('duelos', 0);
    }

    public function test_no_se_puede_retar_si_alguno_ya_esta_en_otro_duelo(): void
    {
        Event::fake([DueloPropuesto::class]);
        [$ana, $beto, $caro] = [$this->enLaArena('Ana'), $this->enLaArena('Beto'), $this->enLaArena('Caro')];

        // Ana ya retó a Beto (invitación sin contestar).
        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id])->assertCreated();

        // Caro no puede retar a Beto, y Beto no puede retar a Caro.
        $this->actingAs($caro)->postJson('/duelos', ['retado_id' => $beto->id])->assertUnprocessable();
        $this->actingAs($beto)->postJson('/duelos', ['retado_id' => $caro->id])->assertUnprocessable();

        // Un duelo activo también ocupa.
        Duelo::first()->update(['estado' => 'activo', 'empieza_at' => now()]);
        $this->actingAs($caro)->postJson('/duelos', ['retado_id' => $ana->id])->assertUnprocessable();
        $this->assertDatabaseCount('duelos', 1);
    }

    public function test_una_invitacion_vencida_ya_no_ocupa_a_nadie(): void
    {
        Event::fake([DueloPropuesto::class]);
        [$ana, $beto, $caro] = [$this->enLaArena('Ana'), $this->enLaArena('Beto'), $this->enLaArena('Caro')];
        Duelo::create(['retador_id' => $ana->id, 'retado_id' => $beto->id, 'estado' => 'pendiente', 'expira_at' => now()->subSecond()]);

        $this->actingAs($caro)->postJson('/duelos', ['retado_id' => $beto->id])->assertCreated();
    }

    public function test_el_retado_acepta_y_el_retador_se_entera(): void
    {
        Event::fake([DueloPropuesto::class, DueloRespondido::class]);
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];
        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id]);
        $duelo = Duelo::firstOrFail();

        $this->actingAs($beto)->postJson("/duelos/{$duelo->id}/aceptar")
            ->assertOk()
            ->assertJsonPath('data.estado', 'activo');

        $this->assertNotNull($duelo->fresh()->empieza_at);
        Event::assertDispatched(DueloRespondido::class, fn (DueloRespondido $e) => $e->broadcastOn()->name === 'private-App.Models.User.'.$ana->id
            && $e->broadcastWith()['aceptado'] === true);
    }

    public function test_el_retado_rechaza(): void
    {
        Event::fake([DueloPropuesto::class, DueloRespondido::class]);
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];
        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id]);
        $duelo = Duelo::firstOrFail();

        $this->actingAs($beto)->postJson("/duelos/{$duelo->id}/rechazar")->assertNoContent();

        $this->assertSame('rechazado', $duelo->fresh()->estado);
        Event::assertDispatched(DueloRespondido::class, fn (DueloRespondido $e) => $e->broadcastWith()['aceptado'] === false);
    }

    public function test_solo_el_retado_puede_responder(): void
    {
        Event::fake([DueloPropuesto::class, DueloRespondido::class]);
        [$ana, $beto, $caro] = [$this->enLaArena('Ana'), $this->enLaArena('Beto'), $this->enLaArena('Caro')];
        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id]);
        $duelo = Duelo::firstOrFail();

        // Ni un tercero ni el propio retador.
        $this->actingAs($caro)->postJson("/duelos/{$duelo->id}/aceptar")->assertForbidden();
        $this->actingAs($ana)->postJson("/duelos/{$duelo->id}/aceptar")->assertForbidden();
        $this->actingAs($caro)->postJson("/duelos/{$duelo->id}/rechazar")->assertForbidden();
        $this->assertSame('pendiente', $duelo->fresh()->estado);
    }

    public function test_no_se_puede_aceptar_una_invitacion_vencida(): void
    {
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];
        $duelo = Duelo::create(['retador_id' => $ana->id, 'retado_id' => $beto->id, 'estado' => 'pendiente', 'expira_at' => now()->subSecond()]);

        $this->actingAs($beto)->postJson("/duelos/{$duelo->id}/aceptar")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('duelo');
        $this->assertSame('pendiente', $duelo->fresh()->estado);
    }

    public function test_aceptar_dos_veces_no_arma_dos_duelos(): void
    {
        Event::fake([DueloPropuesto::class, DueloRespondido::class]);
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];
        $this->actingAs($ana)->postJson('/duelos', ['retado_id' => $beto->id]);
        $duelo = Duelo::firstOrFail();

        $this->actingAs($beto)->postJson("/duelos/{$duelo->id}/aceptar")->assertOk();
        $this->actingAs($beto)->postJson("/duelos/{$duelo->id}/aceptar")->assertUnprocessable();
        Event::assertDispatchedTimes(DueloRespondido::class, 1);
    }

    public function test_el_canal_privado_solo_lo_escucha_su_duenio(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => '1',
        ]);
        require base_path('routes/channels.php');
        [$ana, $beto] = [$this->enLaArena('Ana'), $this->enLaArena('Beto')];

        $this->actingAs($ana)->postJson('/broadcasting/auth', ['socket_id' => '1.2', 'channel_name' => 'private-App.Models.User.'.$ana->id])->assertOk();
        $this->actingAs($ana)->postJson('/broadcasting/auth', ['socket_id' => '1.2', 'channel_name' => 'private-App.Models.User.'.$beto->id])->assertForbidden();
    }

    public function test_retar_requiere_login(): void
    {
        $this->postJson('/duelos', ['retado_id' => 1])->assertUnauthorized();
    }
}
