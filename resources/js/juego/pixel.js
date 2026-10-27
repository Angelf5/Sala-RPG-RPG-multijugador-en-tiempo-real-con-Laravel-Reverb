// Helpers para pixel art: todo el arte del juego se dibuja desde matrices de texto,
// donde cada carácter es un píxel y una paleta dice de qué color es cada carácter.

import { COLOR_CONTORNO } from './config.js';

/** Canvas (offscreen) con el suavizado apagado para que los píxeles queden nítidos. */
export function crearCanvas(ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext('2d').imageSmoothingEnabled = false;
    return canvas;
}

function aRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]) {
    return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Oscurece un color: factor 0.35 = 35 % más oscuro. */
export function oscurecer(hex, factor) {
    return aHex(aRgb(hex).map((c) => c * (1 - factor)));
}

/** Mezcla dos colores (t = 0 → a, t = 1 → b). */
export function mezclar(a, b, t) {
    const ca = aRgb(a);
    const cb = aRgb(b);
    return aHex(ca.map((c, i) => c + (cb[i] - c) * t));
}

/** Espeja una matriz horizontalmente (para sacar "izquierda" de "derecha"). */
export function espejar(filas) {
    return filas.map((fila) => [...fila].reverse().join(''));
}

/**
 * Superpone capas de matrices (las de después tapan a las de antes).
 * Cada capa es { filas: string[], desde: número de fila donde empieza }.
 * '.' es transparente.
 */
export function componer(ancho, alto, capas) {
    const grilla = Array.from({ length: alto }, () => Array(ancho).fill('.'));
    for (const { filas, desde = 0 } of capas) {
        filas.forEach((fila, i) => {
            const y = desde + i;
            if (y < 0 || y >= alto) return;
            for (let x = 0; x < ancho && x < fila.length; x++) {
                if (fila[x] !== '.') grilla[y][x] = fila[x];
            }
        });
    }
    return grilla;
}

/** Agrega contorno 'O' de 1px alrededor de todo lo que no sea transparente. */
export function contornear(grilla) {
    const alto = grilla.length;
    const ancho = grilla[0].length;
    const opaco = (x, y) => x >= 0 && y >= 0 && x < ancho && y < alto && grilla[y][x] !== '.' && grilla[y][x] !== 'O';
    return grilla.map((fila, y) => fila.map((c, x) => {
        if (c !== '.') return c;
        return opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1) ? 'O' : '.';
    }));
}

/** Dibuja una grilla (array de strings o de arrays) con su paleta. 'O' usa el color de contorno si la paleta no lo define. */
export function dibujarGrilla(ctx, grilla, paleta, ox = 0, oy = 0, escala = 1) {
    grilla.forEach((fila, y) => {
        [...fila].forEach((c, x) => {
            if (c === '.') return;
            const color = paleta[c] ?? (c === 'O' ? COLOR_CONTORNO : null);
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect(ox + x * escala, oy + y * escala, escala, escala);
        });
    });
}

/** Grilla con 1 píxel de margen y contorno alrededor, lista para dibujar. */
export function conContorno(filas) {
    const ancho = Math.max(...filas.map((f) => f.length)) + 2;
    return contornear(componer(ancho, filas.length + 2, [{ filas: filas.map((f) => '.' + f), desde: 1 }]));
}

/** Números pseudoaleatorios con semilla (mulberry32): mismo dibujo en todas las computadoras. */
export function aleatorio(semilla) {
    let a = semilla >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Pincel que dibuja en "píxeles lógicos": cada uno ocupa `escala` px reales.
 * Así el mapa tiene el mismo tamaño de píxel que los sprites (×2).
 */
export class Pincel {
    constructor(ctx, escala) {
        this.ctx = ctx;
        this.e = escala;
    }

    rect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.e, y * this.e, w * this.e, h * this.e);
    }

    grilla(grilla, paleta, x, y) {
        dibujarGrilla(this.ctx, grilla, paleta, x * this.e, y * this.e, this.e);
    }

    /** Texto en coordenadas lógicas (centro horizontal, línea base). */
    texto(texto, x, y, { tam = 8, color = '#fff', fuente = '"Press Start 2P"', maxAncho } = {}) {
        const ctx = this.ctx;
        ctx.font = `${tam}px ${fuente}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;
        ctx.fillText(texto, x * this.e, y * this.e, maxAncho ? maxAncho * this.e : undefined);
    }
}
