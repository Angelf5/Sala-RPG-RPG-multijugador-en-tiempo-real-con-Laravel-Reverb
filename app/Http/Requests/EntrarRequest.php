<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Valida el formulario de la pantalla de inicio.
 * Los espacios de los extremos ya los saca el middleware TrimStrings de Laravel.
 */
class EntrarRequest extends FormRequest
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
            // Letras (con acentos, ü y ñ), números y espacios.
            'nombre' => ['required', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/u'],
            'genero' => ['required', Rule::in(['chico', 'chica'])],
            'color' => ['required', Rule::in(array_keys(config('sala.paleta')))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nombre.required' => 'Escribí tu nombre.',
            'nombre.min' => 'El nombre tiene que tener al menos 2 caracteres.',
            'nombre.max' => 'El nombre puede tener hasta 20 caracteres.',
            'nombre.regex' => 'Usá solo letras, números y espacios.',
            'genero.required' => 'Elegí chico o chica.',
            'genero.in' => 'Elegí chico o chica.',
            'color.required' => 'Elegí un color.',
            'color.in' => 'Elegí un color de la paleta.',
        ];
    }
}
