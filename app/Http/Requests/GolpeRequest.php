<?php

namespace App\Http\Requests;

use App\Services\SalaService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GolpeRequest extends FormRequest
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
            'objetivo_id' => ['required', 'integer'], // a quién le pegás (DueloService chequea que sea tu rival)
            'dir' => ['required', Rule::in(SalaService::DIRECCIONES)], // hacia dónde mirabas
        ];
    }
}
