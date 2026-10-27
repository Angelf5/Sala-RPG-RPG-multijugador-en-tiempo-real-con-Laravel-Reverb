<?php

namespace App\Http\Controllers;

use App\Http\Requests\PosicionRequest;
use App\Services\SalaService;
use Illuminate\Http\Response;

class PosicionController extends Controller
{
    /**
     * Guarda la sala y la posición del jugador (al cambiar de sala, cada 5 s si se movió,
     * y al cerrar la pestaña con sendBeacon) para que al recargar aparezca donde estaba.
     */
    public function guardar(PosicionRequest $request, SalaService $salas): Response
    {
        $salas->guardarPosicion(
            $request->user(),
            $request->string('sala')->toString(),
            $request->integer('x'),
            $request->integer('y'),
            $request->string('dir')->toString(),
        );

        return response()->noContent();
    }
}
