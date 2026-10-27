<?php

use App\Http\Controllers\BibliotecaController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\DuelosController;
use App\Http\Controllers\ExamenController;
use App\Http\Controllers\InicioController;
use App\Http\Controllers\PosicionController;
use App\Http\Controllers\SalaController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/', [InicioController::class, 'mostrar'])->name('inicio');
    Route::post('/entrar', [InicioController::class, 'entrar'])->middleware('throttle:10,1')->name('entrar');
});

Route::middleware('auth')->group(function () {
    Route::post('/salir', [InicioController::class, 'salir'])->name('salir');
    Route::get('/sala', [SalaController::class, 'mostrar'])->name('sala');
    Route::get('/chat', [ChatController::class, 'index'])->name('chat');
    Route::post('/chat', [ChatController::class, 'guardar'])->middleware('throttle:chat')->name('chat.guardar');
    Route::get('/biblioteca', [BibliotecaController::class, 'index'])->name('biblioteca');
    Route::get('/libros/{slug}', [BibliotecaController::class, 'libro'])->name('libros.ver');
    Route::get('/examen', [ExamenController::class, 'index'])->name('examen');
    Route::post('/posicion', [PosicionController::class, 'guardar'])->middleware('throttle:30,1')->name('posicion');

    // Duelos de la arena. Retar está limitado para que nadie llene de invitaciones a otro.
    Route::post('/duelos', [DuelosController::class, 'retar'])->middleware('throttle:10,1')->name('duelos.retar');
    Route::post('/duelos/{duelo}/aceptar', [DuelosController::class, 'aceptar'])->name('duelos.aceptar');
    Route::post('/duelos/{duelo}/rechazar', [DuelosController::class, 'rechazar'])->name('duelos.rechazar');
    Route::post('/duelos/{duelo}/golpe', [DuelosController::class, 'golpe'])->name('duelos.golpe');
    Route::post('/duelos/{duelo}/finalizar', [DuelosController::class, 'finalizar'])->name('duelos.finalizar');
    Route::post('/duelos/{duelo}/abandono', [DuelosController::class, 'abandono'])->name('duelos.abandono');
    Route::get('/duelos/en-curso', [DuelosController::class, 'enCurso'])->name('duelos.en-curso');
    Route::get('/duelos/ranking', [DuelosController::class, 'ranking'])->name('duelos.ranking');
});
