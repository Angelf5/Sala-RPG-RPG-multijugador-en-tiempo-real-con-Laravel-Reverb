// Mapas de las salas y colisiones. Los mismos JSON (data/salas/*.json) los usa PHP para
// validar /posicion. Cada sala tiene su canal de presencia (sala.1, arena.1).

import BIBLIOTECA from './data/salas/biblioteca.json';
import ARENA from './data/salas/arena.json';

export class Mapa {
    constructor(slug, datos) {
        this.slug = slug;
        this.nombre = datos.nombre; // "la biblioteca", "la arena" (para los avisos)
        this.ancho = datos.ancho;
        this.alto = datos.alto;
        this.spawn = datos.spawn;
        this.filas = datos.filas;
        this.leyenda = datos.leyenda;
    }

    fuera(x, y) {
        return x < 0 || y < 0 || x >= this.ancho || y >= this.alto;
    }

    /** Carácter del mapa en una celda (o '#' si está fuera). */
    celda(x, y) {
        return this.fuera(x, y) ? '#' : this.filas[y][x];
    }

    /** Qué hay en una celda: { caminable, tipo, ... } según la leyenda. */
    infoCelda(x, y) {
        return this.leyenda[this.celda(x, y)];
    }

    esCaminable(x, y) {
        return this.infoCelda(x, y).caminable === true;
    }

    /**
     * Rectángulos de celdas contiguas con el mismo carácter (ej. cada estante 3×2).
     * Sirve para dibujar los objetos grandes de una sola vez.
     */
    bloques(caracter) {
        const visto = new Set();
        const resultado = [];
        for (let y = 0; y < this.alto; y++) {
            for (let x = 0; x < this.ancho; x++) {
                if (this.celda(x, y) !== caracter || visto.has(`${x},${y}`)) continue;
                // Relleno por inundación para encontrar el bloque completo.
                const pila = [[x, y]];
                let x0 = x, y0 = y, x1 = x, y1 = y;
                visto.add(`${x},${y}`);
                while (pila.length) {
                    const [cx, cy] = pila.pop();
                    x0 = Math.min(x0, cx); y0 = Math.min(y0, cy);
                    x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
                    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
                        if (this.celda(nx, ny) === caracter && !visto.has(`${nx},${ny}`)) {
                            visto.add(`${nx},${ny}`);
                            pila.push([nx, ny]);
                        }
                    }
                }
                resultado.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
            }
        }
        return resultado;
    }

    /** Caracteres de la leyenda que cumplen una condición (ej. todos los estantes). */
    caracteresDe(condicion) {
        return Object.entries(this.leyenda).filter(([, info]) => condicion(info)).map(([c]) => c);
    }
}

export const SALAS = {
    biblioteca: new Mapa('biblioteca', BIBLIOTECA),
    arena: new Mapa('arena', ARENA),
};
