<?php

namespace Database\Seeders;

use App\Models\Pregunta;
use Illuminate\Database\Seeder;

/**
 * Carga el banco de preguntas del modo examen desde database/seeders/data/examen.json.
 * Las preguntas no tienen slug propio: se identifican por libro + texto de la pregunta.
 */
class ExamenSeeder extends Seeder
{
    public function run(): void
    {
        $datos = json_decode(
            file_get_contents(database_path('seeders/data/examen.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        foreach ($datos['preguntas'] as $p) {
            Pregunta::updateOrCreate(
                ['libro_slug' => $p['libro'], 'pregunta' => $p['pregunta']],
                [
                    'opciones' => $p['opciones'],
                    'correcta' => $p['correcta'],
                    'explicacion' => $p['explicacion'],
                ],
            );
        }
    }
}
