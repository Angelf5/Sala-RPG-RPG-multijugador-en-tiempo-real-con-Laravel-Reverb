<?php

namespace App\Services;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Le pregunta a Reverb quién está conectado a un canal de presencia (su API HTTP:
 * GET /apps/{id}/channels/presence-{canal}/users). Es la única forma que tiene el
 * SERVIDOR de saber si alguien sigue en la sala: las posiciones viajan por whisper y
 * Laravel no las ve.
 */
class PresenciaService
{
    /**
     * ¿Está ese jugador conectado al canal? null si no se pudo preguntar (Reverb caído).
     */
    public function estaEn(int $userId, string $canal): ?bool
    {
        try {
            $respuesta = Broadcast::driver()->getPusher()->getPresenceUsers('presence-'.$canal);
            $ids = array_map(fn ($u) => (int) $u->id, $respuesta->users ?? []);

            return in_array($userId, $ids, true);
        } catch (Throwable $e) {
            Log::warning('No se pudo consultar la presencia en Reverb', ['canal' => $canal, 'error' => $e->getMessage()]);

            return null;
        }
    }
}
