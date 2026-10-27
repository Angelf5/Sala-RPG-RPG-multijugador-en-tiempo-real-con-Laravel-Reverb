<?php

namespace App\Http\Resources;

use App\Models\Estante;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Un estante con la lista de sus libros (solo título y clase: las páginas se piden aparte).
 *
 * @mixin Estante
 */
class EstanteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'nombre' => $this->nombre,
            'icono' => $this->icono,
            'color' => $this->color,
            'descripcion' => $this->descripcion,
            'libros' => $this->libros->map(fn ($libro) => [
                'slug' => $libro->slug,
                'titulo' => $libro->titulo,
                'clase' => $libro->clase,
            ]),
        ];
    }
}
