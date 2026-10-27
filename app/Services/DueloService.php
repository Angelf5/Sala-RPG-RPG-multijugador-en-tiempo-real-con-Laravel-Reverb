<?php

namespace App\Services;

use App\Events\DueloGolpe;
use App\Events\DueloIniciado;
use App\Events\DueloPropuesto;
use App\Events\DueloRespondido;
use App\Events\DueloTerminado;
use App\Models\Duelo;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * Reglas de los duelos. El SERVIDOR es el árbitro: decide quién puede retar a quién,
 * si una invitación sigue vigente y (en la parte c) si un golpe vale.
 */
class DueloService
{
    public const SALA = 'arena';

    public function __construct(private SalaService $salas, private PresenciaService $presencia) {}

    /** Crea la invitación y se la manda al retado por su canal privado. */
    public function retar(User $retador, User $retado): Duelo
    {
        $this->finalizarVencidos();

        $duelo = DB::transaction(function () use ($retador, $retado) {
            $this->bloquearJugadores([$retador->id, $retado->id]);
            $this->exigirQueEstenEnLaArena($retador->fresh(), $retado->fresh());
            $this->exigirQueEstenLibres([$retador->id, $retado->id]);

            return Duelo::create([
                'retador_id' => $retador->id,
                'retado_id' => $retado->id,
                'estado' => 'pendiente',
                'expira_at' => now()->addSeconds(Duelo::SEGUNDOS_INVITACION),
            ]);
        });

        $this->emitir(new DueloPropuesto($duelo));

        return $duelo;
    }

    public function aceptar(Duelo $duelo): Duelo
    {
        $duelo = DB::transaction(function () use ($duelo) {
            // lockForUpdate: si el retado aprieta "Aceptar" dos veces, la segunda espera a la
            // primera y ya ve el duelo activo (no se arman dos duelos).
            $duelo = Duelo::lockForUpdate()->findOrFail($duelo->id);
            $this->exigirPendiente($duelo);
            $this->bloquearJugadores([$duelo->retador_id, $duelo->retado_id]);
            $this->exigirQueEstenEnLaArena($duelo->retador()->first(), $duelo->retado()->first());
            $this->exigirQueEstenLibres([$duelo->retador_id, $duelo->retado_id], except: $duelo->id);

            $duelo->update([
                'estado' => 'activo',
                'empieza_at' => now()->addSeconds(Duelo::SEGUNDOS_CUENTA), // después del 3-2-1
            ]);

            return $duelo;
        });

        $this->emitir(new DueloRespondido($duelo));
        // A toda la arena: los dos se paran en los extremos del ring y arranca la cuenta.
        $this->emitir(new DueloIniciado($duelo->load('retador', 'retado'), $this->posicionesDeInicio(), $this->ring()));

        return $duelo;
    }

    /**
     * Un espadazo. El cliente lo manda solo si el rival está en la casilla de enfrente
     * (eso no lo puede saber el servidor: las posiciones viajan por whisper). Acá se valida
     * todo lo demás. Devuelve si el golpe contó.
     *
     * @return array{golpe: bool, motivo: string|null, vidas: array<int, int>}
     */
    public function golpear(User $atacante, Duelo $duelo, int $objetivoId, string $dir): array
    {
        [$duelo, $golpe, $motivo, $termino] = DB::transaction(function () use ($atacante, $duelo, $objetivoId) {
            // lockForUpdate: dos golpes que llegan juntos se procesan de a uno (si no, los dos
            // podrían leer "3 vidas" y restar una sola).
            $duelo = Duelo::lockForUpdate()->findOrFail($duelo->id);
            $ahora = now();

            if ($duelo->estado !== 'activo') {
                $this->rechazo('El duelo no está en curso.');
            }
            if ($objetivoId === $atacante->id) {
                $this->rechazo('No te podés golpear a vos mismo.');
            }
            if ($objetivoId !== $duelo->rivalDe($atacante->id)) {
                $this->rechazo('Ese jugador no está en este duelo.');
            }
            if ($ahora->lt($duelo->empieza_at)) {
                $this->rechazo('Todavía no empezó: esperá el ¡YA!');
            }
            if ($ahora->gt($duelo->terminaAt())) {
                $this->rechazo('Se terminó el tiempo del duelo.');
            }

            $yo = $duelo->rolDe($atacante->id);
            $rival = $duelo->rolDe($objetivoId);

            // Cooldown: no más de un espadazo cada 600 ms (aunque el anterior no haya contado).
            $ultimo = $duelo->{"ataque_{$yo}_at"};
            if ($ultimo && $ultimo->diffInMilliseconds($ahora) < Duelo::MS_COOLDOWN) {
                throw new TooManyRequestsHttpException(null, '¡Muy rápido! Esperá un poco entre espadazos.');
            }
            $duelo->{"ataque_{$yo}_at"} = $ahora;

            // Invulnerabilidad: el rival recién golpeado no recibe otro golpe por 800 ms.
            $golpeado = $duelo->{"golpeado_{$rival}_at"};
            if ($golpeado && $golpeado->diffInMilliseconds($ahora) < Duelo::MS_INVULNERABLE) {
                $duelo->save();

                return [$duelo, false, 'invulnerable', false];
            }

            $duelo->{"vidas_{$rival}"} -= 1;
            $duelo->{"golpeado_{$rival}_at"} = $ahora;
            $termino = $duelo->{"vidas_{$rival}"} <= 0;
            if ($termino) {
                $this->cerrar($duelo, $atacante->id, $objetivoId, $ahora);
            }
            $duelo->save();

            return [$duelo, true, null, $termino];
        });

        if ($golpe) {
            $this->emitir(new DueloGolpe($duelo, $atacante->id, $objetivoId, $dir));
        }
        if ($termino) {
            $this->emitir(new DueloTerminado($duelo, 'vidas'));
        }

        return ['golpe' => $golpe, 'motivo' => $motivo, 'vidas' => $duelo->vidas()];
    }

    /**
     * Fin por tiempo (pasaron los 60 s): gana el que tenga más ❤️; si tienen las mismas, empate.
     * Lo pide el cliente cuando su reloj llega a 0, pero el que decide si ya es la hora es el
     * servidor. Es idempotente: si ya estaba terminado, no hace nada.
     */
    public function finalizarPorTiempo(Duelo $duelo): Duelo
    {
        [$duelo, $cerro] = DB::transaction(function () use ($duelo) {
            $duelo = Duelo::lockForUpdate()->findOrFail($duelo->id);
            if ($duelo->estado !== 'activo') {
                return [$duelo, false];
            }
            if (now()->lt($duelo->terminaAt())) {
                $this->rechazo('Todavía no se terminó el tiempo.');
            }

            [$a, $b] = [$duelo->vidas_retador, $duelo->vidas_retado];
            if ($a === $b) {
                $this->cerrar($duelo, null, null, $duelo->terminaAt());
            } else {
                [$ganador, $perdedor] = $a > $b ? [$duelo->retador_id, $duelo->retado_id] : [$duelo->retado_id, $duelo->retador_id];
                $this->cerrar($duelo, $ganador, $perdedor, $duelo->terminaAt());
            }
            $duelo->save();

            return [$duelo, true];
        });

        if ($cerro) {
            $this->emitir(new DueloTerminado($duelo, 'tiempo'));
        }

        return $duelo;
    }

    /**
     * Fin por desconexión: el que se quedó avisa que su rival se fue (lo vio en leaving()).
     * No le creemos a ciegas: le preguntamos a Reverb si el rival sigue en la arena.
     */
    public function abandono(User $reportante, Duelo $duelo): Duelo
    {
        $rival = $duelo->rivalDe($reportante->id);
        $sigue = $this->presencia->estaEn($rival, $this->salas->canal(self::SALA));
        if ($sigue === true) {
            $this->rechazo('Tu rival sigue conectado a la arena.');
        }
        if ($sigue === null) {
            $this->rechazo('No se pudo confirmar que tu rival se fue. Probá de nuevo en un momento.');
        }

        [$duelo, $cerro] = DB::transaction(function () use ($duelo, $reportante, $rival) {
            $duelo = Duelo::lockForUpdate()->findOrFail($duelo->id);
            if ($duelo->estado !== 'activo') {
                return [$duelo, false];
            }
            $this->cerrar($duelo, $reportante->id, $rival, now());
            $duelo->save();

            return [$duelo, true];
        });

        if ($cerro) {
            $this->emitir(new DueloTerminado($duelo, 'abandono'));
        }

        return $duelo;
    }

    /**
     * Duelos activos que pasaron sus 60 s sin que nadie avisara (por ejemplo, se fueron los
     * dos): se cierran por tiempo. Se llama antes de retar, del ranking y de en-curso.
     */
    public function finalizarVencidos(): void
    {
        Duelo::where('estado', 'activo')
            ->where('empieza_at', '<=', now()->subSeconds(Duelo::SEGUNDOS_DURACION))
            ->get()
            ->each(fn (Duelo $d) => $this->finalizarPorTiempo($d));
    }

    /**
     * Top de victorias: una consulta agrupada (GROUP BY ganador_id + COUNT). Los empates no
     * suman. Con las mismas victorias, va primero el que llegó antes a esa cantidad.
     *
     * @return Collection<int, array{posicion: int, id: int, nombre: string, color: string, victorias: int}>
     */
    public function ranking(int $cuantos = 10): Collection
    {
        $this->finalizarVencidos();

        return Duelo::query()
            ->select('ganador_id', DB::raw('COUNT(*) as victorias'), DB::raw('MAX(updated_at) as ultima'))
            ->where('estado', 'terminado')
            ->where('empate', false)
            ->whereNotNull('ganador_id')
            ->groupBy('ganador_id')
            ->orderByDesc('victorias')
            ->orderBy('ultima')
            ->limit($cuantos)
            ->with('ganador:id,name,color')
            ->get()
            ->values()
            ->map(fn (Duelo $fila, int $i) => [
                'posicion' => $i + 1,
                'id' => $fila->ganador_id,
                'nombre' => $fila->ganador->name,
                'color' => $fila->ganador->color,
                'victorias' => (int) $fila->victorias,
            ]);
    }

    /**
     * Cierre común de un duelo (sin guardar: lo guarda el que llama, dentro de su transacción).
     * Ganador y perdedor null = empate.
     */
    private function cerrar(Duelo $duelo, ?int $ganadorId, ?int $perdedorId, CarbonInterface $cuando): void
    {
        $duelo->fill([
            'estado' => 'terminado',
            'ganador_id' => $ganadorId,
            'perdedor_id' => $perdedorId,
            'empate' => $ganadorId === null,
            'duracion' => max(0, (int) round($duelo->empieza_at->diffInSeconds($cuando, false))),
        ]);
    }

    /**
     * El ring sale del mapa de la arena (las celdas 'o'): un solo lugar para su tamaño.
     *
     * @return array{x0: int, y0: int, x1: int, y1: int}
     */
    public function ring(): array
    {
        $mapa = $this->salas->mapa(self::SALA);
        $xs = $ys = [];
        foreach ($mapa['filas'] as $y => $fila) {
            foreach (str_split($fila) as $x => $caracter) {
                if (($mapa['leyenda'][$caracter]['tipo'] ?? null) === 'ring') {
                    $xs[] = $x;
                    $ys[] = $y;
                }
            }
        }

        return ['x0' => min($xs), 'y0' => min($ys), 'x1' => max($xs), 'y1' => max($ys)];
    }

    /**
     * Cada uno en un extremo del ring, a media altura, mirándose.
     *
     * @return array{retador: array{x: int, y: int, dir: string}, retado: array{x: int, y: int, dir: string}}
     */
    public function posicionesDeInicio(): array
    {
        $ring = $this->ring();
        $y = intdiv($ring['y0'] + $ring['y1'], 2);

        return [
            'retador' => ['x' => $ring['x0'] + 1, 'y' => $y, 'dir' => 'derecha'],
            'retado' => ['x' => $ring['x1'] - 1, 'y' => $y, 'dir' => 'izquierda'],
        ];
    }

    public function rechazar(Duelo $duelo): void
    {
        $duelo = DB::transaction(function () use ($duelo) {
            $duelo = Duelo::lockForUpdate()->findOrFail($duelo->id);
            if ($duelo->estado !== 'pendiente') {
                return null; // ya estaba contestado: no hay nada que avisar
            }
            $duelo->update(['estado' => 'rechazado']);

            return $duelo;
        });

        if ($duelo) {
            $this->emitir(new DueloRespondido($duelo));
        }
    }

    /**
     * Bloquea las filas de los jugadores hasta el final de la transacción: si llegan dos retos
     * a la misma persona al mismo tiempo, el segundo espera y ya ve el primero.
     *
     * @param  list<int>  $ids
     */
    private function bloquearJugadores(array $ids): void
    {
        User::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
    }

    private function exigirQueEstenEnLaArena(?User $a, ?User $b): void
    {
        if ($a?->sala !== self::SALA || $b?->sala !== self::SALA) {
            $this->rechazo('Los duelos son en la arena: los dos tienen que estar ahí.');
        }
    }

    /**
     * @param  list<int>  $ids
     */
    private function exigirQueEstenLibres(array $ids, ?int $except = null): void
    {
        $ocupados = Duelo::enCurso()->deAlguno($ids)
            ->when($except, fn ($q) => $q->where('id', '!=', $except))
            ->exists();

        if ($ocupados) {
            $this->rechazo('Alguno de los dos ya está en otro duelo o tiene una invitación sin contestar.');
        }
    }

    private function exigirPendiente(Duelo $duelo): void
    {
        if ($duelo->estado !== 'pendiente') {
            $this->rechazo('Esa invitación ya no está vigente.');
        }
        if ($duelo->expira_at->isPast()) {
            $this->rechazo('La invitación expiró (pasaron más de '.Duelo::SEGUNDOS_INVITACION.' s).');
        }
    }

    /** Error de las reglas del juego: Laravel lo responde como 422 con este mensaje. */
    private function rechazo(string $mensaje): never
    {
        throw ValidationException::withMessages(['duelo' => $mensaje]);
    }

    /** Si Reverb está caído, el duelo igual queda guardado: lo anotamos en el log. */
    private function emitir(object $evento): void
    {
        try {
            broadcast($evento);
        } catch (BroadcastException $e) {
            Log::error('No se pudo emitir '.class_basename($evento), ['error' => $e->getMessage()]);
        }
    }
}
