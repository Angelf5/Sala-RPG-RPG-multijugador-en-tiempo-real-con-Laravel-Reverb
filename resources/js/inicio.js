// Pantalla de inicio: vista previa del personaje caminando hacia abajo,
// que cambia en vivo al elegir chico/chica o el color.

import { ESCALA_SPRITE, FRAME_CAMINAR_MS, PELOS, PIELES, SPRITE_H, SPRITE_W } from './juego/config.js';
import { CICLO_CAMINAR, dibujarSombra, dibujarSprite, obtenerSprites } from './juego/sprites.js';

const ZOOM = 4; // la hoja ya viene ×2, así que cada píxel del sprite mide 8 px
const PIXEL = ESCALA_SPRITE * ZOOM;

const form = document.getElementById('form-entrar');
const canvas = document.getElementById('preview');
canvas.width = SPRITE_W * PIXEL;
canvas.height = (SPRITE_H + 1) * PIXEL; // +1 fila para la sombra que asoma bajo los pies
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Pelo y piel de muestra (los reales se derivan del id cuando entrás).
const muestra = { pelo: PELOS[2], piel: PIELES[1] };

function hojaActual() {
    const datos = new FormData(form);
    return obtenerSprites({
        genero: datos.get('genero') ?? 'chico',
        color: datos.get('color') ?? '#3498db',
        ...muestra,
    });
}

let hoja = hojaActual();
form.addEventListener('change', () => { hoja = hojaActual(); });

function animar(t) {
    const frame = CICLO_CAMINAR[Math.floor(t / FRAME_CAMINAR_MS) % CICLO_CAMINAR.length];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dibujarSombra(ctx, canvas.width / 2, SPRITE_H * PIXEL, PIXEL, 'rgba(0, 0, 0, 0.5)');
    dibujarSprite(ctx, hoja, 'abajo', frame, 0, 0, ZOOM);
    requestAnimationFrame(animar);
}
requestAnimationFrame(animar);
