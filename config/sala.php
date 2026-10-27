<?php

/*
 * Constantes del juego compartidas entre PHP y la vista (un solo lugar).
 */
return [

    // Máximo de jugadores por sala (el front lo controla con here()).
    'cupo' => 50,

    // Salas del juego → su canal de presencia (en Echo se usa sin el prefijo "presence-").
    // El mapa de cada una está en resources/js/juego/data/salas/{sala}.json.
    'salas' => [
        'biblioteca' => 'sala.1',
        'arena' => 'arena.1',
    ],

    // Paleta de colores de remera que se pueden elegir al entrar.
    'paleta' => [
        '#e74c3c' => 'Rojo',
        '#e67e22' => 'Naranja',
        '#f1c40f' => 'Amarillo',
        '#9acd32' => 'Lima',
        '#27ae60' => 'Verde',
        '#1abc9c' => 'Turquesa',
        '#3498db' => 'Celeste',
        '#2c3e9e' => 'Azul',
        '#8e44ad' => 'Violeta',
        '#e84393' => 'Rosa',
        '#8b5a2b' => 'Marrón',
        '#7f8c8d' => 'Gris',
    ],

];
