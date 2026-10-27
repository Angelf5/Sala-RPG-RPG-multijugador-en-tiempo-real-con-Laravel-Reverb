<?php

namespace App\Events;

use App\Models\Duelo;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fin del duelo (alguien llegó a 0 ❤️). Va por la arena para que todos lo vean.
 */
class DueloTerminado implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Duelo $duelo, public string $motivo) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel(config('sala.salas.arena'));
    }

    public function broadcastAs(): string
    {
        return 'DueloTerminado';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'duelo_id' => $this->duelo->id,
            'motivo' => $this->motivo, // 'vidas' (más adelante: 'tiempo', 'abandono')
            'ganador_id' => $this->duelo->ganador_id,
            'perdedor_id' => $this->duelo->perdedor_id,
            'empate' => $this->duelo->empate,
            'vidas' => $this->duelo->vidas(),
            'duracion' => $this->duelo->duracion,
        ];
    }
}
