<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Seguro: los tests con RefreshDatabase BORRAN todas las tablas. En MySQL solo se permite
     * la base de tests (sala_rpg_test, ver phpunit.mysql.xml); nunca la del juego.
     */
    public function createApplication()
    {
        $app = parent::createApplication();

        $conexion = config('database.default');
        $base = config("database.connections.$conexion.database");
        if (config("database.connections.$conexion.driver") === 'mysql' && $base !== 'sala_rpg_test') {
            throw new RuntimeException("Los tests no pueden correr contra la base MySQL '$base': usá sala_rpg_test (composer test:mysql).");
        }

        return $app;
    }
}
