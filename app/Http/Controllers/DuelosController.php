<?php

namespace App\Http\Controllers;

use App\Http\Requests\GolpeRequest;
use App\Http\Requests\RetarRequest;
use App\Models\Duelo;
use App\Models\User;
use App\Services\DueloService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class DuelosController extends Controller
{
    public function __construct(private DueloService $duelos) {}

    /** POST /duelos: retar a otro jugador. */
    public function retar(RetarRequest $request): JsonResponse
    {
        $duelo = $this->duelos->retar($request->user(), User::findOrFail($request->integer('retado_id')));

        return response()->json(['data' => $this->datos($duelo)], 201);
    }

    /** POST /duelos/{duelo}/aceptar: solo el retado (lo controla DueloPolicy). */
    public function aceptar(Request $request, Duelo $duelo): JsonResponse
    {
        Gate::authorize('responder', $duelo);

        return response()->json(['data' => $this->datos($this->duelos->aceptar($duelo))]);
    }

    /** POST /duelos/{duelo}/rechazar: solo el retado. */
    public function rechazar(Request $request, Duelo $duelo): Response
    {
        Gate::authorize('responder', $duelo);
        $this->duelos->rechazar($duelo);

        return response()->noContent();
    }

    /** POST /duelos/{duelo}/golpe: un espadazo. Solo los dos que pelean (DueloPolicy). */
    public function golpe(GolpeRequest $request, Duelo $duelo): JsonResponse
    {
        Gate::authorize('pelear', $duelo);

        $resultado = $this->duelos->golpear(
            $request->user(),
            $duelo,
            $request->integer('objetivo_id'),
            $request->string('dir')->toString(),
        );

        return response()->json(['data' => $resultado]);
    }

    /**
     * GET /duelos/en-curso: el duelo que se está peleando en la arena (si hay), para el que
     * entra cuando ya empezó: así ve los ❤️ y no se mete al ring.
     */
    public function enCurso(): JsonResponse
    {
        $this->duelos->finalizarVencidos();
        $duelo = Duelo::where('estado', 'activo')->enCurso()->with('retador', 'retado')->latest('id')->first();
        if (! $duelo) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => [
            'duelo_id' => $duelo->id,
            'retador' => ['id' => $duelo->retador_id, 'nombre' => $duelo->retador->name],
            'retado' => ['id' => $duelo->retado_id, 'nombre' => $duelo->retado->name],
            'ring' => $this->duelos->ring(),
            'vidas' => $duelo->vidas(),
            'termina_en_ms' => max(0, (int) now()->diffInMilliseconds($duelo->terminaAt(), false)),
            'empieza_en_ms' => max(0, (int) now()->diffInMilliseconds($duelo->empieza_at, false)),
        ]]);
    }

    /** POST /duelos/{duelo}/finalizar: se terminó el reloj. El servidor chequea la hora. */
    public function finalizar(Duelo $duelo): JsonResponse
    {
        return response()->json(['data' => $this->datos($this->duelos->finalizarPorTiempo($duelo))]);
    }

    /** POST /duelos/{duelo}/abandono: "mi rival se fue". Solo los que pelean; Reverb confirma. */
    public function abandono(Request $request, Duelo $duelo): JsonResponse
    {
        Gate::authorize('pelear', $duelo);

        return response()->json(['data' => $this->datos($this->duelos->abandono($request->user(), $duelo))]);
    }

    /** GET /duelos/ranking: top 10 de victorias. */
    public function ranking(): JsonResponse
    {
        return response()->json(['data' => $this->duelos->ranking(10)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function datos(Duelo $duelo): array
    {
        return [
            'id' => $duelo->id,
            'estado' => $duelo->estado,
            'retador_id' => $duelo->retador_id,
            'retado_id' => $duelo->retado_id,
            'expira_at' => $duelo->expira_at->toIso8601String(),
            'empieza_at' => $duelo->empieza_at?->toIso8601String(),
            'ganador_id' => $duelo->ganador_id,
            'perdedor_id' => $duelo->perdedor_id,
            'empate' => $duelo->empate,
        ];
    }
}
