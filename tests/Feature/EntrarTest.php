<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EntrarTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_pantalla_de_inicio_se_ve(): void
    {
        $this->get('/')->assertOk()->assertSee('SALA RPG');
    }

    public function test_no_se_puede_ver_la_sala_sin_login(): void
    {
        $this->get('/sala')->assertRedirect('/');
    }

    public function test_entrar_crea_el_jugador_y_lo_manda_a_la_sala(): void
    {
        $this->post('/entrar', ['nombre' => '  Ñandú Pérez ', 'genero' => 'chica', 'color' => '#e84393'])
            ->assertRedirect('/sala');

        $user = User::firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('Ñandú Pérez', $user->name); // sin los espacios de los extremos
        $this->assertSame('chica', $user->genero);
        $this->assertSame(15, $user->x);
        $this->assertSame(18, $user->y);
        $this->assertSame('arriba', $user->dir);
    }

    /**
     * @return array<string, array{array<string, string>, string}>
     */
    public static function datosInvalidos(): array
    {
        $ok = ['nombre' => 'Ana', 'genero' => 'chico', 'color' => '#3498db'];

        return [
            'nombre vacío' => [[...$ok, 'nombre' => ''], 'nombre'],
            'nombre de 1 letra' => [[...$ok, 'nombre' => 'A'], 'nombre'],
            'nombre de 21 letras' => [[...$ok, 'nombre' => str_repeat('a', 21)], 'nombre'],
            'nombre con símbolos' => [[...$ok, 'nombre' => '<script>'], 'nombre'],
            'solo espacios' => [[...$ok, 'nombre' => '     '], 'nombre'],
            'género inválido' => [[...$ok, 'genero' => 'robot'], 'genero'],
            'color fuera de la paleta' => [[...$ok, 'color' => '#000000'], 'color'],
        ];
    }

    /**
     * @param  array<string, string>  $datos
     */
    #[DataProvider('datosInvalidos')]
    public function test_entrar_valida_los_datos(array $datos, string $campo): void
    {
        $this->from('/')->post('/entrar', $datos)
            ->assertRedirect('/')
            ->assertSessionHasErrors($campo);

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_la_sala_recibe_los_datos_publicos_del_jugador(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'email' => 'secreto@example.com']);

        $this->actingAs($user)->get('/sala')
            ->assertOk()
            ->assertSee('"nombre":"Ana"', false)
            ->assertDontSee('secreto@example.com');
    }

    public function test_si_ya_entraste_el_inicio_te_lleva_a_la_sala(): void
    {
        $this->actingAs(User::factory()->create())->get('/')->assertRedirect('/sala');
    }

    public function test_salir_cierra_la_sesion(): void
    {
        $this->actingAs(User::factory()->create())->post('/salir')->assertRedirect('/');

        $this->assertGuest();
    }
}
