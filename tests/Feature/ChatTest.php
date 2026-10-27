<?php

namespace Tests\Feature;

use App\Events\MensajeEnviado;
use App\Models\Mensaje;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_enviar_un_mensaje_lo_guarda_y_emite_mensaje_enviado(): void
    {
        Event::fake([MensajeEnviado::class]);
        $user = User::factory()->create(['name' => 'Ana', 'color' => '#e84393']);

        $this->actingAs($user)
            ->postJson('/chat', ['texto' => '  Hola   sala  '])
            ->assertCreated()
            ->assertJsonPath('data.texto', 'Hola sala')
            ->assertJsonPath('data.nombre', 'Ana')
            ->assertJsonPath('data.color', '#e84393');

        $this->assertDatabaseHas('mensajes', ['user_id' => $user->id, 'texto' => 'Hola sala']);
        Event::assertDispatched(MensajeEnviado::class, fn ($e) => $e->mensaje->texto === 'Hola sala');
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function textosInvalidos(): array
    {
        return [
            'vacío' => [''],
            'solo espacios' => ['      '],
            'sin campo' => [null],
            '81 caracteres' => [str_repeat('a', 81)],
            'no es texto' => [['hola']],
        ];
    }

    #[DataProvider('textosInvalidos')]
    public function test_rechaza_mensajes_invalidos(mixed $texto): void
    {
        Event::fake([MensajeEnviado::class]);

        $this->actingAs(User::factory()->create())
            ->postJson('/chat', ['texto' => $texto])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('texto');

        $this->assertDatabaseCount('mensajes', 0);
        Event::assertNotDispatched(MensajeEnviado::class);
    }

    public function test_acepta_80_caracteres_con_acentos(): void
    {
        Event::fake([MensajeEnviado::class]);

        $this->actingAs(User::factory()->create())
            ->postJson('/chat', ['texto' => str_repeat('ñ', 80)])
            ->assertCreated();
    }

    public function test_el_mensaje_11_en_un_minuto_devuelve_429(): void
    {
        Event::fake([MensajeEnviado::class]);
        Log::spy();
        $user = User::factory()->create();

        for ($i = 1; $i <= 10; $i++) {
            $this->actingAs($user)->postJson('/chat', ['texto' => "mensaje $i"])->assertCreated();
        }

        $this->actingAs($user)->postJson('/chat', ['texto' => 'uno más'])
            ->assertTooManyRequests()
            ->assertJsonPath('message', '¡Más despacio!');

        $this->assertDatabaseCount('mensajes', 10);
        Log::shouldHaveReceived('warning')->withArgs(fn ($mensaje) => str_contains($mensaje, 'Límite del chat'));

        // El límite es por jugador: otro puede seguir escribiendo.
        $this->actingAs(User::factory()->create())->postJson('/chat', ['texto' => 'hola'])->assertCreated();
    }

    public function test_el_historial_trae_los_ultimos_30_en_orden(): void
    {
        $user = User::factory()->create(['name' => 'Beto']);
        foreach (range(1, 35) as $i) {
            Mensaje::create(['user_id' => $user->id, 'texto' => "m$i"]);
        }

        $respuesta = $this->actingAs($user)->getJson('/chat')->assertOk()->assertJsonCount(30, 'data');

        $this->assertSame('m6', $respuesta->json('data.0.texto'));
        $this->assertSame('m35', $respuesta->json('data.29.texto'));
        $this->assertSame('Beto', $respuesta->json('data.29.nombre'));
    }

    public function test_si_reverb_esta_caido_el_mensaje_igual_se_guarda(): void
    {
        // Apuntamos el broadcaster a un puerto donde no escucha nadie.
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
            'broadcasting.connections.reverb.options.port' => 1,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);

        $this->actingAs(User::factory()->create())
            ->postJson('/chat', ['texto' => 'hola'])
            ->assertCreated();

        $this->assertDatabaseCount('mensajes', 1);
    }

    public function test_el_chat_requiere_login(): void
    {
        $this->getJson('/chat')->assertUnauthorized();
        $this->postJson('/chat', ['texto' => 'hola'])->assertUnauthorized();
    }
}
