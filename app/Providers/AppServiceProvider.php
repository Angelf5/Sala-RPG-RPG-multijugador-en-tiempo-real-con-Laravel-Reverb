<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Chat: 10 mensajes por minuto por jugador. Al pasarse → 429 y queda en el log.
        RateLimiter::for('chat', function (Request $request) {
            return Limit::perMinute(10)
                ->by($request->user()?->id ?: $request->ip())
                ->response(function (Request $request, array $headers) {
                    Log::warning('Límite del chat superado', ['id' => $request->user()?->id, 'ip' => $request->ip()]);

                    return response()->json(['message' => '¡Más despacio!'], 429, $headers);
                });
        });
    }
}
