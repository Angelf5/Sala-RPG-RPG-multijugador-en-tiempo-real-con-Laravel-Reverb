// Easter egg: el diario arrugado del piso. Se abre como un diario viejo (papel amarillento,
// cabecera gótica, noticia principal y dos secundarias en columnas). Los textos están en
// data/diario.json para poder editarlos sin tocar código.

import DIARIO from '../data/diario.json';
import { botonCerrar, el } from './modales.js';

/** Párrafo donde lo que está entre `comillas invertidas` se muestra como código (siempre textContent). */
function parrafo(clase, texto) {
    const p = el('p', clase);
    texto.split('`').forEach((trozo, i) => p.append(i % 2 ? el('code', 'diario-codigo', trozo) : trozo));
    return p;
}

/**
 * La letra gótica en MAYÚSCULAS es casi ilegible ("EL DJARJO…"): los diarios de verdad la usan
 * con minúsculas e iniciales. Se muestra así; el texto original queda para lectores de pantalla.
 */
function comoCabecera(texto) {
    const chicas = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
    return texto.toLowerCase().split(' ')
        .map((p, i) => (i > 0 && chicas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join(' ');
}

export class VistaDiario {
    constructor({ alCerrar }) {
        this.alCerrar = alCerrar;

        this.elemento = el('div', 'modal modal--diario');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', DIARIO.cabecera.titulo);
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) this.alCerrar(); });

        const hoja = el('article', 'diario');

        const cabecera = el('header', 'diario-cabecera');
        const titulo = el('h2', 'diario-titulo', comoCabecera(DIARIO.cabecera.titulo));
        titulo.setAttribute('aria-label', DIARIO.cabecera.titulo);
        cabecera.append(
            titulo,
            el('p', 'diario-subtitulo', DIARIO.cabecera.subtitulo),
        );

        const principal = el('section', 'diario-principal');
        principal.append(
            el('h3', 'diario-titular', DIARIO.principal.titulo),
            parrafo('diario-texto diario-texto--columnas', DIARIO.principal.texto),
        );

        const secundarias = el('div', 'diario-secundarias');
        for (const noticia of DIARIO.secundarias) {
            const nota = el('section', 'diario-nota');
            nota.append(el('h4', 'diario-titular-chico', noticia.titulo), parrafo('diario-texto', noticia.texto));
            secundarias.append(nota);
        }

        hoja.append(botonCerrar(() => this.alCerrar()), cabecera, principal, secundarias);
        this.elemento.append(hoja);
    }

    tecla(e) {
        if (!['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code) || e.repeat) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.alCerrar();
    }
}
