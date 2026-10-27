// Ventanas del reto a duelo:
//   MenuJugador     → al lado de otro jugador en la arena, A abre "⚔️ Retar a duelo"
//   VistaInvitacion → al retado: "Ana te reta a duelo", Aceptar / Rechazar, se vence en 15 s
// Se usan con teclado (↑↓/←→ + Enter, Esc), mouse o dedo.

import { botonCerrar, el } from './modales.js';

function opciones(lista, clase) {
    const contenedor = el('div', clase);
    const botones = lista.map(({ texto, accion, principal }) => {
        const b = el('button', principal ? 'reto-boton reto-boton--principal' : 'reto-boton', texto);
        b.type = 'button';
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            accion();
        });
        contenedor.append(b);
        return b;
    });
    return { contenedor, botones };
}

/** Navegación común: flechas eligen, Enter/E/Espacio confirma, Esc cierra. */
class VentanaConOpciones {
    marcar(i) {
        this.indice = (i + this.botones.length) % this.botones.length;
        this.botones.forEach((b, j) => b.classList.toggle('reto-boton--elegido', j === this.indice));
    }

    tecla(e) {
        const mover = { ArrowUp: -1, ArrowLeft: -1, KeyW: -1, KeyA: -1, ArrowDown: 1, ArrowRight: 1, KeyS: 1, KeyD: 1 }[e.code];
        if (mover) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.marcar(this.indice + mover);
        } else if (['Enter', 'KeyE', 'Space'].includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) this.botones[this.indice].click();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.alEscape();
        }
    }
}

export class MenuJugador extends VentanaConOpciones {
    /** @param jugador { nombre, color } */
    constructor(jugador, { alRetar, alCerrar }) {
        super();
        this.alEscape = alCerrar;
        this.elemento = el('div', 'modal');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', jugador.nombre);
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) alCerrar(); });

        const caja = el('section', 'reto');
        const cabecera = el('header', 'reto-cabecera');
        const punto = el('span', 'sala-punto');
        punto.style.background = jugador.color;
        cabecera.append(punto, el('h2', 'reto-titulo', jugador.nombre), botonCerrar(alCerrar));

        const { contenedor, botones } = opciones([
            { texto: '⚔️ Retar a duelo', accion: alRetar, principal: true },
            { texto: 'Cancelar', accion: alCerrar },
        ], 'reto-opciones');
        this.botones = botones;
        caja.append(cabecera, contenedor);
        this.elemento.append(caja);
        this.marcar(0);
    }
}

export class VistaInvitacion extends VentanaConOpciones {
    /** @param invitacion { retador: { nombre, color }, segundos } */
    constructor(invitacion, { alAceptar, alRechazar, alVencer }) {
        super();
        this.alEscape = alRechazar;
        this.elemento = el('div', 'modal');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'alertdialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', `${invitacion.retador.nombre} te reta a duelo`);

        const caja = el('section', 'reto reto--invitacion');
        const titulo = el('h2', 'reto-titulo reto-titulo--grande', '⚔️ ¡Duelo!');
        const texto = el('p', 'reto-texto');
        const nombre = el('strong', null, invitacion.retador.nombre);
        nombre.style.color = invitacion.retador.color;
        texto.append(nombre, ' te reta a duelo en el ring.');

        // Barra que se vacía en los segundos que quedan.
        const barra = el('div', 'reto-tiempo');
        const relleno = el('div', 'reto-tiempo-relleno');
        relleno.style.animationDuration = `${invitacion.segundos}s`;
        barra.append(relleno);
        this.cuenta = el('p', 'reto-cuenta');

        const { contenedor, botones } = opciones([
            { texto: 'Aceptar', accion: alAceptar, principal: true },
            { texto: 'Rechazar', accion: alRechazar },
        ], 'reto-opciones reto-opciones--fila');
        this.botones = botones;
        caja.append(titulo, texto, barra, this.cuenta, contenedor);
        this.elemento.append(caja);
        this.marcar(0);

        const vence = performance.now() + invitacion.segundos * 1000;
        const tic = () => {
            const quedan = Math.max(0, Math.ceil((vence - performance.now()) / 1000));
            this.cuenta.textContent = `Se vence en ${quedan} s`;
            if (quedan === 0) {
                this.detener();
                alVencer();
            }
        };
        tic();
        this.intervalo = setInterval(tic, 250);
    }

    detener() {
        clearInterval(this.intervalo);
    }
}
