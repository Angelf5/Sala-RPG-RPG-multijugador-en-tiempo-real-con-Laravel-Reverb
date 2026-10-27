<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'nombre', 'icono', 'color', 'descripcion', 'orden'])]
class Estante extends Model
{
    /**
     * Un estante tiene muchos libros, ordenados como en el kit.
     *
     * @return HasMany<Libro, $this>
     */
    public function libros(): HasMany
    {
        return $this->hasMany(Libro::class)->orderBy('orden');
    }
}
