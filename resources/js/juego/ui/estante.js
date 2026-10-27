// Menú de un estante: ícono + nombre + descripción y la lista de libros (título + clase).
// ↑/↓ elige, Enter abre, Esc cierra. También se puede usar con el mouse.

import { iconoCanvas } from '../iconos.js';
import { botonCerrar, el } from './modales.js';

const ultimaEleccion = new Map(); // estante → índice, para volver al mismo libro

export class MenuEstante {
    /**
     * @param alElegir (libro, estante) => void
     * @param alCerrar () => void
     */
    constructor(estante, { alElegir, alCerrar }) {
        this.estante = estante;
        this.alElegir = alElegir;
        this.alCerrar = alCerrar;
        this.indice = ultimaEleccion.get(estante.slug) ?? 0;

        this.elemento = el('div', 'modal');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', `Estante ${estante.nombre}`);
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) this.alCerrar(); });

        const panel = el('section', 'menu-estante');
        panel.style.setProperty('--color-estante', estante.color);

        const cabecera = el('header', 'menu-estante-cabecera');
        const textos = el('div');
        textos.append(el('h2', 'menu-estante-titulo', estante.nombre), el('p', 'menu-estante-descripcion', estante.descripcion));
        cabecera.append(iconoCanvas(estante.slug, estante.color, 4), textos, botonCerrar(() => this.alCerrar()));

        this.lista = el('ol', 'menu-estante-libros');
        this.botones = estante.libros.map((libro, i) => {
            const boton = el('button', 'menu-libro');
            boton.type = 'button';
            boton.append(el('span', 'menu-libro-titulo', libro.titulo), el('span', 'menu-libro-clase', libro.clase));
            boton.addEventListener('mouseenter', () => this.seleccionar(i));
            boton.addEventListener('click', () => this.elegir(i));
            const li = el('li');
            li.append(boton);
            this.lista.append(li);
            return boton;
        });

        panel.append(cabecera, this.lista, el('footer', 'modal-ayuda', '↑↓ elegir · Enter abrir · Esc cerrar'));
        this.elemento.append(panel);
        this.seleccionar(Math.min(this.indice, this.botones.length - 1));
    }

    seleccionar(i) {
        this.indice = (i + this.botones.length) % this.botones.length;
        this.botones.forEach((b, j) => b.classList.toggle('menu-libro--elegido', j === this.indice));
        this.botones[this.indice].scrollIntoView({ block: 'nearest' });
    }

    elegir(i = this.indice) {
        ultimaEleccion.set(this.estante.slug, i);
        this.alElegir(this.estante.libros[i], this.estante);
    }

    tecla(e) {
        const acciones = {
            ArrowUp: () => this.seleccionar(this.indice - 1),
            KeyW: () => this.seleccionar(this.indice - 1),
            ArrowDown: () => this.seleccionar(this.indice + 1),
            KeyS: () => this.seleccionar(this.indice + 1),
            Enter: () => this.elegir(),
            Space: () => this.elegir(),
            KeyE: () => this.elegir(),
            Escape: () => this.alCerrar(),
        };
        const accion = acciones[e.code];
        if (!accion || e.repeat && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        accion();
    }
}
