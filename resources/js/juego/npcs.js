// NPCs en el mapa: Claude (mentora de la biblioteca) y Claude Code (programador).
// Sprites desde matrices, con animación idle (respiración y parpadeo) y un "!" cuando estás al lado.

import { ESCALA_SPRITE, SPRITE_H, SPRITE_W, TILE } from './config.js';
import { componer, contornear, crearCanvas, dibujarGrilla, oscurecer } from './pixel.js';
import { dibujarSombra } from './sprites.js';
import { dibujarEtiqueta } from './personaje.js';

// Códigos extra: G anteojos dorados · F/f bufanda · K/k suéter o buzo · N vivos naranjas
//                R vincha de los auriculares · A auriculares

const CLAUDE = {
    nombre: 'Claude',
    colorNombre: '#f0b08f',
    cabeza: [
        '................',
        '.....HHHHHH.....',
        '...HHHHHHHHHH...',
        '..HHHHHHHHHHHH..',
        '.HHHHHHHHHHHHHH.',
        '.HHHhHHHHHHhHHH.',
        '.HHSSHSSSSHSSHH.',
        '.HHGGGGSSGGGGHH.',
        '.HSGEWGGGGEWGSH.',
        '.HSGEEGSSGEEGSH.',
        '.HSGGGGSSGGGGSH.',
        '.HHSbSSMMSSbSHH.',
        '.HH.SSSSSSSS.HH.',
    ],
    peloAtras: [
        '.HH..........HH.',
        '.HH..........HH.',
        '.HH..........HH.',
        '.hH..........Hh.',
        '.hh..........hh.',
    ],
    cuerpo: [
        '....FFFFFFFF....',
        '...KFFFFFFFFK...',
        '...KKKKKFfKKK...',
        '...KkKKKFfKkK...',
        '...KkKKKKKKkK...',
        '...SPPPPPPPPS...',
        '...PPPPPPPPPP...',
        '..PPpPPPPPPpPP..',
        '...PPPPPPPPPP...',
        '.....BB..BB.....',
    ],
    paleta: {
        H: '#b5532a', S: '#f5d0b0', E: '#2a1e17', W: '#ffffff', G: '#d4a72c', M: '#b4443c',
        b: '#f2a48c', K: '#eadcc2', F: '#c4673f', P: '#5a3b2e', B: '#3b2a20',
    },
    parpadea: true,
};

const CLAUDE_CODE = {
    nombre: 'Claude Code',
    colorNombre: '#f7a35c',
    // De espaldas: pelo en punta y la vincha de los auriculares.
    cabeza: [
        '....H.H..H.H....',
        '...HHHHHHHHHH...',
        '..HRRRRRRRRRRH..',
        '..RHHHHHHHHHHR..',
        '..RHHHHHHHHHHR..',
        '..RHHHHHHHHHHR..',
        '.AAHHHHHHHHHHAA.',
        '.AAHHHHHHHHHHAA.',
        '.AAHHHHHHHHHHAA.',
        '..hHHHHHHHHHHh..',
        '..hhHHHHHHHHhh..',
        '...hhhhhhhhhh...',
        '.....SSSSSS.....',
    ],
    peloAtras: null,
    cuerpo: [
        '.....KKKKKK.....',
        '....KNKKKKNK....',
        '...KKNNNNNNKK...',
        '...NKKKKKKKKN...',
        '...KkKKKKKKkK...',
        '...SPPPPPPPPS...',
        '....PPPPPPPP....',
        '....PPP..PPP....',
        '....PPP..PPP....',
        '....BBB..BBB....',
    ],
    paleta: {
        H: '#f07a1a', S: '#f5c9a3', R: '#3a3a44', A: '#4a4a55', K: '#1e1e24', N: '#f07a1a',
        P: '#2e2e38', B: '#e0e0e0',
    },
    parpadea: false,
};

const TIPOS = { claude: CLAUDE, code: CLAUDE_CODE };

/** Frames: 0 normal, 1 respirando (cabeza 1 px más abajo), 2 parpadeo. */
function generarHoja(def) {
    const paleta = { ...def.paleta };
    for (const c of ['H', 'S', 'K', 'F', 'P']) {
        if (paleta[c]) paleta[c.toLowerCase()] = oscurecer(paleta[c], c === 'S' ? 0.15 : 0.3);
    }
    const cerrados = def.cabeza.map((fila, i) => (i === 8 ? fila.replace(/[EW]/g, 'S') : fila));
    const variantes = [
        { cabeza: def.cabeza, dy: 0 },
        { cabeza: def.cabeza, dy: 1 },
        { cabeza: cerrados, dy: 0 },
    ];

    const ancho = SPRITE_W * ESCALA_SPRITE;
    const alto = SPRITE_H * ESCALA_SPRITE;
    const hoja = crearCanvas(ancho * variantes.length, alto);
    variantes.forEach(({ cabeza, dy }, i) => {
        const capas = [
            ...(def.peloAtras ? [{ filas: def.peloAtras, desde: 13 }] : []),
            { filas: def.cuerpo, desde: 13 },
            { filas: cabeza, desde: dy },
        ];
        const grilla = contornear(componer(SPRITE_W, SPRITE_H, capas));
        dibujarGrilla(hoja.getContext('2d'), grilla, paleta, i * ancho, 0, ESCALA_SPRITE);
    });
    return hoja;
}

class Npc {
    constructor(tipo, x, y, dir) {
        this.tipo = tipo;
        this.def = TIPOS[tipo];
        this.nombre = this.def.nombre;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.hoja = generarHoja(this.def);
        this.desfase = Math.random() * 3000; // para que no respiren sincronizados
    }

    // Para ordenar el dibujo por profundidad junto con los jugadores.
    get px() { return this.x; }
    get py() { return this.y; }

    /** ¿El jugador está en una de las 8 celdas de alrededor? */
    estaCerca(jugador) {
        return Math.abs(jugador.x - this.x) <= 1 && Math.abs(jugador.y - this.y) <= 1;
    }

    frame(t) {
        const tt = t + this.desfase;
        if (this.def.parpadea && tt % 3800 < 140) return 2;
        return tt % 1800 < 900 ? 0 : 1;
    }

    dibujar(ctx, t) {
        const sx = this.x * TILE;
        const sy = this.y * TILE - (SPRITE_H * ESCALA_SPRITE - TILE);
        dibujarSombra(ctx, sx + TILE / 2, (this.y + 1) * TILE, ESCALA_SPRITE);
        const ancho = SPRITE_W * ESCALA_SPRITE;
        const alto = SPRITE_H * ESCALA_SPRITE;
        ctx.drawImage(this.hoja, this.frame(t) * ancho, 0, ancho, alto, sx, sy, ancho, alto);
    }

    dibujarNombre(ctx, t, jugador, ocupados = []) {
        const cx = this.x * TILE + TILE / 2;
        const cerca = jugador && this.estaCerca(jugador);
        const arriba = dibujarEtiqueta(ctx, this.nombre, cx, this.y * TILE - (SPRITE_H * ESCALA_SPRITE - TILE),
            this.def.colorNombre, ocupados, cerca ? 16 : 0);

        if (cerca) {
            const salto = Math.round(Math.sin(t / 180) * 2);
            ctx.font = '16px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#000';
            ctx.fillText('!', cx + 2, arriba - 12 + salto + 2);
            ctx.fillStyle = '#ffd34d';
            ctx.fillText('!', cx, arriba - 12 + salto);
        }
    }
}

/** Crea los NPCs en las celdas marcadas en el mapa de una sala (L y K en la biblioteca). */
export function crearNpcs(mapa) {
    const npcs = [];
    mapa.filas.forEach((fila, y) => {
        [...fila].forEach((c, x) => {
            const info = mapa.leyenda[c];
            if (info.tipo === 'npc') npcs.push(new Npc(info.npc, x, y, info.dir));
        });
    });
    return npcs;
}
