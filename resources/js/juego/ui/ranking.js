// Cartel de ranking de la arena (A para leer): top 10 de victorias desde GET /duelos/ranking.
// Los nombres van con textContent (vienen de los usuarios: nunca innerHTML).

import { botonCerrar, el } from './modales.js';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export class VistaRanking {
    constructor(cargar, { alCerrar }) {
        this.alCerrar = alCerrar;
        this.elemento = el('div', 'modal');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', 'Ranking de duelos');
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) alCerrar(); });

        const cartel = el('section', 'ranking');
        const cabecera = el('header', 'ranking-cabecera');
        cabecera.append(el('h2', 'ranking-titulo', '🏆 Ranking de duelos'), botonCerrar(alCerrar));
        this.lista = el('ol', 'ranking-lista');
        this.lista.append(el('li', 'ranking-vacio', 'Cargando…'));
        cartel.append(cabecera, el('p', 'ranking-sub', 'Top 10 por victorias'), this.lista);
        this.elemento.append(cartel);

        cargar.then((filas) => this.mostrar(filas)).catch(() => {
            this.lista.replaceChildren(el('li', 'ranking-vacio', 'No se pudo cargar el ranking.'));
        });
    }

    mostrar(filas) {
        if (!filas.length) {
            this.lista.replaceChildren(el('li', 'ranking-vacio', 'Todavía no hay duelos ganados. ¡Retá a alguien en el ring!'));
            return;
        }
        this.lista.replaceChildren(...filas.map((f) => {
            const li = el('li', 'ranking-fila');
            const punto = el('span', 'sala-punto');
            punto.style.background = f.color;
            li.append(
                el('span', 'ranking-pos', MEDALLAS[f.posicion - 1] ?? `${f.posicion}.`),
                punto,
                el('span', 'ranking-nombre', f.nombre),
                el('span', 'ranking-victorias', `${f.victorias} ${f.victorias === 1 ? 'victoria' : 'victorias'}`),
            );
            return li;
        }));
    }

    tecla(e) {
        if (!['Escape', 'Enter', 'KeyE', 'Space'].includes(e.code) || e.repeat) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.alCerrar();
    }
}
