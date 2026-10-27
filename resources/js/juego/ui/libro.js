// Un libro abierto: dos páginas en pantallas anchas, una en las angostas.
// ←/→ pasan de página, Esc cierra. Los bloques de código van en monoespaciada sobre fondo oscuro
// y, si el libro tiene "en_este_juego", la última página lo destaca.

import { iconoCanvas } from '../iconos.js';
import { botonCerrar, el } from './modales.js';
import { audio } from '../audio.js';

const DOS_PAGINAS = window.matchMedia('(min-width: 760px)');

export class VistaLibro {
    /**
     * @param cargar   Promise con el libro (GET /libros/{slug})
     * @param alCerrar () => void
     */
    constructor(resumen, estante, cargar, { alCerrar }) {
        this.alCerrar = alCerrar;
        this.paginas = [];
        this.inicio = 0; // índice de la primera página visible

        this.elemento = el('div', 'modal modal--libro');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', resumen.titulo);
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) this.alCerrar(); });

        this.libro = el('article', 'libro');
        this.libro.style.setProperty('--color-estante', estante.color);

        const cabecera = el('header', 'libro-cabecera');
        const etiqueta = el('p', 'libro-etiqueta');
        etiqueta.append(iconoCanvas(estante.slug, estante.color, 2), ` ${estante.nombre} · ${resumen.clase}`);
        cabecera.append(etiqueta, el('h2', 'libro-titulo', resumen.titulo), botonCerrar(() => this.alCerrar(), 'Volver al estante'));

        this.hoja = el('div', 'libro-paginas');
        this.hoja.append(el('p', 'libro-cargando', 'Abriendo el libro…'));

        this.anterior = el('button', 'libro-flecha', '◀');
        this.anterior.type = 'button';
        this.anterior.setAttribute('aria-label', 'Página anterior');
        this.anterior.addEventListener('click', () => this.pasar(-1));
        this.siguiente = el('button', 'libro-flecha', '▶');
        this.siguiente.type = 'button';
        this.siguiente.setAttribute('aria-label', 'Página siguiente');
        this.siguiente.addEventListener('click', () => this.pasar(1));
        this.numero = el('span', 'libro-numero');

        const pie = el('footer', 'libro-pie');
        pie.append(this.anterior, this.numero, this.siguiente);

        this.libro.append(cabecera, this.hoja, pie, el('p', 'modal-ayuda', '←→ pasar página · Esc volver al estante'));
        this.elemento.append(this.libro);

        this.alCambiarAncho = () => this.mostrar();
        DOS_PAGINAS.addEventListener('change', this.alCambiarAncho);

        cargar.then((libro) => {
            this.paginas = [...libro.paginas.map((p) => ({ ...p, tipo: 'normal' }))];
            if (libro.en_este_juego) this.paginas.push({ tipo: 'juego', texto: libro.en_este_juego });
            this.mostrar();
        }).catch((error) => {
            this.hoja.replaceChildren(el('p', 'libro-cargando', error.message || 'No se pudo abrir el libro.'));
        });
    }

    get porVista() {
        return DOS_PAGINAS.matches ? 2 : 1;
    }

    pasar(sentido) {
        const nuevo = this.inicio + sentido * this.porVista;
        if (nuevo < 0 || nuevo >= this.paginas.length) return;
        this.inicio = nuevo;
        audio.efecto('pagina');
        this.mostrar();
    }

    pagina(p, numero) {
        const seccion = el('section', p.tipo === 'juego' ? 'pagina pagina--juego' : 'pagina');
        if (p.tipo === 'juego') seccion.append(el('h3', 'pagina-juego-titulo', '🎮 En este juego…'));
        if (p.texto) seccion.append(el('p', 'pagina-texto', p.texto));
        if (p.codigo) {
            const pre = el('pre', 'pagina-codigo');
            pre.append(el('code', null, p.codigo)); // textContent: el código se ve, no se interpreta
            seccion.append(pre);
        }
        seccion.append(el('span', 'pagina-numero', String(numero)));
        return seccion;
    }

    mostrar() {
        if (!this.paginas.length) return;
        // Al pasar de 1 a 2 páginas por vista, que la izquierda sea siempre impar (1-2, 3-4…).
        this.inicio -= this.inicio % this.porVista;
        const visibles = this.paginas.slice(this.inicio, this.inicio + this.porVista);
        this.hoja.replaceChildren(...visibles.map((p, i) => this.pagina(p, this.inicio + i + 1)));
        this.hoja.classList.toggle('libro-paginas--doble', this.porVista === 2);

        const desde = this.inicio + 1;
        const hasta = this.inicio + visibles.length;
        this.numero.textContent = desde === hasta ? `${desde} / ${this.paginas.length}` : `${desde}–${hasta} / ${this.paginas.length}`;
        this.anterior.disabled = this.inicio === 0;
        this.siguiente.disabled = this.inicio + this.porVista >= this.paginas.length;
    }

    destruir() {
        DOS_PAGINAS.removeEventListener('change', this.alCambiarAncho);
    }

    tecla(e) {
        const acciones = {
            ArrowLeft: () => this.pasar(-1),
            KeyA: () => this.pasar(-1),
            ArrowRight: () => this.pasar(1),
            KeyD: () => this.pasar(1),
            Escape: () => this.alCerrar(),
        };
        const accion = acciones[e.code];
        if (!accion) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        accion();
    }
}
