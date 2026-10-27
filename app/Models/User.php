<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'genero', 'color', 'sala', 'x', 'y', 'dir', 'ultima_vez'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'x' => 'integer',
            'y' => 'integer',
            'ultima_vez' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Mensaje, $this>
     */
    public function mensajes(): HasMany
    {
        return $this->hasMany(Mensaje::class);
    }

    /**
     * Datos públicos del jugador: los que se mandan al canal de presencia
     * y a la vista de la sala. Nunca incluir email ni nada privado.
     *
     * @return array{id: int, nombre: string, genero: string, color: string, sala: string, x: int, y: int, dir: string}
     */
    public function datosJugador(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->name,
            'genero' => $this->genero,
            'color' => $this->color,
            'sala' => $this->sala,
            'x' => $this->x,
            'y' => $this->y,
            'dir' => $this->dir,
        ];
    }
}
