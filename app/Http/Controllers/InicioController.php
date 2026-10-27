<?php

namespace App\Http\Controllers;

use App\Http\Requests\EntrarRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

class InicioController extends Controller
{
    public function mostrar(): View
    {
        return view('inicio', [
            'paleta' => config('sala.paleta'),
        ]);
    }

    public function entrar(EntrarRequest $request): RedirectResponse
    {
        $datos = $request->validated();

        $user = User::create([
            'name' => $datos['nombre'],
            'genero' => $datos['genero'],
            'color' => $datos['color'],
            'ultima_vez' => now(),
        ]);

        Auth::login($user);
        $request->session()->regenerate(); // evita "session fixation"

        Log::info('Entró a la sala', ['id' => $user->id, 'nombre' => $user->name, 'ip' => $request->ip()]);

        return redirect()->route('sala');
    }

    public function salir(Request $request): RedirectResponse
    {
        Log::info('Salió de la sala', ['id' => $request->user()->id]);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('inicio');
    }
}
