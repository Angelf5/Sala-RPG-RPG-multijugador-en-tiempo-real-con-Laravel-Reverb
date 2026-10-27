<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Antes de validar: saltos de línea, tabs y espacios repetidos pasan a ser un solo espacio.
     * (Los espacios de los extremos ya los saca TrimStrings, y un texto de solo espacios
     * queda en null por ConvertEmptyStringsToNull, así que "required" lo rechaza.)
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->texto)) {
            $this->merge(['texto' => trim(preg_replace('/\s+/u', ' ', $this->texto))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'texto' => ['required', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'texto.required' => 'El mensaje está vacío.',
            'texto.string' => 'El mensaje tiene que ser texto.',
            'texto.max' => 'El mensaje puede tener hasta 80 caracteres.',
        ];
    }
}
