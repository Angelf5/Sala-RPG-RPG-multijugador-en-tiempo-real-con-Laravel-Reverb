// Globo de texto sobre la cabeza: 4 s en pantalla, máximo 2 líneas (cortado con "…").
// Se dibuja en el canvas con fillText, que nunca interpreta HTML (no hay riesgo de XSS).

import { TILE } from '../config.js';

const DURACION_MS = 4000;
const FADE_MS = 300;
const ANCHO_MAX = 200; // px de texto por línea (~25 caracteres en Press Start 2P de 8 px)
const LINEAS_MAX = 2;
const ALTO_LINEA = 12;
const PADDING = 6;
const FUENTE = '8px "Press Start 2P"';
// Zona visible en X (con cámara, solo una parte del mapa): los globos no se salen de ahí.
const visible = { desde: 0, hasta: 30 * TILE };

export function fijarZonaVisible(desde, hasta) {
    visible.desde = desde;
    visible.hasta = hasta;
}

/** Corta el texto en líneas que entren en ANCHO_MAX; si sobra, la última termina en "…". */
export function cortarEnLineas(ctx, texto, anchoMax = ANCHO_MAX, lineasMax = LINEAS_MAX) {
    ctx.font = FUENTE;
    const entra = (t) => ctx.measureText(t).width <= anchoMax;
    const lineas = [];
    let actual = '';

    // Palabras más largas que una línea se parten por caracteres.
    const palabras = texto.split(' ').flatMap((p) => {
        if (entra(p)) return [p];
        const trozos = [];
        let trozo = '';
        for (const c of p) {
            if (!entra(trozo + c)) { trozos.push(trozo); trozo = ''; }
            trozo += c;
        }
        return [...trozos, trozo];
    });

    for (const palabra of palabras) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (entra(prueba)) { actual = prueba; continue; }
        lineas.push(actual);
        actual = palabra;
    }
    if (actual) lineas.push(actual);

    if (lineas.length <= lineasMax) return lineas;
    const visibles = lineas.slice(0, lineasMax);
    let ultima = visibles[lineasMax - 1];
    while (ultima && !entra(`${ultima}…`)) ultima = [...ultima].slice(0, -1).join('');
    visibles[lineasMax - 1] = `${ultima.trimEnd()}…`;
    return visibles;
}

export class Globo {
    constructor(texto) {
        this.texto = texto;
        this.creado = performance.now();
        this.lineas = null; // se calculan en el primer dibujo (hace falta el ctx para medir)
    }

    get vivo() {
        return performance.now() - this.creado < DURACION_MS;
    }

    /**
     * Dibuja el globo con la colita apuntando a (cx, abajo).
     * `ocupados`: rectángulos de los globos ya dibujados en este frame. Si este choca con
     * alguno, sube hasta quedar libre (dos personas charlando al lado no se tapan).
     */
    dibujar(ctx, cx, abajo, ocupados = []) {
        const edad = performance.now() - this.creado;
        if (edad >= DURACION_MS) return;
        this.lineas ??= cortarEnLineas(ctx, this.texto);

        ctx.font = FUENTE;
        const anchoTexto = Math.max(...this.lineas.map((l) => ctx.measureText(l).width));
        const w = Math.ceil(anchoTexto) + PADDING * 2;
        const h = this.lineas.length * ALTO_LINEA + PADDING;
        // Que no se salga de la pantalla por los costados.
        const x = Math.round(Math.min(Math.max(cx - w / 2, visible.desde + 4), visible.hasta - w - 4));
        let y = Math.round(abajo - h - 6);
        const choca = (r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 8 > r.y;
        for (let intento = 0; intento < 10; intento++) {
            const otro = ocupados.find(choca);
            if (!otro) break;
            y = otro.y - h - 10;
        }
        ocupados.push({ x, y, w, h });
        const colita = Math.round(Math.min(Math.max(cx, x + 8), x + w - 8));

        ctx.globalAlpha = Math.min(1, (DURACION_MS - edad) / FADE_MS);
        // Borde oscuro con esquinas "mordidas" (pixel art) y relleno claro.
        ctx.fillStyle = '#2a1e17';
        ctx.fillRect(x + 2, y, w - 4, h);
        ctx.fillRect(x, y + 2, w, h - 4);
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillRect(x + 3, y + 1, w - 6, h - 2);
        ctx.fillRect(x + 1, y + 3, w - 2, h - 6);
        // Colita.
        ctx.fillStyle = '#2a1e17';
        ctx.fillRect(colita - 4, y + h - 1, 8, 2);
        ctx.fillRect(colita - 3, y + h + 1, 6, 2);
        ctx.fillRect(colita - 1, y + h + 3, 2, 2);
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(colita - 3, y + h - 2, 6, 2);
        ctx.fillRect(colita - 1, y + h, 2, 2);

        ctx.fillStyle = '#2a1e17';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        this.lineas.forEach((linea, i) => {
            ctx.fillText(linea, x + w / 2, y + PADDING / 2 + (i + 1) * ALTO_LINEA - 2);
        });
        ctx.globalAlpha = 1;
    }
}
