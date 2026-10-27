<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use PDO;

/**
 * Crea la base MySQL de tests (sala_rpg_test) si no existe, con el mismo host/usuario del .env.
 * La usa `composer test:mysql`. Nunca toca la base del juego (sala_rpg).
 */
#[Signature('db:crear-test')]
#[Description('Crea la base MySQL sala_rpg_test para correr los tests contra MySQL')]
class CrearBaseDeTests extends Command
{
    public const BASE = 'sala_rpg_test';

    public function handle(): int
    {
        $mysql = config('database.connections.mysql');
        $pdo = new PDO("mysql:host={$mysql['host']};port={$mysql['port']}", $mysql['username'], $mysql['password']);
        $pdo->exec('CREATE DATABASE IF NOT EXISTS `'.self::BASE.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

        $this->info('Base '.self::BASE.' lista.');

        return self::SUCCESS;
    }
}
