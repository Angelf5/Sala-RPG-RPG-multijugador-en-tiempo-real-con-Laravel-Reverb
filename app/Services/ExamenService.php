<?php

namespace App\Services;

use App\Models\Pregunta;

/**
 * Arma un examen: preguntas al azar con las opciones mezcladas.
 *
 * ¿Por qué mezclar? En examen.json la correcta es la segunda opción en 33 de las 50
 * preguntas: sin mezclar, se aprende a "apretar siempre la segunda".
 */
class ExamenService
{
    /**
     * @return list<array{id: int, pregunta: string, opciones: list<string>, correcta: int, explicacion: string, libro: array{slug: string, titulo: string}|null}>
     */
    public function generar(int $cantidad = 5): array
    {
        return Pregunta::with('libro:id,slug,titulo')
            ->inRandomOrder()
            ->take($cantidad)
            ->get()
            ->map(fn (Pregunta $p) => $this->mezclar($p))
            ->all();
    }

    /**
     * @return array{id: int, pregunta: string, opciones: list<string>, correcta: int, explicacion: string, libro: array{slug: string, titulo: string}|null}
     */
    public function mezclar(Pregunta $pregunta): array
    {
        $orden = array_keys($pregunta->opciones);
        shuffle($orden);

        return [
            'id' => $pregunta->id,
            'pregunta' => $pregunta->pregunta,
            'opciones' => array_map(fn (int $i) => $pregunta->opciones[$i], $orden),
            // Dónde quedó la correcta después de mezclar.
            'correcta' => array_search($pregunta->correcta, $orden, true),
            'explicacion' => $pregunta->explicacion,
            'libro' => $pregunta->libro ? ['slug' => $pregunta->libro->slug, 'titulo' => $pregunta->libro->titulo] : null,
        ];
    }
}
