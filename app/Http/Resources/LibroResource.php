<?php

namespace App\Http\Resources;

use App\Models\Libro;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Un libro completo, con sus páginas.
 *
 * @mixin Libro
 */
class LibroResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'titulo' => $this->titulo,
            'clase' => $this->clase,
            'estante' => [
                'slug' => $this->estante->slug,
                'nombre' => $this->estante->nombre,
                'color' => $this->estante->color,
            ],
            'paginas' => $this->paginas,
            'en_este_juego' => $this->en_este_juego,
        ];
    }
}
