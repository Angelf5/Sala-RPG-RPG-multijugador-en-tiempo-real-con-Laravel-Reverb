<?php

namespace Database\Seeders;

use App\Models\Estante;
use App\Models\Libro;
use Illuminate\Database\Seeder;

/**
 * Carga los 4 estantes y sus libros desde database/seeders/data/libros.json.
 * Es idempotente: usa updateOrCreate por slug, así que se puede correr varias veces.
 */
class BibliotecaSeeder extends Seeder
{
    public function run(): void
    {
        $datos = json_decode(
            file_get_contents(database_path('seeders/data/libros.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        foreach ($datos['estantes'] as $i => $e) {
            $estante = Estante::updateOrCreate(
                ['slug' => $e['slug']],
                [
                    'nombre' => $e['nombre'],
                    'icono' => $e['icono'],
                    'color' => $e['color'],
                    'descripcion' => $e['descripcion'],
                    'orden' => $i,
                ],
            );

            foreach ($e['libros'] as $j => $l) {
                Libro::updateOrCreate(
                    ['slug' => $l['slug']],
                    [
                        'estante_id' => $estante->id,
                        'titulo' => $l['titulo'],
                        'clase' => $l['clase'],
                        'paginas' => $l['paginas'],
                        'en_este_juego' => $l['en_este_juego'] ?? null,
                        'orden' => $j,
                    ],
                );
            }
        }
    }
}
