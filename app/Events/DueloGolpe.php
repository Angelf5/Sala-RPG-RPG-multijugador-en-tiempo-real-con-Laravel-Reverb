<?php

namespace App\Events;

use App\Models\Duelo;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Un golpe que el servidor dio por válido (le restó una vida al rival). Va por la arena:
 * el golpeado retrocede y parpadea, y todos actualizan los ❤️.
 */
class DueloGolpe implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Duelo $duelo, public int $atacanteId, public int $golpeadoId, public string $dir) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel(config('sala.salas.arena'));
    }

    public function broadcastAs(): string
    {
        return 'DueloGolpe';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'duelo_id' => $this->duelo->id,
            'atacante_id' => $this->atacanteId,
            'golpeado_id' => $this->golpeadoId,
            'dir' => $this->dir, // hacia dónde lo empuja el espadazo
            'vidas' => $this->duelo->vidas(),
        ];
    }
}
