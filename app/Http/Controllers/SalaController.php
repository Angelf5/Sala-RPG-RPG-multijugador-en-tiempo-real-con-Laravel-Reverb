<?php

namespace App\Http\Controllers;

use App\Models\Estante;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SalaController extends Controller
{
    public function mostrar(Request $request): View
    {
        return view('sala', [
            // Lo que el JS del juego necesita para arrancar (queda en window.SALA).
            'config' => [
                'jugador' => $request->user()->datosJugador(),
                'cupo' => config('sala.cupo'),
                'salas' => config('sala.salas'), // sala → canal de presencia
                'urlRetratos' => asset('img/retratos'),
                'urlPosicion' => route('posicion'),
                'urlChat' => route('chat'),
                'urlBiblioteca' => route('biblioteca'),
                'urlLibros' => url('libros'),
                'urlExamen' => route('examen'),
                'urlSalir' => route('salir'),
                'urlDuelos' => url('duelos'),
                // Color e ícono de cada estante para dibujarlos en el mapa (vienen de la BD).
                'estantes' => Estante::orderBy('orden')->get(['slug', 'nombre', 'icono', 'color']),
                // Si alguien pone su propia imagen del poster TUP, se usa en lugar del generado.
                'urlPosterTup' => file_exists(public_path('img/posters/tup.png')) ? asset('img/posters/tup.png') : null,
            ],
        ]);
    }
}
