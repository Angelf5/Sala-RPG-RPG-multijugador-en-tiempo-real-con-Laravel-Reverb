// Ventanas que se abren encima del juego (menú de estante, libro, y después diálogos).
// Funcionan como una pila: las teclas van a la de arriba de todo, y mientras haya
// alguna abierta el personaje no se mueve y Enter no abre el chat.
//
// Cada ventana es un objeto con: elemento (HTMLElement) y tecla(evento).

import { audio } from '../audio.js';

export class Modales {
    constructor(entrada, contenedor) {
        this.entrada = entrada;
        this.contenedor = contenedor;
        this.pila = [];

        window.addEventListener('keydown', (e) => {
            const arriba = this.pila.at(-1);
            // Desde un input (ej. el volumen en Ajustes) solo dejamos pasar Esc.
            if (!arriba || (e.target instanceof HTMLInputElement && e.code !== 'Escape')) return;
            arriba.tecla(e);
        });
    }

    get abierto() {
        return this.pila.length > 0;
    }

    /** `sonido: false` si la ventana tiene su propio sonido (ej. el papel del diario). */
    abrir(ventana, { sonido = true } = {}) {
        if (sonido) audio.efecto('abrir');
        this.pila.push(ventana);
        this.contenedor.append(ventana.elemento);
        this.entrada.bloqueada = true;
        document.body.classList.add('hay-modal'); // en celular, esconde el d-pad para no tapar la ventana
        ventana.elemento.focus({ preventScroll: true });
    }

    cerrar(ventana) {
        this.pila = this.pila.filter((v) => v !== ventana);
        ventana.elemento.remove();
        if (!this.abierto) {
            this.entrada.bloqueada = false;
            document.body.classList.remove('hay-modal');
            // Si quedó el foco en un botón del HUD, Espacio lo "apretaría" de nuevo.
            if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
        }
    }

    /** Cierra `vieja` y abre `nueva` en el mismo movimiento (sin desbloquear el personaje). */
    reemplazar(vieja, nueva) {
        this.pila = this.pila.filter((v) => v !== vieja);
        vieja.elemento.remove();
        this.abrir(nueva);
    }
}

/** Helper para armar elementos con textContent (nunca innerHTML). */
export function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
}

/** Botón ✕ para cerrar con el dedo o el mouse (nada tiene que depender solo del teclado). */
export function botonCerrar(alCerrar, etiqueta = 'Cerrar') {
    const boton = el('button', 'boton-cerrar', '✕');
    boton.type = 'button';
    boton.setAttribute('aria-label', etiqueta);
    boton.addEventListener('click', (e) => {
        e.stopPropagation();
        alCerrar();
    });
    return boton;
}
