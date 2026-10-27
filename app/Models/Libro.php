<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['estante_id', 'slug', 'titulo', 'clase', 'paginas', 'en_este_juego', 'orden'])]
class Libro extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'paginas' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Estante, $this>
     */
    public function estante(): BelongsTo
    {
        return $this->belongsTo(Estante::class);
    }
}
