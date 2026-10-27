<?php

namespace App\Events;

use App\Models\Duelo;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * El duelo arranca: va por el canal de presencia de la ARENA, así lo ven los dos que pelean
 * y todos los que miran. Dice dónde se para cada uno y cuánto falta para el ¡YA!.
 */
class DueloIniciado implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array{retador: array{x: int, y: int, dir: string}, retado: array{x: int, y: int, dir: string}}  $posiciones
     * @param  array{x0: int, y0: int, x1: int, y1: int}  $ring
     */
    public function __construct(public Duelo $duelo, public array $posiciones, public array $ring) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel(config('sala.salas.arena'));
    }

    public function broadcastAs(): string
    {
        return 'DueloIniciado';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $jugador = fn ($user, $pos) => ['id' => $user->id, 'nombre' => $user->name, ...$pos];

        return [
            'duelo_id' => $this->duelo->id,
            'retador' => $jugador($this->duelo->retador, $this->posiciones['retador']),
            'retado' => $jugador($this->duelo->retado, $this->posiciones['retado']),
            'ring' => $this->ring,
            'vidas' => Duelo::VIDAS,
            'duracion' => Duelo::SEGUNDOS_DURACION,
            // Relativo (y no una hora): los relojes de cada compu pueden estar corridos.
            'empieza_en_ms' => max(0, (int) now()->diffInMilliseconds($this->duelo->empieza_at, false)),
        ];
    }
}
