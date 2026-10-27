// Caja de diálogo estilo RPG: abajo, ancho completo, borde doble, retrato del NPC que
// sobresale por arriba y cartel con el nombre. Texto con efecto máquina de escribir.
//
// Dos primitivas que devuelven promesas, para escribir las charlas como código lineal:
//   await caja.decir([{ expresion, texto }, ...])   → muestra las líneas una por una
//   const i = await caja.elegir(['Opción A', ...])   → menú con ↑/↓ + Enter
// Esc cierra la caja en cualquier momento: las promesas pendientes se rechazan con DialogoCerrado.

import { audio } from '../audio.js';
import { botonCerrar, el } from './modales.js';

const LETRAS_POR_SEGUNDO = 40;

export class DialogoCerrado extends Error {}

const CONFIRMAR = ['Enter', 'Space', 'KeyE'];

export class CajaDialogo {
    /**
     * @param def            datos del NPC en dialogos.json (nombre, titulo, retratos)
     * @param urlRetratos    carpeta pública de los PNG
     * @param reemplazos     { nombre: 'Ana', ... } para {nombre}, {puntaje}, etc.
     * @param voz            frecuencia del blip (Hz)
     */
    constructor({ def, urlRetratos, reemplazos = {}, voz = 520 }) {
        this.def = def;
        this.urlRetratos = urlRetratos;
        this.reemplazos = reemplazos;
        this.voz = voz;
        this.cerrada = false;
        this.escribiendo = null; // { completo, timer } mientras tipea
        this.esperando = null; // { resolve, reject } de la promesa en curso
        this.menu = null; // { botones, indice } mientras hay menú

        this.elemento = el('div', 'modal modal--dialogo');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', `Conversación con ${def.nombre}`);

        const marco = el('div', 'dialogo');
        this.retrato = el('img', 'dialogo-retrato');
        this.retrato.alt = def.nombre;
        this.retrato.draggable = false;

        const caja = el('div', 'dialogo-caja');
        const cartel = el('div', 'dialogo-cartel');
        cartel.append(el('span', 'dialogo-nombre', def.nombre), el('span', 'dialogo-titulo', def.titulo));
        this.texto = el('p', 'dialogo-texto');
        this.texto.setAttribute('aria-live', 'polite');
        this.lista = el('ol', 'dialogo-menu');
        this.lista.hidden = true;
        this.seguir = el('span', 'dialogo-seguir', '▼');
        this.seguir.hidden = true;
        caja.append(cartel, botonCerrar(() => this.cerrar(), 'Terminar la charla'), this.texto, this.lista, this.seguir);
        caja.addEventListener('click', () => { if (!this.menu) this.confirmar(); });

        marco.append(this.retrato, caja);
        this.elemento.append(marco);
    }

    reemplazar(texto) {
        return texto.replace(/\{(\w+)\}/g, (todo, clave) => this.reemplazos[clave] ?? todo);
    }

    ponerRetrato(expresion) {
        const archivo = this.def.retratos[expresion] ?? Object.values(this.def.retratos)[0];
        this.retrato.src = `${this.urlRetratos}/${archivo}`;
    }

    /** Escribe una línea letra por letra. */
    tipear(linea) {
        this.ponerRetrato(linea.expresion);
        const completo = this.reemplazar(linea.texto);
        const letras = [...completo];
        let i = 0;
        this.texto.textContent = '';
        this.seguir.hidden = true;
        clearInterval(this.escribiendo?.timer);
        this.escribiendo = {
            completo,
            timer: setInterval(() => {
                i++;
                this.texto.textContent = letras.slice(0, i).join('');
                if (i % 2 === 0 && letras[i - 1]?.trim()) audio.blip(this.voz);
                if (i >= letras.length) this.terminarDeTipear();
            }, 1000 / LETRAS_POR_SEGUNDO),
        };
    }

    terminarDeTipear() {
        if (!this.escribiendo) return;
        clearInterval(this.escribiendo.timer);
        this.texto.textContent = this.escribiendo.completo;
        this.escribiendo = null;
        if (!this.menu) this.seguir.hidden = false;
    }

    esperar() {
        if (this.cerrada) return Promise.reject(new DialogoCerrado());
        return new Promise((resolve, reject) => { this.esperando = { resolve, reject }; });
    }

    resolver(valor) {
        const pendiente = this.esperando;
        this.esperando = null;
        pendiente?.resolve(valor);
    }

    /** Muestra las líneas de a una; cada una espera Espacio/Enter para seguir. */
    async decir(lineas) {
        for (const linea of lineas) {
            this.tipear(linea);
            await this.esperar();
        }
    }

    /**
     * Menú de opciones debajo del último texto. Devuelve el índice elegido.
     * Si se pasa `pregunta`, la tipea antes (como hace el examen).
     * `unaColumna`: para opciones largas (las del examen).
     */
    async elegir(etiquetas, { pregunta, unaColumna = false } = {}) {
        if (pregunta) this.tipear(pregunta);
        this.seguir.hidden = true;
        const botones = etiquetas.map((etiqueta, i) => {
            const boton = el('button', 'dialogo-opcion', etiqueta);
            boton.type = 'button';
            boton.addEventListener('mouseenter', () => this.marcar(i));
            boton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.marcar(i);
                this.confirmar();
            });
            const li = el('li');
            li.append(boton);
            return { li, boton };
        });
        this.lista.replaceChildren(...botones.map((b) => b.li));
        this.lista.classList.toggle('dialogo-menu--una', unaColumna);
        this.lista.hidden = false;
        this.menu = { botones: botones.map((b) => b.boton), indice: 0 };
        this.marcar(0, false);
        try {
            return await this.esperar();
        } finally {
            this.menu = null;
            this.lista.hidden = true;
            this.lista.replaceChildren();
        }
    }

    marcar(i, sonar = true) {
        const { botones } = this.menu;
        const nuevo = (i + botones.length) % botones.length;
        if (sonar && nuevo !== this.menu.indice) audio.blip(this.voz * 1.5, 0.02);
        this.menu.indice = nuevo;
        botones.forEach((b, j) => b.classList.toggle('dialogo-opcion--elegida', j === nuevo));
        botones[nuevo].scrollIntoView({ block: 'nearest' }); // si el menú tiene scroll, que se vea la elegida
    }

    /** Espacio/Enter: si está escribiendo, completa; si no, avanza o elige. */
    confirmar() {
        if (this.escribiendo) {
            this.terminarDeTipear();
            return;
        }
        this.resolver(this.menu ? this.menu.indice : undefined);
    }

    tecla(e) {
        if (CONFIRMAR.includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) this.confirmar();
            return;
        }
        if (e.code === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.cerrar();
            return;
        }
        if (this.menu && ['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (this.escribiendo) this.terminarDeTipear();
            this.marcar(this.menu.indice + (e.code === 'ArrowUp' || e.code === 'KeyW' ? -1 : 1));
        }
    }

    cerrar() {
        if (this.cerrada) return;
        this.cerrada = true;
        clearInterval(this.escribiendo?.timer);
        this.escribiendo = null;
        const pendiente = this.esperando;
        this.esperando = null;
        pendiente?.reject(new DialogoCerrado());
    }
}
