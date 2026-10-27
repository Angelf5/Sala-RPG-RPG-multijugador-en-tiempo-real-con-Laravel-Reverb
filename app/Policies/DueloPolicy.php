<?php

namespace App\Policies;

use App\Models\Duelo;
use App\Models\User;

/**
 * Autorización de los duelos: quién puede hacer qué con un duelo.
 * (Autenticación = quién sos; autorización = qué podés hacer.)
 */
class DueloPolicy
{
    /** Solo el retado puede aceptar o rechazar la invitación. */
    public function responder(User $user, Duelo $duelo): bool
    {
        return $user->id === $duelo->retado_id;
    }

    /** Solo los dos que pelean pueden dar espadazos en ese duelo. */
    public function pelear(User $user, Duelo $duelo): bool
    {
        return $duelo->participa($user);
    }
}
