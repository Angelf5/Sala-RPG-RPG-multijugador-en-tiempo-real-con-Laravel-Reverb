// Constantes del juego. Lo que también necesita PHP (cupo, canal, paleta)
// viene del servidor en window.SALA para no duplicarlo.

export const TILE = 32; // px de cada celda del mapa
export const SPRITE_W = 16; // sprite base de personaje (px "lógicos")
export const SPRITE_H = 24;
export const ESCALA_SPRITE = 2; // se dibuja a 32×48

export const PASO_MS = 125; // duración de un paso (máx. 8 pasos/s)
export const FRAME_CAMINAR_MS = 150; // velocidad de la animación de caminar en pantallas de UI

export const DIRECCIONES = ['abajo', 'izquierda', 'derecha', 'arriba'];

export const COLOR_CONTORNO = '#2a1e17';

// Pelo y piel se derivan del id del jugador (ver apariencia() en sprites.js).
export const PELOS = ['#2b2422', '#4a2f22', '#7a4a2a', '#d9a55b', '#a3472a'];
export const PIELES = ['#ffe0c8', '#f5c9a3', '#e0a87e', '#b97c55', '#8a5638'];

export const RETRATOS = [
    'claude_normal', 'claude_feliz', 'claude_pensativa',
    'code_normal', 'code_guino', 'code_bug',
];

export const TIMEOUT_REVERB_MS = 8000;
