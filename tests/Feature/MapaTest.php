<?php

namespace Tests\Feature;

use App\Services\SalaService;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Los mapas de las salas (resources/js/juego/data/salas/*.json) los usan el JS (dibujo y
 * colisiones) y PHP (validar /posicion): tienen que estar sanos.
 */
class MapaTest extends TestCase
{
    /**
     * @return array<string, array{string}>
     */
    public static function salas(): array
    {
        return ['biblioteca' => ['biblioteca'], 'arena' => ['arena']];
    }

    public function test_cada_sala_de_la_config_tiene_su_mapa(): void
    {
        $salas = new SalaService;

        foreach ($salas->salas() as $sala) {
            $this->assertFileExists(resource_path("js/juego/data/salas/$sala.json"));
        }
        $this->assertSame(['biblioteca', 'arena'], $salas->salas());
    }

    public function test_todas_las_salas_miden_lo_mismo(): void
    {
        // El canvas del juego no cambia de tamaño al cruzar una puerta.
        $salas = new SalaService;
        $tamanos = array_map(fn ($sala) => [$salas->mapa($sala)['ancho'], $salas->mapa($sala)['alto']], $salas->salas());

        $this->assertCount(1, array_unique($tamanos, SORT_REGULAR));
    }

    #[DataProvider('salas')]
    public function test_el_mapa_tiene_el_tamano_declarado_y_todo_tiene_leyenda(string $sala): void
    {
        $mapa = (new SalaService)->mapa($sala);

        $this->assertCount($mapa['alto'], $mapa['filas']);
        foreach ($mapa['filas'] as $y => $fila) {
            $this->assertSame($mapa['ancho'], strlen($fila), "$sala: la fila $y no mide {$mapa['ancho']}");
            foreach (str_split($fila) as $caracter) {
                $this->assertArrayHasKey($caracter, $mapa['leyenda'], "$sala: '$caracter' no está en la leyenda");
            }
        }
    }

    #[DataProvider('salas')]
    public function test_se_llega_a_todas_las_celdas_caminables_desde_el_spawn(string $sala): void
    {
        $salas = new SalaService;
        $mapa = $salas->mapa($sala);
        $spawn = $mapa['spawn'];
        $this->assertTrue($salas->esCaminable($sala, $spawn['x'], $spawn['y']));

        // Recorrido en anchura (BFS) desde el spawn.
        $visto = ["{$spawn['x']},{$spawn['y']}" => true];
        $cola = [[$spawn['x'], $spawn['y']]];
        while ($cola) {
            [$x, $y] = array_shift($cola);
            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $clave = ($x + $dx).','.($y + $dy);
                if (! isset($visto[$clave]) && $salas->esCaminable($sala, $x + $dx, $y + $dy)) {
                    $visto[$clave] = true;
                    $cola[] = [$x + $dx, $y + $dy];
                }
            }
        }

        $caminables = 0;
        for ($y = 0; $y < $mapa['alto']; $y++) {
            for ($x = 0; $x < $mapa['ancho']; $x++) {
                $caminables += $salas->esCaminable($sala, $x, $y) ? 1 : 0;
            }
        }
        $this->assertSame($caminables, count($visto), "$sala: hay celdas caminables encerradas");
    }

    #[DataProvider('salas')]
    public function test_cada_puerta_lleva_a_una_celda_caminable_de_otra_sala(string $sala): void
    {
        $salas = new SalaService;
        $mapa = $salas->mapa($sala);
        $puertas = 0;

        foreach ($mapa['filas'] as $y => $fila) {
            foreach (str_split($fila) as $x => $caracter) {
                $destino = $mapa['leyenda'][$caracter]['destino'] ?? null;
                if (! $destino) {
                    continue;
                }
                $puertas++;
                $this->assertTrue($salas->existe($destino['sala']), "$sala: la puerta lleva a una sala que no existe");
                $this->assertNotSame($sala, $destino['sala']);
                // Al cruzar se conserva la columna: la celda de llegada tiene que ser caminable.
                $this->assertTrue(
                    $salas->esCaminable($destino['sala'], $x, $destino['y']),
                    "$sala: la puerta ($x,$y) deja en una celda no caminable de {$destino['sala']}",
                );
            }
        }

        $this->assertGreaterThan(0, $puertas, "$sala no tiene puerta");
    }

    public function test_los_estantes_de_la_biblioteca_existen_en_libros_json(): void
    {
        $slugs = collect(json_decode(file_get_contents(database_path('seeders/data/libros.json')), true)['estantes'])->pluck('slug');

        foreach ((new SalaService)->mapa('biblioteca')['leyenda'] as $caracter => $info) {
            if ($info['tipo'] === 'estante') {
                $this->assertContains($info['estante'], $slugs, "El estante '$caracter' apunta a un slug que no existe");
            }
        }
    }

    public function test_el_diario_del_easter_egg_es_una_sola_celda_caminable(): void
    {
        $salas = new SalaService;
        $mapa = $salas->mapa('biblioteca');
        $celdas = [];
        foreach ($mapa['filas'] as $y => $fila) {
            foreach (str_split($fila) as $x => $caracter) {
                if (($mapa['leyenda'][$caracter]['tipo'] ?? null) === 'diario') {
                    $celdas[] = [$x, $y];
                }
            }
        }

        $this->assertCount(1, $celdas);
        [$x, $y] = $celdas[0];
        // Caminable: PHP acepta guardar la posición parado encima del diario.
        $this->assertTrue($salas->esCaminable('biblioteca', $x, $y));
    }
}
