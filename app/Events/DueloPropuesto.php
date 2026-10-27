<?php

namespace App\Events;

use App\Models\Duelo;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Invitación a un duelo. Va por el canal PRIVADO del retado (App.Models.User.{id}):
 * solo lo recibe él, no toda la sala.
 */
class DueloPropuesto implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Duelo $duelo) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('App.Models.User.'.$this->duelo->retado_id);
    }

    public function broadcastAs(): string
    {
        return 'DueloPropuesto';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $retador = $this->duelo->retador;

        return [
            'duelo_id' => $this->duelo->id,
            'retador' => ['id' => $retador->id, 'nombre' => $retador->name, 'color' => $retador->color],
            // Segundos que le quedan para contestar (el reloj de cada compu puede estar corrido).
            'segundos' => max(0, (int) ceil(now()->diffInMilliseconds($this->duelo->expira_at, false) / 1000)),
        ];
    }
}
