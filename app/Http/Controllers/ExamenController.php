<?php

namespace App\Http\Controllers;

use App\Services\ExamenService;
use Illuminate\Http\JsonResponse;

class ExamenController extends Controller
{
    /**
     * 5 preguntas al azar para el modo examen de Claude.
     *
     * Ojo (para la defensa): la respuesta correcta viaja al navegador, así que con F12
     * se puede ver. Para un examen de práctica no importa; para uno con nota, habría que
     * corregir en el servidor (POST /examen/{id}/respuesta) y no mandar "correcta".
     */
    public function index(ExamenService $examen): JsonResponse
    {
        return response()->json(['data' => $examen->generar(5)]);
    }
}
