<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El canal de presencia sala.1: Laravel firma los datos públicos del jugador
 * (con el SECRET de Reverb) para que Reverb lo deje entrar.
 */
class CanalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Firmar no necesita que Reverb esté corriendo: es un HMAC que se calcula en Laravel.
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'clave-de-prueba',
            'broadcasting.connections.reverb.secret' => 'secreto-de-prueba',
            'broadcasting.connections.reverb.app_id' => '1',
        ]);
        // Los canales se registraron al arrancar sobre el broadcaster "null" de phpunit.xml:
        // los volvemos a registrar sobre el de Reverb que acabamos de configurar.
        require base_path('routes/channels.php');
    }

    public function test_un_jugador_logueado_entra_con_sus_datos_publicos(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'email' => 'privado@example.com', 'genero' => 'chica', 'color' => '#e84393']);

        // fresh(): como en la app real, el usuario se lee de la BD (con x, y, dir por defecto).
        $respuesta = $this->actingAs($user->fresh())
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-sala.1'])
            ->assertOk()
            ->assertJsonStructure(['auth', 'channel_data']);

        $datos = json_decode($respuesta->json('channel_data'), true);
        $this->assertSame((string) $user->id, (string) $datos['user_id']);
        $this->assertSame(
            ['id' => $user->id, 'nombre' => 'Ana', 'genero' => 'chica', 'color' => '#e84393', 'sala' => 'biblioteca', 'x' => 15, 'y' => 18, 'dir' => 'arriba'],
            $datos['user_info'],
        );
        $this->assertStringNotContainsString('privado@example.com', $respuesta->getContent());
        $this->assertStringStartsWith('clave-de-prueba:', $respuesta->json('auth'));
    }

    public function test_solo_se_entra_al_canal_de_la_sala_donde_estas(): void
    {
        $enLaBiblioteca = User::factory()->create()->fresh();
        $enLaArena = User::factory()->create(['sala' => 'arena', 'x' => 15, 'y' => 2])->fresh();

        $this->actingAs($enLaBiblioteca)
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-arena.1'])
            ->assertForbidden();

        $this->actingAs($enLaArena)
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-arena.1'])
            ->assertOk();

        $this->actingAs($enLaArena)
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-sala.1'])
            ->assertForbidden();
    }

    public function test_sin_login_no_se_entra_al_canal(): void
    {
        $this->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-sala.1'])
            ->assertForbidden();
    }
}
