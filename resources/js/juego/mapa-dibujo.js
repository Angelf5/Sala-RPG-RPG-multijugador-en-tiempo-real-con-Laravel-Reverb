// Arte de la habitación, todo generado por código. Se dibuja UNA vez en un canvas offscreen
// y después cada frame solo se copia (drawImage), que es muchísimo más barato.
//
// Coordenadas en píxeles lógicos: cada celda mide 16 y cada píxel lógico ocupa 2 px reales,
// el mismo tamaño de píxel que los sprites de los personajes.

import { TILE } from './config.js';
import { icono } from './iconos.js';
import { Pincel, aleatorio, conContorno, crearCanvas, mezclar, oscurecer } from './pixel.js';
import { dibujarArena } from './arena-dibujo.js';

const C = 16; // celda en píxeles lógicos
const ESC = TILE / C; // 2

const MADERA = { clara: '#a8714a', media: '#8a5a3b', oscura: '#6b4430', muyOscura: '#4a2f22', borde: '#2a1e17' };
const PARED = { base: '#d8c3a0', cuadrito: '#d0b993', luz: '#e6d5b5' };
const SOMBRA = 'rgba(0, 0, 0, 0.2)';

// La sala que se está dibujando (la biblioteca). Las funciones de abajo leen sus bloques.
let M;

// ───────────── Piso, pared y bordes ─────────────

function piso(p) {
    const azar = aleatorio(7);
    const tonos = [MADERA.clara, '#a06b46', '#ad774f', '#9c6843'];
    const x0 = C, x1 = (M.ancho - 1) * C;
    // Tablas horizontales de 4 px de alto, con largos al azar y juntas desfasadas.
    for (let y = 3 * C; y < (M.alto - 1) * C; y += 4) {
        let x = x0 - Math.floor(azar() * 30);
        while (x < x1) {
            const largo = 22 + Math.floor(azar() * 24);
            const desde = Math.max(x, x0);
            const hasta = Math.min(x + largo, x1);
            p.rect(desde, y, hasta - desde, 3, tonos[Math.floor(azar() * tonos.length)]);
            p.rect(desde, y, hasta - desde, 1, 'rgba(255, 255, 255, 0.06)');
            p.rect(desde, y + 3, hasta - desde, 1, '#7a4d32'); // junta horizontal
            if (hasta < x1) p.rect(hasta - 1, y, 1, 3, '#7a4d32'); // junta vertical
            x += largo;
        }
    }
}

function pared(p) {
    const x0 = C, ancho = (M.ancho - 2) * C;
    // Empapelado a cuadritos.
    for (let y = C; y < 3 * C; y += 4) {
        for (let x = x0; x < x0 + ancho; x += 4) {
            p.rect(x, y, 4, 4, ((x + y) / 4) % 2 ? PARED.cuadrito : PARED.base);
        }
    }
    // Moldura de arriba y zócalo de madera.
    p.rect(x0, C, ancho, 3, MADERA.media);
    p.rect(x0, C + 3, ancho, 1, MADERA.oscura);
    p.rect(x0, 3 * C - 6, ancho, 6, MADERA.oscura);
    p.rect(x0, 3 * C - 6, ancho, 1, MADERA.clara);
    p.rect(x0, 3 * C - 1, ancho, 1, MADERA.muyOscura);
    // Sombra que la pared proyecta sobre el piso.
    p.rect(x0, 3 * C, ancho, 3, 'rgba(0, 0, 0, 0.18)');
}

function bordes(p) {
    const ancho = M.ancho * C, alto = M.alto * C;
    p.rect(0, 0, ancho, C, MADERA.borde);
    p.rect(0, C - 2, ancho, 2, MADERA.muyOscura);
    p.rect(0, 0, C, alto, MADERA.borde);
    p.rect(C - 2, C, 2, alto - 2 * C, MADERA.muyOscura);
    p.rect(ancho - C, 0, C, alto, MADERA.borde);
    p.rect(ancho - C, C, 2, alto - 2 * C, MADERA.muyOscura);
    p.rect(0, alto - C, ancho, C, MADERA.borde);
    p.rect(C, alto - C, ancho - 2 * C, 2, MADERA.muyOscura);
}

function puerta(p, { x, y, w }) {
    const X = x * C, Y = y * C, W = w * C;
    p.rect(X, Y, W, C, MADERA.media); // hueco de la puerta
    for (let i = 3; i < C; i += 4) p.rect(X, Y + i, W, 1, '#7a4d32');
    p.rect(X - 2, Y, 2, C, MADERA.oscura); // marco
    p.rect(X + W, Y, 2, C, MADERA.oscura);
    // Felpudo justo adentro (ahí aparecés al entrar).
    p.rect(X + 3, Y - 8, W - 6, 7, '#7a3b2e');
    p.rect(X + 4, Y - 7, W - 8, 1, '#9c4a3a');
    p.rect(X + 4, Y - 3, W - 8, 1, '#9c4a3a');
}

// ───────────── Alfombra ─────────────

function alfombra(p, { x, y, w, h }) {
    const X = x * C, Y = y * C, W = w * C, H = h * C;
    const cx = X + W / 2, cy = Y + H / 2;
    // Flecos a los costados.
    for (let i = Y + 2; i < Y + H - 2; i += 3) {
        p.rect(X - 2, i, 2, 1, '#e8e8e8');
        p.rect(X + W, i, 2, 1, '#e8e8e8');
    }
    p.rect(X, Y, W, H, '#3a3a3a');
    p.rect(X + 1, Y + 1, W - 2, H - 2, '#6a6a6a');
    p.rect(X + 4, Y + 4, W - 8, H - 8, '#f2f2f2');
    // Rombos concéntricos: el color depende de la "distancia Manhattan" al centro.
    for (let py = Y + 5; py < Y + H - 5; py++) {
        for (let px = X + 5; px < X + W - 5; px++) {
            const d = (Math.abs(px - cx + 0.5) + Math.abs(py - cy + 0.5)) % 12;
            const color = d < 1.5 ? '#f2f2f2' : d < 6 ? '#bdbdbd' : '#8e8e8e';
            p.rect(px, py, 1, 1, color);
        }
    }
}

// ───────────── Cosas de la pared ─────────────

const VARIANTES_CUADRO = [
    { cielo: '#8ecae6', cerro: '#5a8f5a', cerro2: '#4f7d4f', astro: '#f1c40f', marco: '#c9a227', fondo: '#f3e6d0', flor: '#e74c3c' },
    { cielo: '#2c3e6e', cerro: '#3b4d3b', cerro2: '#2f3f2f', astro: '#f3e6d0', marco: MADERA.oscura, fondo: '#1abc9c', flor: '#f1c40f' },
];

function cuadros(p, { x, y }, i) {
    const X = x * C, Y = y * C;
    const v = VARIANTES_CUADRO[i % VARIANTES_CUADRO.length];
    // Paisaje apaisado.
    p.rect(X + 3, Y + 19, 16, 1, SOMBRA);
    p.rect(X + 2, Y + 6, 16, 13, MADERA.muyOscura);
    p.rect(X + 3, Y + 7, 14, 11, v.cielo);
    p.rect(X + 3, Y + 14, 14, 4, v.cerro);
    p.rect(X + 6, Y + 12, 7, 2, v.cerro2);
    p.rect(X + 8, Y + 11, 3, 1, v.cerro2);
    p.rect(X + 13, Y + 8, 2, 2, v.astro);
    // Cuadrito vertical con una flor.
    p.rect(X + 21, Y + 19, 10, 1, SOMBRA);
    p.rect(X + 20, Y + 5, 10, 14, v.marco);
    p.rect(X + 21, Y + 6, 8, 12, v.fondo);
    p.rect(X + 25, Y + 11, 1, 5, '#3e8e41');
    p.rect(X + 23, Y + 13, 2, 1, '#3e8e41');
    p.rect(X + 24, Y + 8, 3, 3, v.flor);
    p.rect(X + 25, Y + 9, 1, 1, '#ffffff');
    p.rect(X + 23, Y + 16, 5, 2, '#c4673f');
}

// Mini Claude para el poster (pelo cobrizo, anteojos, suéter crema, bufanda terracota).
const MINI_CLAUDE = conContorno([
    '....HHHH....',
    '..HHHHHHHH..',
    '.HHHHHHHHHH.',
    '.HHSSSSSSHH.',
    '.HGGSSSSGGH.',
    '.HGEGSSGEGH.',
    '.HSSSSSSSSH.',
    '.HHSSMMSSHH.',
    '.HH.SSSS.HH.',
    '.HFFFFFFFFH.',
    'HKKKFFFFKKKH',
    'HKKKKFfKKKKH',
    'KKKKKKKKKKKK',
]);
const PALETA_MINI_CLAUDE = {
    H: '#b5532a', S: '#f5d0b0', G: '#d4a72c', E: '#2a1e17', M: '#b4443c',
    F: '#e07a50', f: '#a8502c', K: '#eadcc2',
};

function marcoPoster(p, X, Y, fondo) {
    const x0 = X + 2, y0 = Y + 4, w = 60, h = 22;
    p.rect(x0 + 1, y0 + 1, w, h, 'rgba(0, 0, 0, 0.25)');
    p.rect(x0, y0, w, h, MADERA.borde);
    p.rect(x0 + 1, y0 + 1, w - 2, h - 2, fondo);
    // Cinta para pegarlo a la pared.
    p.rect(x0 + 3, y0 - 1, 5, 2, 'rgba(243, 230, 208, 0.85)');
    p.rect(x0 + w - 8, y0 - 1, 5, 2, 'rgba(243, 230, 208, 0.85)');
    return { x0, y0, w, h };
}

function posterClaude(p, { x, y }) {
    const { x0, y0, w } = marcoPoster(p, x * C, y * C, '#c4673f');
    p.grilla(MINI_CLAUDE, PALETA_MINI_CLAUDE, x0 + 3, y0 + 3);
    p.texto('CLAUDE', x0 + 18 + (w - 20) / 2, y0 + 13, { color: '#f3e6d0' });
}

function posterTup(p, { x, y }, imagen) {
    const { x0, y0, w, h } = marcoPoster(p, x * C, y * C, '#1d2b53');
    if (imagen) {
        p.ctx.drawImage(imagen, (x0 + 1) * ESC, (y0 + 1) * ESC, (w - 2) * ESC, (h - 2) * ESC);
        return;
    }
    p.rect(x0 + 2, y0 + 2, w - 4, h - 4, '#f3e6d0');
    p.rect(x0 + 3, y0 + 3, w - 6, h - 6, '#1d2b53');
    p.texto('TUP', x0 + w / 2, y0 + 12.5, { tam: 16, color: '#ffffff' });
    p.texto('UTN · FORMOSA', x0 + w / 2, y0 + 18, { color: '#f1c40f', maxAncho: w - 8 });
}

// ───────────── Muebles ─────────────

/** Tramo más largo de pared lisa ('w') en la fila 1, entre las columnas del estante. */
function tramoDeParedLibre(x, w) {
    let mejor = { desde: x, largo: w }; // si no hay pared libre, se centra en el estante
    let mejorLargo = 0;
    for (let i = x; i < x + w; i++) {
        let j = i;
        while (j < x + w && M.celda(j, 1) === 'w') j++;
        if (j - i > mejorLargo) {
            mejorLargo = j - i;
            mejor = { desde: i, largo: j - i };
        }
    }
    return mejor;
}

function estante(p, { x, y, w, h }, slug, datos, semilla) {
    const X = x * C, Y = y * C, W = w * C, H = h * C;
    const arriba = Y - 10; // el mueble es alto: tapa parte del zócalo
    const azar = aleatorio(semilla);
    const color = datos?.color ?? '#888888';

    p.rect(X + 1, Y + H, W - 2, 2, SOMBRA);
    p.rect(X, arriba, W, H + 10, MADERA.borde);
    p.rect(X + 1, arriba + 1, W - 2, H + 8, MADERA.oscura);
    p.rect(X + 1, arriba + 1, W - 2, 2, MADERA.clara);

    // 3 compartimentos con libros.
    for (let i = 0; i < 3; i++) {
        const cy = arriba + 4 + i * 12;
        const ix = X + 3, iw = W - 6;
        p.rect(ix, cy, iw, 10, '#2e1f16');
        let bx = ix;
        while (bx < ix + iw - 1) {
            if (azar() < 0.07) { bx += 2; continue; } // un hueco
            const bw = Math.min(2 + Math.floor(azar() * 3), ix + iw - bx);
            const bh = 6 + Math.floor(azar() * 4);
            const r = azar();
            const tono = r < 0.12 ? '#eadcc2'
                : r < 0.55 ? mezclar(color, '#ffffff', azar() * 0.35)
                    : oscurecer(color, azar() * 0.4);
            p.rect(bx, cy + 10 - bh, bw, bh, tono);
            p.rect(bx, cy + 12 - bh, bw, 1, oscurecer(tono, 0.25)); // franja del lomo
            if (bw > 1) p.rect(bx + bw - 1, cy + 10 - bh, 1, bh, oscurecer(tono, 0.3));
            bx += bw;
        }
        p.rect(X + 2, cy + 10, W - 4, 2, MADERA.media); // estante
    }
    p.rect(X + 1, Y + H - 2, W - 2, 1, MADERA.muyOscura);

    // Cartelito con el ícono pixel art, colgado en la pared justo encima del estante.
    const { grilla, paleta } = icono(slug, color);
    const pw = grilla[0].length + 4;
    const ph = 15;
    // Se centra en el tramo de pared lisa más largo arriba del estante (para no tapar posters ni cuadros).
    const tramo = tramoDeParedLibre(x, w);
    const sx = Math.floor((tramo.desde * C) + (tramo.largo * C - pw) / 2);
    const sy = arriba - ph - 1;
    p.rect(sx + 1, sy + 1, pw, ph, 'rgba(0, 0, 0, 0.2)');
    p.rect(sx, sy, pw, ph, MADERA.borde);
    p.rect(sx + 1, sy + 1, pw - 2, ph - 2, '#f3e6d0');
    p.rect(sx + 1, sy + ph - 3, pw - 2, 2, color);
    p.grilla(grilla, paleta, sx + 2, sy + 1 + Math.floor((11 - grilla.length) / 2));
}

function escritorio(p, { x, y, w, h }) {
    const X = x * C, Y = y * C, W = w * C, H = h * C;
    p.rect(X + 2, Y + H - 1, W - 4, 2, SOMBRA);
    // Patas y cajonera.
    p.rect(X + 2, Y + 16, 3, 14, MADERA.muyOscura);
    p.rect(X + W - 24, Y + 16, 21, 14, MADERA.borde);
    p.rect(X + W - 23, Y + 17, 19, 12, MADERA.oscura);
    p.rect(X + W - 23, Y + 22, 19, 1, MADERA.muyOscura);
    p.rect(X + W - 15, Y + 19, 3, 1, '#d4a72c');
    p.rect(X + W - 15, Y + 25, 3, 1, '#d4a72c');
    // Tablero.
    p.rect(X, Y + 3, W, 15, MADERA.borde);
    p.rect(X + 1, Y + 4, W - 2, 11, MADERA.clara);
    p.rect(X + 1, Y + 4, W - 2, 1, '#c08a5e');
    p.rect(X + 1, Y + 15, W - 2, 2, MADERA.media);
    // Gabinete de la PC.
    p.rect(X + W - 12, Y - 6, 9, 19, MADERA.borde);
    p.rect(X + W - 11, Y - 5, 7, 17, '#2e2e38');
    p.rect(X + W - 10, Y - 3, 5, 1, '#45454f');
    p.rect(X + W - 10, Y - 1, 5, 1, '#45454f');
    p.rect(X + W - 9, Y + 9, 2, 1, '#3dff7a');
    // Monitor con brillo verde de terminal.
    p.rect(X + 13, Y - 7, 30, 18, 'rgba(61, 255, 122, 0.10)');
    p.rect(X + 26, Y + 6, 5, 3, '#2b2b33');
    p.rect(X + 15, Y - 5, 27, 13, '#1b1b22');
    p.rect(X + 17, Y - 3, 23, 9, '#0b1a10');
    [[8, -2], [14, 0], [10, 2]].forEach(([largo, dy]) => p.rect(X + 18, Y + dy, largo, 1, '#3dff7a'));
    p.rect(X + 18, Y + 4, 2, 1, '#3dff7a');
    p.rect(X + 21, Y + 4, 2, 1, '#b8ffcf'); // cursor
    // Teclado, mouse y taza.
    p.rect(X + 19, Y + 9, 19, 4, '#9a9a9a');
    p.rect(X + 20, Y + 10, 17, 1, '#e0e0e0');
    p.rect(X + 20, Y + 12, 17, 1, '#cfcfcf');
    p.rect(X + 41, Y + 10, 3, 3, '#e0e0e0');
    p.rect(X + 5, Y + 6, 5, 6, MADERA.borde);
    p.rect(X + 6, Y + 7, 3, 4, '#f3e6d0');
    p.rect(X + 6, Y + 7, 3, 1, MADERA.oscura);
    p.rect(X + 9, Y + 8, 2, 2, '#f3e6d0');
}

const SILLON = { base: '#9c4a3a', sombra: '#7a3b2e', luz: '#b85c48' };

function sillon(p, { x, y, w }, mirandoAbajo) {
    const X = x * C, Y = y * C, W = w * C, H = C;
    p.rect(X + 1, Y + H + (mirandoAbajo ? 0 : 3), W - 2, 2, SOMBRA);
    if (mirandoAbajo) {
        p.rect(X, Y - 4, W, H + 4, MADERA.borde);
        p.rect(X + 1, Y - 3, W - 2, 8, SILLON.sombra); // respaldo
        p.rect(X + 1, Y - 3, W - 2, 1, SILLON.base);
        p.rect(X + 6, Y + 5, W - 12, H - 7, SILLON.base); // asiento
        p.rect(X + 6, Y + 5, W - 12, 1, SILLON.luz);
        p.rect(X + 1, Y - 1, 5, H, SILLON.base); // apoyabrazos
        p.rect(X + W - 6, Y - 1, 5, H, SILLON.base);
        p.rect(X + 1, Y - 1, 5, 1, SILLON.luz);
        p.rect(X + W - 6, Y - 1, 5, 1, SILLON.luz);
        p.rect(X + 1, Y + H - 2, W - 2, 1, SILLON.sombra);
    } else {
        p.rect(X, Y, W, H + 3, MADERA.borde);
        p.rect(X + 6, Y + 1, W - 12, 8, SILLON.base); // asiento
        p.rect(X + 6, Y + 1, W - 12, 1, SILLON.luz);
        p.rect(X + 1, Y + 9, W - 2, H - 7, SILLON.sombra); // respaldo
        p.rect(X + 1, Y + 9, W - 2, 1, SILLON.luz);
        p.rect(X + 1, Y + 1, 5, H - 2, SILLON.base);
        p.rect(X + W - 6, Y + 1, 5, H - 2, SILLON.base);
        p.rect(X + 1, Y + 1, 5, 1, SILLON.luz);
        p.rect(X + W - 6, Y + 1, 5, 1, SILLON.luz);
    }
    // Costuras entre almohadones.
    const ay = mirandoAbajo ? Y + 5 : Y + 1;
    for (let i = 1; i < 3; i++) p.rect(X + 6 + Math.round(((W - 12) * i) / 3), ay, 1, 8, SILLON.sombra);
}

function mesa(p, { x, y, w }) {
    const X = x * C, Y = y * C, W = w * C;
    p.rect(X + 3, Y + 14, W - 6, 2, SOMBRA);
    p.rect(X + 4, Y + 11, 2, 4, MADERA.muyOscura);
    p.rect(X + W - 6, Y + 11, 2, 4, MADERA.muyOscura);
    p.rect(X + 2, Y + 3, W - 4, 10, MADERA.borde);
    p.rect(X + 3, Y + 4, W - 6, 6, MADERA.clara);
    p.rect(X + 3, Y + 10, W - 6, 2, MADERA.oscura);
    // Un libro y una taza arriba.
    p.rect(X + 7, Y + 5, 8, 4, '#3b6fd8');
    p.rect(X + 7, Y + 8, 8, 1, '#f3e6d0');
    p.rect(X + 20, Y + 5, 3, 4, '#eadcc2');
    p.rect(X + 20, Y + 5, 3, 1, MADERA.oscura);
}

function lampara(p, { x, y }) {
    const X = x * C, Y = y * C;
    // Luz cálida alrededor de la pantalla de la lámpara.
    p.rect(X - 1, Y - 2, 18, 12, 'rgba(255, 214, 140, 0.10)');
    p.rect(X + 2, Y, 12, 8, 'rgba(255, 214, 140, 0.12)');
    p.rect(X + 4, Y + 14, 8, 2, SOMBRA);
    // Base y pie.
    p.rect(X + 4, Y + 12, 8, 3, MADERA.borde);
    p.rect(X + 5, Y + 12, 6, 2, '#3a3a44');
    p.rect(X + 7, Y + 6, 2, 7, MADERA.borde);
    p.rect(X + 7, Y + 6, 1, 7, '#c9a227');
    // Pantalla (trapecio), más angosta arriba.
    p.rect(X + 5, Y, 6, 1, MADERA.borde);
    p.rect(X + 4, Y + 1, 8, 1, MADERA.borde);
    p.rect(X + 3, Y + 2, 10, 5, MADERA.borde);
    p.rect(X + 6, Y + 1, 4, 1, '#f6e3b4');
    p.rect(X + 5, Y + 2, 6, 1, '#f6e3b4');
    p.rect(X + 4, Y + 3, 8, 3, '#efd28f');
    p.rect(X + 4, Y + 5, 8, 1, '#d9b46a');
}

function pilaDeLibros(p, { x, y }) {
    const X = x * C, Y = y * C;
    p.rect(X + 2, Y + 14, 12, 2, SOMBRA);
    // De abajo hacia arriba: cada libro un poco corrido, con las páginas a la vista.
    [
        { dx: 1, w: 13, color: '#3b6fd8' },
        { dx: 2, w: 11, color: '#c0392b' },
        { dx: 1, w: 12, color: '#27ae60' },
        { dx: 3, w: 10, color: '#e6a817' },
    ].forEach(({ dx, w, color }, i) => {
        const by = Y + 11 - i * 4;
        p.rect(X + dx, by, w, 4, MADERA.borde);
        p.rect(X + dx + 1, by + 1, w - 2, 2, color);
        p.rect(X + dx + w - 3, by + 1, 2, 2, '#f3e6d0');
    });
}

// Easter egg: un diario arrugado tirado en el piso (celda caminable, sin "!").
const DIARIO = conContorno([
    '....CCCCC.....',
    '..CCcCCCCCc...',
    '.CcCCLLLCCcC..',
    'CCCLLLLLLCCCc.',
    '.cCCLLcLLLCCC.',
    '.CCCCLLLLCcC..',
    '..CcCCCCCCC...',
    '...CCcCC.cC...',
]);
const PALETA_DIARIO = { C: '#e9dfc3', c: '#bfb294', L: '#7d7466', O: '#4a3a2c' };

function diario(p, { x, y }) {
    p.rect(x * C + 2, y * C + 12, 13, 2, SOMBRA);
    p.grilla(DIARIO, PALETA_DIARIO, x * C, y * C + 3);
}

const PLANTA = conContorno([
    '.....g..g.....',
    '...g.Gg.Gg.g..',
    '..gGgGGgGGgG..',
    '.gGGgGGGgGGGg.',
    '.GGgGGGgGGgGG.',
    '..GGgGGGgGGg..',
    '...gGGgGGgG...',
    '....gGGGGg....',
    '....RRRRRR....',
    '...rRRRRRRr...',
    '....RRRRRR....',
    '....rRRRRr....',
    '.....RRRR.....',
]);
const PALETA_PLANTA = { G: '#5fb35f', g: '#3e8e41', R: '#c4673f', r: '#9c4a2a' };

function planta(p, { x, y }) {
    p.rect(x * C + 4, y * C + 14, 8, 2, SOMBRA);
    p.grilla(PLANTA, PALETA_PLANTA, x * C - 1, y * C + 1);
}

// ───────────── Todo junto ─────────────

/**
 * Dibuja la biblioteca completa en un canvas de 960×640.
 * `estantes`: datos de la BD por slug ({ color, icono }). `imagenTup`: poster opcional.
 */
function dibujarBiblioteca(mapa, { estantes = {}, imagenTup = null } = {}) {
    M = mapa;
    const canvas = crearCanvas(M.ancho * TILE, M.alto * TILE);
    const p = new Pincel(canvas.getContext('2d'), ESC);

    piso(p);
    M.bloques('r').forEach((b) => alfombra(p, b));
    pared(p);
    bordes(p);
    M.bloques('@').forEach((b) => puerta(p, b));
    M.bloques('c').forEach((b, i) => cuadros(p, b, i));
    M.bloques('P').forEach((b) => posterClaude(p, b));
    M.bloques('U').forEach((b) => posterTup(p, b, imagenTup));

    M.caracteresDe((info) => info.tipo === 'estante').forEach((c, i) => {
        const slug = M.leyenda[c].estante;
        M.bloques(c).forEach((b) => estante(p, b, slug, estantes[slug], 100 + i));
    });

    M.bloques('E').forEach((b) => escritorio(p, b));
    const filaMesa = M.bloques('m')[0]?.y ?? M.alto;
    M.bloques('s').forEach((b) => sillon(p, b, b.y < filaMesa));
    M.bloques('m').forEach((b) => mesa(p, b));
    M.bloques('b').forEach((b) => pilaDeLibros(p, b));
    M.bloques('l').forEach((b) => lampara(p, b));
    M.bloques('p').forEach((b) => planta(p, b));
    M.bloques('n').forEach((b) => diario(p, b));

    return canvas;
}

/** Arte de cada sala, dibujado una vez en un canvas offscreen. */
export function dibujarSala(mapa, opciones) {
    return mapa.slug === 'arena' ? dibujarArena(mapa) : dibujarBiblioteca(mapa, opciones);
}
