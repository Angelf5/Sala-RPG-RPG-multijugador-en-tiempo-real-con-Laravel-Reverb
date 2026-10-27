<?php

namespace App\Events;

use App\Models\Duelo;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * La respuesta del retado (aceptó o rechazó). Va por el canal privado del retador.
 */
class DueloRespondido implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Duelo $duelo) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('App.Models.User.'.$this->duelo->retador_id);
    }

    public function broadcastAs(): string
    {
        return 'DueloRespondido';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'duelo_id' => $this->duelo->id,
            'aceptado' => $this->duelo->estado === 'activo',
            'retado' => ['id' => $this->duelo->retado_id, 'nombre' => $this->duelo->retado->name],
        ];
    }
}
