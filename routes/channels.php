<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Un canal de presencia por sala (sala.1 = biblioteca, arena.1 = arena; ver config/sala.php).
 * Lo que devuelve la función es lo que reciben los demás en here() / joining() / leaving().
 * Si devuelve false, no entra: solo te dejamos unirte al canal de la sala donde estás
 * (la que guardó POST /posicion), así nadie aparece en dos salas a la vez.
 */
foreach (config('sala.salas') as $sala => $canal) {
    Broadcast::channel($canal, fn (User $user) => $user->sala === $sala ? $user->datosJugador() : false);
}

/*
 * Canal PRIVADO de cada jugador: ahí le llegan las invitaciones a duelo y las respuestas.
 * Solo lo puede escuchar el dueño (true/false: en un canal privado no hace falta mandar datos).
 */
Broadcast::channel('App.Models.User.{id}', fn (User $user, int $id) => $user->id === $id);
