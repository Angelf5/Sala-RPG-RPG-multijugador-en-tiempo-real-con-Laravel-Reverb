<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Los usuarios se crean al entrar a la sala; acá solo va el contenido de la cátedra.
     */
    public function run(): void
    {
        $this->call([
            BibliotecaSeeder::class,
            ExamenSeeder::class,
        ]);
    }
}
