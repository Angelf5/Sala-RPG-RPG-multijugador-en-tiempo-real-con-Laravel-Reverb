// Íconos pixel art de los estantes (9×9). Se usan en el cartelito del mapa
// y en el menú del estante, así siempre se ve el mismo dibujo.
//   o contorno · a color del estante · l color claro · w crema · g gris · f llama

import { conContorno, crearCanvas, dibujarGrilla, mezclar } from './pixel.js';

const DIBUJOS = {
    // Base de datos: discos apilados.
    'apis-datos': [
        '..ooooo..',
        '.olllllo.',
        '.oaaaaao.',
        '.olllllo.',
        '.oaaaaao.',
        '.olllllo.',
        '.oaaaaao.',
        '..ooooo..',
    ],
    // Candado.
    seguridad: [
        '...ggg...',
        '..g...g..',
        '..g...g..',
        '.ooooooo.',
        '.oaaaaao.',
        '.oaaoaao.',
        '.oaaoaao.',
        '.oaaaaao.',
        '.ooooooo.',
    ],
    // Rayo.
    'tiempo-real': [
        '.....ooo.',
        '....oaao.',
        '...oaao..',
        '..oaaoooo',
        '.oaaaaaao',
        '.ooooaao.',
        '....oaao.',
        '...oaao..',
        '...ooo...',
    ],
    // Cohete.
    despliegue: [
        '....o....',
        '...owo...',
        '..owwwo..',
        '..owlwo..',
        '..owwwo..',
        '.oawwwao.',
        '.oaowoao.',
        '..o.f.o..',
        '....f....',
    ],
};

// Si algún día se agrega un estante sin ícono propio: un libro.
const LIBRO = [
    '.ooooooo.',
    '.oaaaaao.',
    '.oawwwao.',
    '.oaaaaao.',
    '.oawwwao.',
    '.oaaaaao.',
    '.oaaaaao.',
    '.owwwwwo.',
    '.ooooooo.',
];

const cache = new Map();

/** Grilla (con contorno exterior) y paleta del ícono de un estante. */
export function icono(slug, color) {
    const clave = `${slug}|${color}`;
    if (!cache.has(clave)) {
        cache.set(clave, {
            grilla: conContorno(DIBUJOS[slug] ?? LIBRO),
            paleta: { o: '#2a1e17', a: color, l: mezclar(color, '#ffffff', 0.45), w: '#f3e6d0', g: '#8f8f8f', f: '#f07a1a' },
        });
    }
    return cache.get(clave);
}

/** Tamaño del ícono en píxeles lógicos (con el contorno). */
export const TAM_ICONO = 11;

/** Canvas con el ícono, para usarlo en HTML (menú del estante). */
export function iconoCanvas(slug, color, escala = 3) {
    const { grilla, paleta } = icono(slug, color);
    const canvas = crearCanvas(grilla[0].length * escala, grilla.length * escala);
    dibujarGrilla(canvas.getContext('2d'), grilla, paleta, 0, 0, escala);
    canvas.className = 'icono-pixel';
    return canvas;
}
