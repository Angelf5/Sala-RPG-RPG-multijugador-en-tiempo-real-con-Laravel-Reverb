// Sprites de jugadores generados por código: chico/chica × color × 4 direcciones × 3 frames.
// Se arman por capas (pelo de atrás, cuerpo, cabeza) a partir de matrices de 16×24 y se
// cachean en una "hoja" (canvas) por combinación de género + color + pelo + piel.
//
// Códigos de las matrices:
//   H/h pelo (claro/sombra)   S/s piel   E ojo   W brillo del ojo   M boca   b rubor
//   T/t remera (color elegido / sombra)   P/p pantalón o pollera (color 35 % más oscuro)
//   B zapatos   O contorno   . transparente

import {
    COLOR_CONTORNO, DIRECCIONES, ESCALA_SPRITE, PELOS, PIELES, SPRITE_H, SPRITE_W,
} from './config.js';
import { componer, contornear, crearCanvas, dibujarGrilla, espejar, mezclar, oscurecer } from './pixel.js';

// ───────────── Cabezas (empiezan en la fila 0) ─────────────

const CABEZA = {
    chico: {
        abajo: [
            '................',
            '.....HHHHHH.....',
            '...HHHHHHHHHH...',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..HHhHHHHHhHHH..',
            '..HSSHSSSSHSSH..',
            '..HSSSSSSSSSSH..',
            '..SSEWSSSSEWSS..',
            '..SSEESSSSEESS..',
            '..SbSSSSSSSSbS..',
            '...SSSSMMSSSS...',
            '....SSSSSSSS....',
        ],
        arriba: [
            '................',
            '.....HHHHHH.....',
            '...HHHHHHHHHH...',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..',
            '..hHHHHHHHHHHh..',
            '..hHHHHHHHHHHh..',
            '...hhhhhhhhhh...',
            '.....SSSSSS.....',
        ],
        derecha: [
            '................',
            '....HHHHHH......',
            '...HHHHHHHHH....',
            '..HHHHHHHHHHH...',
            '..HHHHHHHHHHHH..',
            '..HHHHHHHHhHHH..',
            '..HHHHHHSSHSSH..',
            '..HHHHHSSSSSSS..',
            '..HHHHSSSSSEWS..',
            '..hHHsSSSSSEES..',
            '..hHSSSSSSSbSSS.',
            '...hSSSSSSSMS...',
            '....SSSSSSSS....',
        ],
    },
    chica: {
        abajo: [
            '................',
            '.....HHHHHH.....',
            '...HHHHHHHHHH...',
            '..HHHHHHHHHHHH..',
            '.HHHHHHHHHHHHHH.',
            '.HHHhHHHHHHhHHH.',
            '.HHSSHSSSSHSSHH.',
            '.HHSSSSSSSSSSHH.',
            '.HSSEWSSSSEWSSH.',
            '.HSSEESSSSEESSH.',
            '.HSbSSSSSSSSbSH.',
            '.HHSSSSMMSSSSHH.',
            '.HH.SSSSSSSS.HH.',
        ],
        // De espaldas el pelo largo tapa la parte de arriba de la espalda.
        arriba: [
            '................',
            '.....HHHHHH.....',
            '...HHHHHHHHHH...',
            '..HHHHHHHHHHHH..',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.HHHHHHHHHHHHHH.',
            '.hHHhHHHHHHhHHh.',
            '..hHhHHHHHHhHh..',
            '...hhhhhhhhhh...',
        ],
        derecha: [
            '................',
            '....HHHHHH......',
            '...HHHHHHHHH....',
            '..HHHHHHHHHHH...',
            '.HHHHHHHHHHHHH..',
            '.HHHHHHHHHhHHH..',
            '.HHHHHHHSSHSSH..',
            '.HHHHHHSSSSSSS..',
            '.HHHHHSSSSSEWS..',
            '.HHHHHsSSSSEES..',
            '.HHHHSSSSSSbSSS.',
            '.HHHHhSSSSSMS...',
            '.HHHH..SSSSSS...',
            '.HHHh...........',
            '.hHHh...........',
            '.hHh............',
            '..hh............',
        ],
    },
};

// Pelo largo de la chica que cae detrás de los hombros (se dibuja ANTES del cuerpo).
const PELO_ATRAS_CHICA = [
    '.HH..........HH.',
    '.HH..........HH.',
    '.hH..........Hh.',
    '.hh..........hh.',
];

// ───────────── Cuerpos (empiezan en la fila 13) ─────────────
// Cada uno tiene 3 frames: [quieto, paso A, paso B].

const TORSO_FRENTE = [
    '.....TTSSTT.....',
    '....TTTTTTTT....',
    '...TTTTTTTTTT...',
    '...TtTTTTTTtT...',
    '...TtTTTTTTtT...',
];
const TORSO_ESPALDA = ['.....TTTTTT.....', ...TORSO_FRENTE.slice(1)];

const PIERNAS_FRENTE = {
    chico: [
        ['...SPPPPPPPPS...', '....PPPPPPPP....', '....PPP..PPP....', '....PPP..PPP....', '....BBB..BBB....'],
        ['...SPPPPPPPPS...', '....PPPPPPPP....', '....PPP..PPP....', '....BBB..PPP....', '.........BBB....'],
        ['...SPPPPPPPPS...', '....PPPPPPPP....', '....PPP..PPP....', '....PPP..BBB....', '....BBB.........'],
    ],
    chica: [
        ['...SPPPPPPPPS...', '...PPPPPPPPPP...', '..PPpPPPPPPpPP..', '.....SS..SS.....', '.....BB..BB.....'],
        ['...SPPPPPPPPS...', '...PPPPPPPPPP...', '..PPpPPPPPPpPP..', '.....BB..SS.....', '.........BB.....'],
        ['...SPPPPPPPPS...', '...PPPPPPPPPP...', '..PPpPPPPPPpPP..', '.....SS..BB.....', '.....BB.........'],
    ],
};

// De perfil (mirando a la derecha): el brazo se balancea adelante/atrás al caminar.
const TORSO_PERFIL = [
    ['......TTTT......', '.....TTTTTT.....', '.....TTTTTT.....', '.....TTtTTT.....', '.....TTtTTT.....'],
    ['......TTTT......', '.....TTTTTT.....', '.....TTTTTT.....', '.....TTTTtT.....', '.....TTTTTtS....'],
    ['......TTTT......', '.....TTTTTT.....', '.....TTTTTT.....', '.....tTTTTT.....', '....StTTTTT.....'],
];

const PIERNAS_PERFIL = {
    chico: [
        ['.....PPSPPP.....', '.....PPPPPP.....', '......PPPP......', '......PPPP......', '......BBBBB.....'],
        ['.....PPPPPP.....', '.....PPPPPP.....', '.....PP..PP.....', '....PP....PP....', '...BBB....BBB...'],
        ['.....PPPPPP.....', '.....PPPPPP.....', '.....PP..PP.....', '....PP....PP....', '...BBB....BBB...'],
    ],
    chica: [
        ['.....PPSPPP.....', '....PPPPPPPP....', '....PpPPPPpP....', '......SSS.......', '......BBBB......'],
        ['.....PPPPPP.....', '....PPPPPPPP....', '....PpPPPPpP....', '.....S....S.....', '....BB....BB....'],
        ['.....PPPPPP.....', '....PPPPPPPP....', '....PpPPPPpP....', '.....S....S.....', '....BB....BB....'],
    ],
};

const FILA_CUERPO = 13;

/** Capas (en orden de dibujo) de un personaje para una dirección y un frame. */
function capas(genero, dir, frame) {
    const perfil = dir === 'derecha' || dir === 'izquierda';
    let lista;

    if (perfil) {
        lista = [
            { filas: [...TORSO_PERFIL[frame], ...PIERNAS_PERFIL[genero][frame]], desde: FILA_CUERPO },
            { filas: CABEZA[genero].derecha, desde: 0 },
        ];
    } else {
        const torso = dir === 'arriba' ? TORSO_ESPALDA : TORSO_FRENTE;
        lista = [
            { filas: [...torso, ...PIERNAS_FRENTE[genero][frame]], desde: FILA_CUERPO },
            { filas: CABEZA[genero][dir], desde: 0 },
        ];
        if (genero === 'chica' && dir === 'abajo') {
            lista.unshift({ filas: PELO_ATRAS_CHICA, desde: FILA_CUERPO });
        }
    }

    if (dir === 'izquierda') {
        lista = lista.map((c) => ({ ...c, filas: espejar(c.filas) }));
    }
    return lista;
}

export function paletaDe({ color, pelo, piel }) {
    const pantalon = oscurecer(color, 0.35);
    return {
        H: pelo,
        h: oscurecer(pelo, 0.3),
        S: piel,
        s: oscurecer(piel, 0.15),
        E: COLOR_CONTORNO,
        W: '#ffffff',
        M: '#b4443c',
        b: mezclar(piel, '#ff6f6f', 0.35),
        T: color,
        t: oscurecer(color, 0.2),
        P: pantalon,
        p: oscurecer(pantalon, 0.2),
        B: '#3b2a20',
    };
}

/** Hash entero simple y estable (Knuth) para derivar la apariencia del id. */
function hash(n) {
    return Math.imul(n, 2654435761) >>> 0;
}

/** Pelo y piel del jugador, derivados de su id (5 opciones naturales de cada uno). */
export function apariencia(id) {
    const h = hash(id);
    return {
        pelo: PELOS[h % PELOS.length],
        piel: PIELES[(h >>> 8) % PIELES.length],
    };
}

const cache = new Map();

/**
 * Devuelve la hoja de sprites (canvas) de un personaje: 4 filas (DIRECCIONES) × 3 columnas (frames),
 * cada celda de 32×48. Se genera una sola vez por combinación y después se reutiliza.
 */
export function obtenerSprites({ genero, color, pelo, piel }) {
    const clave = `${genero}|${color}|${pelo}|${piel}`;
    if (cache.has(clave)) return cache.get(clave);

    const ancho = SPRITE_W * ESCALA_SPRITE;
    const alto = SPRITE_H * ESCALA_SPRITE;
    const hoja = crearCanvas(ancho * 3, alto * DIRECCIONES.length);
    const ctx = hoja.getContext('2d');
    const paleta = paletaDe({ color, pelo, piel });

    DIRECCIONES.forEach((dir, fila) => {
        for (let frame = 0; frame < 3; frame++) {
            const grilla = grillaSprite(genero, dir, frame);
            dibujarGrilla(ctx, grilla, paleta, frame * ancho, fila * alto, ESCALA_SPRITE);
        }
    });

    cache.set(clave, hoja);
    return hoja;
}

// Ciclo de la animación de caminar: paso A, quieto, paso B, quieto.
export const CICLO_CAMINAR = [1, 0, 2, 0];

/** Dibuja un frame de la hoja con la esquina superior izquierda en (x, y). */
export function dibujarSprite(ctx, hoja, dir, frame, x, y, escala = 1) {
    const ancho = SPRITE_W * ESCALA_SPRITE;
    const alto = SPRITE_H * ESCALA_SPRITE;
    const fila = DIRECCIONES.indexOf(dir);
    ctx.drawImage(hoja, frame * ancho, fila * alto, ancho, alto, x, y, ancho * escala, alto * escala);
}

/** Grilla (con contorno) de un frame; útil para depurar el arte. */
export function grillaSprite(genero, dir, frame) {
    return contornear(componer(SPRITE_W, SPRITE_H, capas(genero, dir, frame)));
}

/**
 * Sombra ovalada pixelada bajo los pies. `cx` es el centro horizontal, `piesY` el borde inferior
 * del sprite y `escala` cuántos px de pantalla mide un píxel lógico del sprite.
 */
export function dibujarSombra(ctx, cx, piesY, escala, color = 'rgba(0, 0, 0, 0.35)') {
    const anchos = [10, 14, 14, 10]; // en píxeles lógicos, de arriba hacia abajo
    ctx.fillStyle = color;
    anchos.forEach((ancho, i) => {
        const y = piesY + (i - 3) * escala;
        ctx.fillRect(cx - (ancho / 2) * escala, y, ancho * escala, escala);
    });
}
