<?php

namespace App\Services;

use App\Models\User;

/**
 * Lógica de las salas que no pertenece al controlador (capa de servicio).
 * Cada sala tiene su mapa en el MISMO archivo que usa el JS:
 * resources/js/juego/data/salas/{sala}.json.
 */
class SalaService
{
    public const DIRECCIONES = ['arriba', 'abajo', 'izquierda', 'derecha'];

    /** @var array<string, array{ancho: int, alto: int, spawn: array{x: int, y: int, dir: string}, filas: list<string>, leyenda: array<string, array<string, mixed>>}> */
    private array $mapas = [];

    /**
     * Nombres de las salas (biblioteca, arena…).
     *
     * @return list<string>
     */
    public function salas(): array
    {
        return array_keys(config('sala.salas'));
    }

    public function existe(string $sala): bool
    {
        return array_key_exists($sala, config('sala.salas'));
    }

    /** Canal de presencia de una sala (ej. 'sala.1'). */
    public function canal(string $sala): string
    {
        return config("sala.salas.$sala");
    }

    /**
     * @return array{ancho: int, alto: int, spawn: array{x: int, y: int, dir: string}, filas: list<string>, leyenda: array<string, array<string, mixed>>}
     */
    public function mapa(string $sala): array
    {
        return $this->mapas[$sala] ??= json_decode(
            file_get_contents(resource_path("js/juego/data/salas/$sala.json")),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
    }

    public function esCaminable(string $sala, int $x, int $y): bool
    {
        if (! $this->existe($sala)) {
            return false;
        }

        $mapa = $this->mapa($sala);

        if ($x < 0 || $y < 0 || $x >= $mapa['ancho'] || $y >= $mapa['alto']) {
            return false;
        }

        $caracter = $mapa['filas'][$y][$x];

        return ($mapa['leyenda'][$caracter]['caminable'] ?? false) === true;
    }

    public function guardarPosicion(User $user, string $sala, int $x, int $y, string $dir): void
    {
        $user->forceFill([
            'sala' => $sala,
            'x' => $x,
            'y' => $y,
            'dir' => $dir,
            'ultima_vez' => now(),
        ])->save();
    }
}
