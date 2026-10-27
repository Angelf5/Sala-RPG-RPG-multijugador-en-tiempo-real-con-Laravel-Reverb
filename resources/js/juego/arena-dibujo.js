// Arte de la arena de duelos, todo generado por código (mismo estilo que la biblioteca:
// píxeles lógicos de 16 por celda, cada uno ocupa 2 px reales).
//   dibujarArena(mapa)              → canvas offscreen con todo lo que no se mueve
//   dibujarLuces(ctx, mapa, t)      → llamas y resplandor de antorchas y braseros (cada frame)

import { TILE } from './config.js';
import { Pincel, aleatorio, conContorno, crearCanvas, dibujarGrilla } from './pixel.js';

const C = 16;
const ESC = TILE / C;

const ARENA = { base: '#d6b57a', claro: '#e3c690', oscuro: '#c2a064', piedrita: '#a88c5c' };
const PIEDRA = { base: '#8a8790', junta: '#5e5b66', luz: '#a5a2ab', sombra: '#6c6974', borde: '#2a2a30' };
const MADERA = { clara: '#a8714a', media: '#8a5a3b', oscura: '#6b4430', borde: '#2a1e17' };
const SOMBRA = 'rgba(0, 0, 0, 0.22)';

function piso(p, mapa) {
    const azar = aleatorio(31);
    p.rect(C, C, (mapa.ancho - 2) * C, (mapa.alto - 2) * C, ARENA.base);
    // Granitos y piedritas: la arena no es lisa.
    for (let i = 0; i < 2600; i++) {
        const x = C + Math.floor(azar() * (mapa.ancho - 2) * C);
        const y = C + Math.floor(azar() * (mapa.alto - 2) * C);
        const r = azar();
        if (r < 0.45) p.rect(x, y, 1, 1, ARENA.claro);
        else if (r < 0.9) p.rect(x, y, 1, 1, ARENA.oscuro);
        else p.rect(x, y, 2, 1, ARENA.piedrita);
    }
}

function muro(p, mapa) {
    for (let y = 1; y <= 2; y++) {
        for (let x = 1; x < mapa.ancho - 1; x++) {
            const tipo = mapa.infoCelda(x, y).tipo;
            if (tipo === 'arena') continue; // el pasillo del portón
            const X = x * C, Y = y * C;
            p.rect(X, Y, C, C, PIEDRA.base);
            // Bloques de piedra de 8×4, desfasados fila por medio.
            for (let fy = 0; fy < C; fy += 4) {
                const desfase = ((y * 4 + fy / 4) % 2) * 4;
                p.rect(X, Y + fy + 3, C, 1, PIEDRA.junta);
                for (let fx = -desfase; fx < C; fx += 8) if (fx >= 0) p.rect(X + fx, Y + fy, 1, 3, PIEDRA.junta);
                p.rect(X, Y + fy, C, 1, 'rgba(255, 255, 255, 0.06)');
            }
        }
    }
    // Almenas arriba y sombra del muro sobre la arena.
    for (let x = C; x < (mapa.ancho - 1) * C; x += 8) p.rect(x, C, 5, 2, PIEDRA.luz);
    p.rect(C, 3 * C, (mapa.ancho - 2) * C, 3, 'rgba(0, 0, 0, 0.22)');
}

function bordes(p, mapa) {
    const ancho = mapa.ancho * C, alto = mapa.alto * C;
    p.rect(0, 0, ancho, C, PIEDRA.borde);
    p.rect(0, 0, C, alto, PIEDRA.borde);
    p.rect(ancho - C, 0, C, alto, PIEDRA.borde);
    p.rect(0, alto - C, ancho, C, PIEDRA.borde);
    p.rect(C - 2, C, 2, alto - 2 * C, '#3d3b44');
    p.rect(ancho - C, C, 2, alto - 2 * C, '#3d3b44');
    p.rect(C, alto - C, ancho - 2 * C, 2, '#3d3b44');
}

function porton(p, { x, w }) {
    const X = x * C, W = w * C;
    // Columnas de piedra a los costados del pasillo.
    for (const cx of [X - 5, X + W + 1]) {
        p.rect(cx, 2, 4, 3 * C - 2, PIEDRA.borde);
        p.rect(cx + 1, 3, 2, 3 * C - 4, PIEDRA.luz);
    }
    // Hueco oscuro con la reja levantada (barrotes solo arriba).
    p.rect(X, 0, W, C, '#15110e');
    for (let i = 2; i < W; i += 5) p.rect(X + i, 0, 2, 7, '#5d5a63');
    p.rect(X, 6, W, 2, '#5d5a63');
    p.rect(X - 1, 0, W + 2, 2, PIEDRA.borde);
}

const TROFEO = conContorno([
    'GGGGGGG',
    'gGGGGGg',
    '.GGGGG.',
    '..GGG..',
    '...G...',
    '..ggg..',
    '.GGGGG.',
]);

function cartelRanking(p, { x, y, w, h }) {
    const X = x * C + 1, Y = y * C + 2, W = w * C - 2, H = h * C - 5;
    p.rect(X + 2, Y + H, W - 4, 2, SOMBRA);
    p.rect(X, Y, W, H, MADERA.borde);
    p.rect(X + 1, Y + 1, W - 2, H - 2, '#d4a72c'); // marco dorado
    p.rect(X + 3, Y + 3, W - 6, H - 6, MADERA.oscura);
    p.rect(X + 3, Y + 3, W - 6, 1, MADERA.media);
    p.grilla(TROFEO, { G: '#f1c40f', g: '#b8860b' }, X + 5, Y + 7);
    p.texto('RANKING', X + W / 2 + 6, Y + 13, { color: '#f3e6d0' });
    p.texto('TOP 10', X + W / 2 + 6, Y + 21, { color: '#d4a72c' });
}

/** Antorcha en el muro: soporte + palo. La llama se anima en dibujarLuces. */
function antorcha(p, { x, y }) {
    const X = x * C, Y = y * C;
    p.rect(X + 6, Y + 8, 4, 2, '#3b3b40');
    p.rect(X + 7, Y + 4, 2, 9, MADERA.oscura);
    p.rect(X + 6, Y + 3, 4, 2, '#3b3b40');
}

function brasero(p, { x, y }) {
    const X = x * C, Y = y * C;
    p.rect(X + 2, Y + 14, 12, 2, SOMBRA);
    p.rect(X + 6, Y + 9, 4, 5, PIEDRA.borde); // pie
    p.rect(X + 7, Y + 9, 2, 5, PIEDRA.sombra);
    p.rect(X + 1, Y + 5, 14, 5, PIEDRA.borde); // cuenco
    p.rect(X + 2, Y + 5, 12, 3, PIEDRA.base);
    p.rect(X + 2, Y + 5, 12, 1, PIEDRA.luz);
    p.rect(X + 3, Y + 4, 10, 2, '#3a2a20'); // brasas
}

function banco(p, { x, y, w }) {
    const X = x * C, Y = y * C, W = w * C;
    p.rect(X + 2, Y + 13, W - 4, 2, SOMBRA);
    p.rect(X + 3, Y + 8, 2, 6, MADERA.borde);
    p.rect(X + W - 5, Y + 8, 2, 6, MADERA.borde);
    p.rect(X + 1, Y + 3, W - 2, 6, MADERA.borde);
    p.rect(X + 2, Y + 4, W - 4, 4, MADERA.clara);
    p.rect(X + 2, Y + 6, W - 4, 1, MADERA.media);
}

// Espadas cruzadas pintadas en el centro del ring.
const ESPADAS = [
    'H.........H',
    '.H.......H.',
    '..H.....H..',
    '...H...H...',
    '....H.H....',
    '.....X.....',
    '....H.H....',
    '..GG...GG..',
    '.GG.....GG.',
    'M.........M',
];

function ring(p, { x, y, w, h }) {
    const X = x * C, Y = y * C, W = w * C, H = h * C;
    p.rect(X, Y, W, H, '#e0c288');
    // Rastrillado: líneas suaves horizontales.
    for (let ly = Y + 3; ly < Y + H; ly += 6) p.rect(X + 2, ly, W - 4, 1, 'rgba(160, 120, 60, 0.18)');
    // Cuerda roja y blanca alrededor.
    for (let i = 0; i < W; i += 4) {
        const color = (i / 4) % 2 ? '#f3e6d0' : '#c0392b';
        p.rect(X + i, Y, 4, 2, color);
        p.rect(X + i, Y + H - 2, 4, 2, color);
    }
    for (let i = 0; i < H; i += 4) {
        const color = (i / 4) % 2 ? '#f3e6d0' : '#c0392b';
        p.rect(X, Y + i, 2, 4, color);
        p.rect(X + W - 2, Y + i, 2, 4, color);
    }
    // Postes en las esquinas.
    for (const [px, py] of [[X - 1, Y - 3], [X + W - 4, Y - 3], [X - 1, Y + H - 4], [X + W - 4, Y + H - 4]]) {
        p.rect(px, py, 5, 7, MADERA.borde);
        p.rect(px + 1, py + 1, 3, 5, '#c0392b');
        p.rect(px + 1, py + 1, 3, 1, '#e8735f');
    }
    // Emblema: espadas cruzadas pintadas en la arena (a doble tamaño, como pintura en el piso).
    const ex = X + Math.floor(W / 2) - 11, ey = Y + Math.floor(H / 2) - 10;
    const pintura = { H: 'rgba(120, 75, 35, 0.4)', X: 'rgba(150, 40, 30, 0.55)', G: 'rgba(120, 75, 35, 0.4)', M: 'rgba(120, 75, 35, 0.35)' };
    dibujarGrilla(p.ctx, ESPADAS, pintura, ex * ESC, ey * ESC, ESC * 2);

}

export function dibujarArena(mapa) {
    const canvas = crearCanvas(mapa.ancho * TILE, mapa.alto * TILE);
    const p = new Pincel(canvas.getContext('2d'), ESC);

    piso(p, mapa);
    mapa.bloques('o').forEach((b) => ring(p, b));
    muro(p, mapa);
    bordes(p, mapa);
    mapa.bloques('@').forEach((b) => porton(p, b));
    mapa.bloques('R').forEach((b) => cartelRanking(p, b));
    mapa.bloques('i').forEach((b) => antorcha(p, b));
    mapa.bloques('f').forEach((b) => brasero(p, b));
    mapa.bloques('h').forEach((b) => banco(p, b));

    return canvas;
}

// ───────────── Fuego animado (se dibuja en cada frame) ─────────────

const fuegos = new WeakMap(); // mapa → lista de { x, y, tipo } (se calcula una vez)

function listaDeFuegos(mapa) {
    if (!fuegos.has(mapa)) {
        fuegos.set(mapa, [
            ...mapa.bloques('i').map(({ x, y }) => ({ x, y, tipo: 'antorcha' })),
            ...mapa.bloques('f').map(({ x, y }) => ({ x, y, tipo: 'brasero' })),
        ]);
    }
    return fuegos.get(mapa);
}

/** Llamas que titilan + un resplandor cálido alrededor. En coordenadas del mundo. */
export function dibujarLuces(ctx, mapa, t) {
    for (const [i, f] of listaDeFuegos(mapa).entries()) {
        const cx = f.x * TILE + TILE / 2;
        const base = f.y * TILE + (f.tipo === 'antorcha' ? 6 : 8);
        const titileo = Math.sin(t / 90 + i * 1.7) * 0.5 + Math.sin(t / 37 + i) * 0.5; // -1..1
        const alto = (f.tipo === 'antorcha' ? 10 : 12) + Math.round(titileo * 2) * 2;

        // Resplandor: rectángulos concéntricos (pixelado, sin degradados borrosos). En el muro
        // no sube más allá del borde de arriba, para que no se vea un cuadrado sobre el techo.
        const radios = f.tipo === 'antorcha' ? [[22, 0.05], [14, 0.07], [8, 0.09]] : [[30, 0.05], [20, 0.07], [12, 0.09]];
        for (const [r, a] of radios) {
            const arriba = Math.max(base - r, TILE);
            ctx.fillStyle = `rgba(255, 170, 60, ${a + titileo * 0.015})`;
            ctx.fillRect(cx - r, arriba, r * 2, base + r - arriba);
        }
        // Llama de tres capas, de afuera hacia adentro.
        ctx.fillStyle = '#e2541b';
        ctx.fillRect(cx - 6, base - alto, 12, alto);
        ctx.fillStyle = '#f5a623';
        ctx.fillRect(cx - 4, base - alto + 4, 8, alto - 4);
        ctx.fillStyle = '#ffe28a';
        ctx.fillRect(cx - 2, base - alto + 8, 4, Math.max(2, alto - 8));
        // Chispa que sube.
        if (titileo > 0.6) {
            ctx.fillStyle = '#ffd34d';
            ctx.fillRect(cx + Math.round(titileo * 4) - 2, base - alto - 6, 2, 2);
        }
    }
}
