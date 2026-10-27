<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'retador_id', 'retado_id', 'estado', 'expira_at', 'empieza_at',
    'vidas_retador', 'vidas_retado', 'ataque_retador_at', 'ataque_retado_at', 'golpeado_retador_at', 'golpeado_retado_at',
    'ganador_id', 'perdedor_id', 'empate', 'duracion',
])]
class Duelo extends Model
{
    public const SEGUNDOS_INVITACION = 15;

    public const SEGUNDOS_CUENTA = 3; // 3-2-1-¡YA!

    public const SEGUNDOS_DURACION = 60;

    public const VIDAS = 3;

    public const MS_COOLDOWN = 600; // mínimo entre dos espadazos tuyos

    public const MS_INVULNERABLE = 800; // después de recibir un golpe

    /**
     * Con milisegundos: sin esto Laravel guarda "Y-m-d H:i:s" y el cooldown de 600 ms se
     * mediría en segundos enteros. Las columnas de golpes son TIMESTAMP(3) en MySQL.
     */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expira_at' => 'datetime',
            'empieza_at' => 'datetime',
            'ataque_retador_at' => 'datetime',
            'ataque_retado_at' => 'datetime',
            'golpeado_retador_at' => 'datetime',
            'golpeado_retado_at' => 'datetime',
            'empate' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function retador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'retador_id');
    }

    /** @return BelongsTo<User, $this> */
    public function retado(): BelongsTo
    {
        return $this->belongsTo(User::class, 'retado_id');
    }

    /** @return BelongsTo<User, $this> */
    public function ganador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ganador_id');
    }

    public function participa(User|int $user): bool
    {
        $id = $user instanceof User ? $user->id : $user;

        return in_array($id, [$this->retador_id, $this->retado_id], true);
    }

    /** 'retador' o 'retado' (nombre de las columnas de cada uno). */
    public function rolDe(int $userId): string
    {
        return $userId === $this->retador_id ? 'retador' : 'retado';
    }

    public function rivalDe(int $userId): int
    {
        return $userId === $this->retador_id ? $this->retado_id : $this->retador_id;
    }

    /** Hasta cuándo dura el combate (cuenta + 60 s). */
    public function terminaAt(): ?CarbonInterface
    {
        return $this->empieza_at?->copy()->addSeconds(self::SEGUNDOS_DURACION);
    }

    /** @return array<int, int> id del jugador → vidas */
    public function vidas(): array
    {
        return [$this->retador_id => $this->vidas_retador, $this->retado_id => $this->vidas_retado];
    }

    /**
     * Duelos que "ocupan" a un jugador: una invitación que todavía no venció, o un duelo
     * activo que no pasó su tiempo máximo (cuenta + 60 s, con un margen).
     *
     * @param  Builder<Duelo>  $query
     */
    public function scopeEnCurso(Builder $query): void
    {
        $limiteActivo = now()->subSeconds(self::SEGUNDOS_DURACION + 5);

        $query->where(fn (Builder $q) => $q
            ->where(fn (Builder $p) => $p->where('estado', 'pendiente')->where('expira_at', '>', now()))
            ->orWhere(fn (Builder $a) => $a->where('estado', 'activo')->where('empieza_at', '>', $limiteActivo)));
    }

    /**
     * @param  Builder<Duelo>  $query
     * @param  list<int>  $ids
     */
    public function scopeDeAlguno(Builder $query, array $ids): void
    {
        $query->where(fn (Builder $q) => $q->whereIn('retador_id', $ids)->orWhereIn('retado_id', $ids));
    }
}
