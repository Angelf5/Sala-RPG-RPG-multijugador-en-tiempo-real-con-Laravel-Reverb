// Los demás jugadores DE TU SALA. Quién está lo dice el canal de presencia; dónde está, los whispers:
//   'mover' {id, x, y, dir}  cada paso (o giro) de alguien
//   'estoy' {id, x, y, dir}  "estoy acá": se lo mandamos al que acaba de entrar, porque
//                            los datos de here() son los de cuando cada uno se unió (posición vieja).

import { Personaje } from './personaje.js';
import { audio } from './audio.js';

const DIRECCIONES = ['arriba', 'abajo', 'izquierda', 'derecha'];

export class Multijugador {
    constructor({ red, yo, hud, cupo, mapa }) {
        this.red = red;
        this.yo = yo;
        this.hud = hud;
        this.cupo = cupo;
        this.mapa = mapa; // la sala donde estás
        this.remotos = new Map(); // id → Personaje

        red.on('here', (jugadores) => this.sincronizar(jugadores));
        red.on('entra', (j) => this.entra(j));
        red.on('sale', (j) => this.sale(j));
        red.on('mover', (d, id) => {
            const r = this.remotos.get(id);
            if (r && !r.saliendo && this.posicionValida(d)) r.moverRemoto(d.x, d.y, d.dir);
        });
        red.on('estoy', (d, id) => {
            const r = this.remotos.get(id);
            if (r && !r.saliendo && this.posicionValida(d)) r.teletransportar(d.x, d.y, d.dir);
        });
    }

    /** Los whispers no pasan por Laravel: cualquier cliente podría mandar basura. Validamos lo mínimo. */
    posicionValida(d) {
        return d
            && Number.isInteger(d.x) && Number.isInteger(d.y)
            && !this.mapa.fuera(d.x, d.y)
            && DIRECCIONES.includes(d.dir);
    }

    get cantidad() {
        let n = 1; // vos
        for (const r of this.remotos.values()) if (!r.saliendo) n++;
        return n;
    }

    actualizarContador() {
        this.hud.contador(this.cantidad, this.cupo);
    }

    /** Lista completa del canal (al entrar y después de cada reconexión). */
    sincronizar(jugadores, esInicial = false) {
        const presentes = new Set();
        for (const j of jugadores) {
            if (j.id === this.yo.id) continue;
            presentes.add(j.id);
            if (!this.remotos.has(j.id) || this.remotos.get(j.id).saliendo) {
                this.remotos.set(j.id, new Personaje(j));
            }
        }
        for (const id of [...this.remotos.keys()]) {
            if (!presentes.has(id)) this.remotos.delete(id);
        }
        this.actualizarContador();
        // Después de una reconexión los demás pueden tenernos en una posición vieja.
        if (!esInicial) this.avisarDondeEstoy();
    }

    /** Cruzamos a otra sala: los de antes desaparecen y aparecen los de la nueva. */
    cambiarSala(mapa, jugadores) {
        this.mapa = mapa;
        this.remotos.clear();
        this.sincronizar(jugadores, true);
        // Los que ya estaban en la sala nueva nos ven entrar por la posición de la BD,
        // que acabamos de guardar: igual les confirmamos dónde estamos.
        this.avisarDondeEstoy();
    }

    entra(j) {
        if (j.id === this.yo.id) return; // la misma persona en otra pestaña
        this.remotos.set(j.id, new Personaje(j));
        this.hud.toast(`${j.nombre} entró a ${this.mapa.nombre}`);
        audio.efecto('entra');
        this.actualizarContador();
        // El que entra nos ve con la posición de la BD: le contamos dónde estamos ahora.
        this.avisarDondeEstoy();
    }

    sale(j) {
        const r = this.remotos.get(j.id);
        if (!r || r.saliendo) return;
        this.hud.toast(`${j.nombre} salió de ${this.mapa.nombre}`);
        audio.efecto('sale');
        r.desvanecer().then(() => {
            if (this.remotos.get(j.id) === r) this.remotos.delete(j.id);
        });
        this.actualizarContador();
    }

    datosPropios() {
        const { id, x, y, dir } = this.yo;
        return { id, x, y, dir };
    }

    avisarDondeEstoy() {
        this.red.susurrar('estoy', this.datosPropios());
    }

    /** Cada paso o giro propio se avisa por whisper (directo a Reverb, sin Laravel). */
    avisarMovimiento() {
        this.red.susurrar('mover', this.datosPropios());
    }

    actualizar(dt) {
        for (const r of this.remotos.values()) r.actualizarRemoto(dt);
    }

    personajes() {
        return [...this.remotos.values()];
    }
}
