<?php

namespace App\Events;

use App\Http\Resources\MensajeResource;
use App\Models\Mensaje;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Un mensaje nuevo del chat. Laravel lo manda a Reverb (firmado con el SECRET) y Reverb
 * lo reparte a todos los del canal. En JS se escucha con .listen('.MensajeEnviado').
 */
class MensajeEnviado implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Mensaje $mensaje) {}

    /**
     * El chat es de todo el juego: el mensaje llega a todas las salas. El globo solo se ve
     * si el que escribió está en tu misma sala; el historial lo muestra igual.
     *
     * @return list<PresenceChannel>
     */
    public function broadcastOn(): array
    {
        return array_map(fn (string $canal) => new PresenceChannel($canal), array_values(config('sala.salas')));
    }

    /** Nombre corto del evento (sin el namespace App\Events\...). */
    public function broadcastAs(): string
    {
        return 'MensajeEnviado';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return (new MensajeResource($this->mensaje->loadMissing('user')))->resolve();
    }
}
