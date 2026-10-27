<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PosicionTest extends TestCase
{
    use RefreshDatabase;

    public function test_guarda_una_celda_caminable(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/posicion', ['sala' => 'biblioteca', 'x' => 12, 'y' => 9, 'dir' => 'izquierda'])
            ->assertNoContent();

        $user->refresh();
        $this->assertSame(['biblioteca', 12, 9, 'izquierda'], [$user->sala, $user->x, $user->y, $user->dir]);
        $this->assertNotNull($user->ultima_vez);
    }

    public function test_guarda_en_que_sala_estas(): void
    {
        $user = User::factory()->create();

        // (15, 1) es el pasillo del portón en la arena, pero pared en la biblioteca.
        $this->actingAs($user)
            ->postJson('/posicion', ['sala' => 'arena', 'x' => 15, 'y' => 1, 'dir' => 'abajo'])
            ->assertNoContent();

        $this->assertSame('arena', $user->fresh()->sala);
    }

    /**
     * @return array<string, array{string, int, int, string}>
     */
    public static function posicionesInvalidas(): array
    {
        return [
            'borde' => ['biblioteca', 0, 0, 'abajo'],
            'pared' => ['biblioteca', 10, 1, 'abajo'],
            'estante' => ['biblioteca', 2, 3, 'abajo'],
            'NPC Claude' => ['biblioteca', 15, 4, 'abajo'],
            'lámpara' => ['biblioteca', 27, 14, 'abajo'],
            'puerta' => ['biblioteca', 15, 19, 'abajo'],
            'fuera del mapa' => ['biblioteca', 30, 5, 'abajo'],
            'negativa' => ['biblioteca', -1, 5, 'abajo'],
            'dirección inválida' => ['biblioteca', 12, 9, 'volando'],
            'pared de la biblioteca (caminable en la arena)' => ['biblioteca', 15, 1, 'abajo'],
            'muro de la arena' => ['arena', 10, 1, 'abajo'],
            'brasero de la arena' => ['arena', 2, 4, 'abajo'],
            'portón de la arena' => ['arena', 15, 0, 'abajo'],
            'sala que no existe' => ['cocina', 12, 9, 'abajo'],
        ];
    }

    #[DataProvider('posicionesInvalidas')]
    public function test_rechaza_celdas_no_caminables(string $sala, int $x, int $y, string $dir): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/posicion', ['sala' => $sala, 'x' => $x, 'y' => $y, 'dir' => $dir])
            ->assertUnprocessable();

        $user->refresh();
        $this->assertSame(['biblioteca', 15, 18], [$user->sala, $user->x, $user->y]);
    }

    public function test_sin_sala_no_se_guarda(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/posicion', ['x' => 12, 'y' => 9, 'dir' => 'abajo'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sala');
    }

    public function test_acepta_form_data_como_send_beacon(): void
    {
        $user = User::factory()->create();

        // sendBeacon manda FormData (no JSON) y no espera la respuesta.
        $this->actingAs($user)->post('/posicion', ['sala' => 'biblioteca', 'x' => '3', 'y' => '12', 'dir' => 'abajo'])->assertNoContent();

        $this->assertSame(3, $user->fresh()->x);
    }

    public function test_requiere_login(): void
    {
        $this->postJson('/posicion', ['sala' => 'biblioteca', 'x' => 12, 'y' => 9, 'dir' => 'abajo'])->assertUnauthorized();
    }
}
