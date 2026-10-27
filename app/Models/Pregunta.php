<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['libro_slug', 'pregunta', 'opciones', 'correcta', 'explicacion'])]
class Pregunta extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opciones' => 'array',
            'correcta' => 'integer',
        ];
    }

    /**
     * El libro para repasar. La relación no usa el id sino el slug (así viene en examen.json).
     *
     * @return BelongsTo<Libro, $this>
     */
    public function libro(): BelongsTo
    {
        return $this->belongsTo(Libro::class, 'libro_slug', 'slug');
    }
}
