<?php

namespace App\Http\Resources;

use App\Models\Mensaje;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Formato JSON de un mensaje del chat. Lo usan GET /chat, POST /chat y el evento
 * MensajeEnviado, así el historial y el tiempo real tienen exactamente la misma forma.
 *
 * @mixin Mensaje
 */
class MensajeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'nombre' => $this->user->name,
            'color' => $this->user->color,
            'texto' => $this->texto,
            // ISO 8601: cada navegador la muestra en su propia zona horaria.
            'hora' => $this->created_at->toIso8601String(),
        ];
    }
}
