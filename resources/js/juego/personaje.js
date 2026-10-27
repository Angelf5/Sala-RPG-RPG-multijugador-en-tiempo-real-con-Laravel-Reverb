// Un personaje en el mapa (el propio y, desde la etapa 3, los remotos).
// Se mueve de a una celda: (x, y) es la celda destino y durante PASO_MS se interpola
// desde la celda anterior para que el movimiento se vea suave.

import { ESCALA_SPRITE, PASO_MS, SPRITE_H, TILE } from './config.js';
import { apariencia, dibujarSombra, dibujarSprite, obtenerSprites } from './sprites.js';
import { Globo } from './ui/globo.js';
import { conContorno, crearCanvas, dibujarGrilla } from './pixel.js';

// ❤️ de los duelos (llena y vacía), dibujados una sola vez.
const CORAZON = conContorno([
    '.XX.XX.',
    'XLXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
]);
function lienzoCorazon(paleta) {
    const c = crearCanvas(CORAZON[0].length * 2, CORAZON.length * 2);
    dibujarGrilla(c.getContext('2d'), CORAZON, paleta, 0, 0, 2);
    return c;
}
const CORAZON_LLENO = lienzoCorazon({ X: '#e74c3c', L: '#ffb3a8' });
const CORAZON_VACIO = lienzoCorazon({ X: '#4a3a3a', L: '#5d4a4a' });
const ANCHO_CORAZON = CORAZON[0].length * 2;
const ALTO_CORAZON = CORAZON.length * 2;
const MAX_VIDAS = 3;

// Barrido de la espada (ángulos en grados, 0 = derecha, 90 = abajo) según hacia dónde mira.
const BARRIDO = { derecha: [-70, 70], abajo: [20, 160], izquierda: [250, 110], arriba: [200, 340] };
const MS_ESPADAZO = 260;
const MS_PARPADEO = 800;

const ALTO_SPRITE = SPRITE_H * ESCALA_SPRITE; // 48
const SOBRESALE = ALTO_SPRITE - TILE; // la cabeza sobresale 16 px hacia la celda de arriba

const DELTAS = {
    arriba: [0, -1],
    abajo: [0, 1],
    izquierda: [-1, 0],
    derecha: [1, 0],
};

export function delta(dir) {
    return DELTAS[dir];
}

const ALTO_ETIQUETA = 11;

/**
 * Nombre con contorno negro en fuente pixel, centrado en cx, apoyado sobre `abajo`.
 * `ocupados`: rectángulos de los nombres (y globos) ya dibujados en este frame. Si este
 * choca con alguno (dos jugadores pegados), sube hasta quedar libre: "Beto" queda arriba de
 * "Fede" en vez de "FedeBeto". `extraArriba`: lugar que reserva arriba (ej. el triangulito).
 * Devuelve dónde quedó apoyado, para dibujar lo que va encima del nombre.
 */
export function dibujarEtiqueta(ctx, texto, cx, abajo, color = '#ffffff', ocupados = [], extraArriba = 0) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const w = Math.ceil(ctx.measureText(texto).width) + 4;
    const x = cx - w / 2;
    const choca = (r, base) => x < r.x + r.w && x + w > r.x && base - ALTO_ETIQUETA - extraArriba < r.y + r.h && base > r.y;
    for (let intento = 0; intento < 12; intento++) {
        const otro = ocupados.find((r) => choca(r, abajo));
        if (!otro) break;
        abajo = otro.y - 1;
    }
    ocupados.push({ x, y: abajo - ALTO_ETIQUETA - extraArriba, w, h: ALTO_ETIQUETA + extraArriba });
    const y = Math.round(abajo - 2);
    ctx.fillStyle = '#000000';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) {
        ctx.fillText(texto, cx + dx, y + dy);
    }
    ctx.fillStyle = color;
    ctx.fillText(texto, cx, y);
    return abajo;
}

export class Personaje {
    constructor({ id, nombre, genero, color, x, y, dir }) {
        this.id = id;
        this.nombre = nombre;
        this.color = color;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.desdeX = x;
        this.desdeY = y;
        this.progreso = 1; // 1 = quieto en la celda
        this.pasos = 0;
        this.cola = []; // pasos pendientes de un jugador remoto (llegan por whisper)
        this.opacidad = 1;
        this.saliendo = false;
        this.globo = null;
        this.ataque = 0; // performance.now() del último espadazo (animación)
        this.parpadeoHasta = 0; // recibió un golpe: parpadea hasta este momento
        this.festejoHasta = 0; // ganó un duelo: salta con confeti hasta este momento
        this.hoja = obtenerSprites({ genero, color, ...apariencia(id) });
    }

    get moviendo() {
        return this.progreso < 1;
    }

    // Posición dibujada (en celdas, con decimales mientras camina).
    get px() { return this.desdeX + (this.x - this.desdeX) * this.progreso; }
    get py() { return this.desdeY + (this.y - this.desdeY) * this.progreso; }

    /** Empieza un paso hacia la celda (nx, ny). */
    pasoA(nx, ny, dir) {
        this.desdeX = this.x;
        this.desdeY = this.y;
        this.x = nx;
        this.y = ny;
        this.dir = dir;
        this.progreso = 0;
        this.pasos++;
    }

    /** Animación del espadazo (la decisión de si pegó la toma el servidor). */
    espadazo() {
        this.ataque = performance.now();
    }

    /** Ganó un duelo: salta y le llueve confeti un rato. */
    festejar(ms = 2400) {
        this.festejoHasta = performance.now() + ms;
    }

    dibujarConfeti(ctx, sx, sy) {
        const ahora = performance.now();
        const colores = ['#f1c40f', '#e74c3c', '#3498db', '#27ae60', '#e84393', '#ffffff'];
        for (let i = 0; i < 14; i++) {
            // Cada papelito sube y cae en su propio ciclo (sin estado: sale del tiempo y del índice).
            const fase = ((ahora / 900) + i * 0.137) % 1;
            const x = sx + 16 + Math.round(Math.sin(i * 2.3 + fase * 3) * (10 + (i % 4) * 5));
            const y = sy - 40 + Math.round(fase * 46);
            ctx.fillStyle = colores[i % colores.length];
            ctx.fillRect(x, y, i % 2 ? 4 : 2, i % 2 ? 2 : 4);
        }
    }

    /** Parpadea un rato (recibió un golpe y es invulnerable). */
    parpadear(ms = MS_PARPADEO) {
        this.parpadeoHasta = performance.now() + ms;
    }

    /** ❤️ sobre la cabeza durante un duelo. `abajo`: borde inferior de la fila de corazones. */
    dibujarVidas(ctx, vidas, abajo) {
        const cx = Math.round(this.px * TILE + TILE / 2);
        const total = MAX_VIDAS * ANCHO_CORAZON + (MAX_VIDAS - 1) * 2;
        let x = cx - Math.round(total / 2);
        for (let i = 0; i < MAX_VIDAS; i++) {
            ctx.drawImage(i < vidas ? CORAZON_LLENO : CORAZON_VACIO, x, abajo - ALTO_CORAZON);
            x += ANCHO_CORAZON + 2;
        }
    }

    dibujarEspadazo(ctx) {
        const edad = performance.now() - this.ataque;
        if (edad > MS_ESPADAZO) return;
        const avance = edad / MS_ESPADAZO;
        const cx = Math.round(this.px * TILE + TILE / 2);
        const cy = Math.round(this.py * TILE + 14);
        const [desde, hasta] = BARRIDO[this.dir];
        const rad = (g) => (g * Math.PI) / 180;
        const actual = desde + (hasta - desde) * avance;
        // Estela: el arco que ya recorrió la hoja (dos anillos), más fuerte cerca de la hoja.
        for (let i = 0; i <= 14; i++) {
            const g = desde + (actual - desde) * (i / 14);
            const alfa = (0.25 + 0.7 * (i / 14)) * (1 - avance * 0.5);
            for (const [radio, tam] of [[28, 6], [22, 4]]) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alfa})`;
                ctx.fillRect(Math.round(cx + Math.cos(rad(g)) * radio) - tam / 2, Math.round(cy + Math.sin(rad(g)) * radio) - tam / 2, tam, tam);
            }
        }
        // La hoja: del mango (r = 6) a la punta (r = 30), con borde oscuro para que se lea.
        for (let r = 6; r <= 30; r += 2) {
            const x = Math.round(cx + Math.cos(rad(actual)) * r), y = Math.round(cy + Math.sin(rad(actual)) * r);
            ctx.fillStyle = '#2a1e17';
            ctx.fillRect(x - 2, y - 2, 5, 5);
        }
        for (let r = 6; r <= 30; r += 2) {
            ctx.fillStyle = r < 11 ? '#8a5a3b' : (r >= 28 ? '#ffffff' : '#dfe6ee');
            ctx.fillRect(Math.round(cx + Math.cos(rad(actual)) * r) - 1, Math.round(cy + Math.sin(rad(actual)) * r) - 1, 3, 3);
        }
    }

    /** Muestra un globo de texto sobre la cabeza (reemplaza al anterior). */
    decir(texto) {
        this.globo = new Globo(texto);
    }

    /** El globo va arriba del nombre (y del triangulito si es el propio), donde haya quedado. */
    dibujarGlobo(ctx, esPropio = false, ocupados = []) {
        if (!this.globo?.vivo) {
            this.globo = null;
            return;
        }
        const cx = Math.round(this.px * TILE + TILE / 2);
        const arriba = this.baseEtiqueta ?? Math.round(this.py * TILE - SOBRESALE);
        this.globo.dibujar(ctx, cx, arriba - (esPropio ? 18 : 12), ocupados);
    }

    /** Lo pone directo en una celda, sin animar (posición inicial, reconexión o lag). */
    teletransportar(x, y, dir) {
        this.x = this.desdeX = x;
        this.y = this.desdeY = y;
        this.dir = dir;
        this.progreso = 1;
        this.cola = [];
    }

    /**
     * Para jugadores remotos: llegó un whisper "mover". Si está a más de 2 celdas de donde
     * lo tenemos (lag o reconexión), lo teletransportamos; si no, encolamos el paso.
     */
    moverRemoto(x, y, dir) {
        const ultimo = this.cola.at(-1) ?? this;
        const distancia = Math.abs(x - ultimo.x) + Math.abs(y - ultimo.y);
        if (distancia > 2) {
            this.teletransportar(x, y, dir);
        } else {
            this.cola.push({ x, y, dir });
        }
    }

    /** Fade out al salir de la sala. Devuelve una promesa que termina cuando ya no se ve. */
    desvanecer(ms = 400) {
        this.saliendo = true;
        return new Promise((resolve) => {
            const inicio = performance.now();
            const paso = (t) => {
                this.opacidad = Math.max(0, 1 - (t - inicio) / ms);
                if (this.opacidad > 0) requestAnimationFrame(paso);
                else resolve();
            };
            requestAnimationFrame(paso);
        });
    }

    /** Avance de un remoto: consume la cola de pasos (más rápido si se acumularon). */
    actualizarRemoto(dt) {
        const velocidad = 1 + Math.max(0, this.cola.length - 1) * 0.5;
        let sobra = this.actualizar(dt * velocidad);
        while (!this.moviendo && this.cola.length) {
            const { x, y, dir } = this.cola.shift();
            if (x === this.x && y === this.y) {
                this.dir = dir; // solo giró
                continue;
            }
            this.pasoA(x, y, dir);
            sobra = this.actualizar(sobra);
        }
    }

    /**
     * Avanza la animación `dt` ms. Devuelve los ms que "sobraron" al terminar el paso,
     * para encadenar el siguiente sin un frame de pausa (si no, caminar se ve a los saltos).
     */
    actualizar(dt) {
        if (!this.moviendo) return 0;
        this.progreso += dt / PASO_MS;
        if (this.progreso < 1) return 0;
        const sobra = (this.progreso - 1) * PASO_MS;
        this.progreso = 1;
        return sobra;
    }

    frame() {
        if (!this.moviendo) return 0;
        // Primera mitad del paso: pie adelantado (alterna A/B en cada paso). Segunda mitad: quieto.
        if (this.progreso < 0.5) return this.pasos % 2 ? 1 : 2;
        return 0;
    }

    dibujar(ctx) {
        // Recién golpeado: parpadea (se ve y no se ve cada 80 ms).
        const parpadea = performance.now() < this.parpadeoHasta && Math.floor(performance.now() / 80) % 2 === 0;
        ctx.globalAlpha = this.opacidad * (parpadea ? 0.25 : 1);
        const sx = Math.round(this.px * TILE);
        const sy = Math.round(this.py * TILE);
        const festeja = performance.now() < this.festejoHasta;
        // Festejo: saltitos (de a 2 px, para que siga siendo pixel art).
        const salto = festeja ? Math.round(Math.abs(Math.sin(performance.now() / 110)) * 5) * 2 : 0;
        dibujarSombra(ctx, sx + TILE / 2, sy + TILE, ESCALA_SPRITE);
        dibujarSprite(ctx, this.hoja, festeja ? 'abajo' : this.dir, this.frame(), sx, sy - SOBRESALE - salto);
        ctx.globalAlpha = 1;
        if (festeja) this.dibujarConfeti(ctx, sx, sy);
        this.dibujarEspadazo(ctx);
    }

    /**
     * Devuelve dónde quedó el nombre (si chocaba con otro, más arriba).
     * `vidas`: si está peleando un duelo, los ❤️ van arriba del nombre.
     */
    dibujarNombre(ctx, t, esPropio = false, ocupados = [], vidas = null) {
        const cx = Math.round(this.px * TILE + TILE / 2);
        ctx.globalAlpha = this.opacidad;
        const extra = (esPropio ? 7 : 0) + (vidas === null ? 0 : ALTO_CORAZON + 2);
        const arriba = dibujarEtiqueta(ctx, this.nombre, cx, Math.round(this.py * TILE - SOBRESALE),
            esPropio ? '#ffe9a8' : '#ffffff', ocupados, extra);
        this.baseEtiqueta = vidas === null ? arriba : arriba - ALTO_CORAZON - 2;
        if (vidas !== null) this.dibujarVidas(ctx, vidas, arriba - 11 - (esPropio ? 7 : 0));

        if (esPropio) {
            // Triangulito que flota arriba del nombre para ubicarte entre la gente.
            const y = arriba - 16 + Math.round(Math.sin(t / 250) * 1.5);
            ctx.fillStyle = '#000000';
            ctx.fillRect(cx - 4, y - 1, 9, 2);
            ctx.fillStyle = '#ffe9a8';
            for (let i = 0; i < 4; i++) ctx.fillRect(cx - 3 + i, y + i, 7 - 2 * i, 1);
        }
        ctx.globalAlpha = 1;
    }
}
