<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sin login → a la pantalla de inicio. Ya logueado y va a "/" → a la sala.
        $middleware->redirectGuestsTo('/');
        $middleware->redirectUsersTo('/sala');

        // Con Cloudflare Tunnel el navegador habla https con Cloudflare y Cloudflare le pasa
        // el pedido a Apache por http. Confiamos en sus encabezados X-Forwarded-* para que
        // Laravel sepa que el pedido original era https y arme bien las URLs (assets, rutas).
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
