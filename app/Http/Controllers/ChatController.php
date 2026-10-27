<?php

namespace App\Http\Controllers;

use App\Events\MensajeEnviado;
use App\Http\Requests\ChatRequest;
use App\Http\Resources\MensajeResource;
use App\Models\Mensaje;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    /** Los últimos 30 mensajes, del más viejo al más nuevo. */
    public function index(): AnonymousResourceCollection
    {
        $mensajes = Mensaje::with('user:id,name,color')->latest('id')->take(30)->get()->reverse()->values();

        return MensajeResource::collection($mensajes);
    }

    public function guardar(ChatRequest $request): JsonResponse
    {
        $mensaje = $request->user()->mensajes()->create($request->validated());

        try {
            // toOthers(): Laravel lee el header X-Socket-ID y no se lo manda al que escribió
            // (ese ya lo muestra con la respuesta de este POST).
            broadcast(new MensajeEnviado($mensaje))->toOthers();
        } catch (BroadcastException $e) {
            // Si Reverb está caído el mensaje igual queda guardado: lo verán en el historial.
            Log::error('No se pudo emitir MensajeEnviado', ['id' => $mensaje->id, 'error' => $e->getMessage()]);
        }

        return (new MensajeResource($mensaje->load('user')))->response()->setStatusCode(201);
    }
}
