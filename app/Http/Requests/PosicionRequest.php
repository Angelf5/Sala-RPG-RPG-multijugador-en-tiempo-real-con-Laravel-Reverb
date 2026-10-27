<?php

namespace App\Http\Requests;

use App\Services\SalaService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PosicionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'sala' => ['required', 'string', Rule::in(app(SalaService::class)->salas())],
            'x' => ['required', 'integer', 'min:0'],
            'y' => ['required', 'integer', 'min:0'],
            'dir' => ['required', Rule::in(SalaService::DIRECCIONES)],
        ];
    }

    /**
     * Validación que necesita sala, x e y juntos: la celda tiene que existir y ser
     * caminable en el mapa de ESA sala.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                $caminable = app(SalaService::class)->esCaminable(
                    $this->string('sala')->toString(),
                    (int) $this->input('x'),
                    (int) $this->input('y'),
                );
                if (! $caminable) {
                    $validator->errors()->add('x', 'Esa celda no es caminable.');
                }
            },
        ];
    }
}
