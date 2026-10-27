// Pantalla de carga: barra con progreso real y tu personaje caminando arriba de la barra.

import { CICLO_CAMINAR, dibujarSprite } from '../sprites.js';
import { FRAME_CAMINAR_MS } from '../config.js';

export class PantallaCarga {
    constructor(raiz) {
        this.raiz = raiz;
        this.relleno = raiz.querySelector('[data-relleno]');
        this.porcentaje = raiz.querySelector('[data-porcentaje]');
        this.personaje = raiz.querySelector('[data-personaje]');
        this.cajaError = raiz.querySelector('[data-error]');
        this.textoError = raiz.querySelector('[data-error-texto]');
        this.botonReintentar = raiz.querySelector('[data-reintentar]');

        this.objetivo = 0; // progreso real (lo que ya cargó)
        this.mostrado = 0; // lo que dibuja la barra (avanza suave hacia el objetivo)
        this.hoja = null;
        this.caminando = true;
        this.alLlegar = null;

        this.bucle = this.bucle.bind(this);
        this.raf = requestAnimationFrame(this.bucle);
    }

    progreso(pct) {
        this.objetivo = Math.max(this.objetivo, Math.min(100, pct));
    }

    /** Vuelve atrás la barra (por ejemplo, al reintentar la conexión). */
    retroceder(pct) {
        this.objetivo = pct;
        this.mostrado = Math.min(this.mostrado, pct);
    }

    ponerPersonaje(hoja) {
        this.hoja = hoja;
    }

    bucle(t) {
        // Avanza ~1 % por frame como máximo para que la barra no salte.
        this.mostrado += Math.min(1, this.objetivo - this.mostrado);
        const pct = Math.round(this.mostrado);
        this.relleno.style.width = `${this.mostrado}%`;
        this.porcentaje.textContent = `${pct}%`;
        this.personaje.style.left = `${this.mostrado}%`;

        if (this.hoja) {
            const ctx = this.personaje.getContext('2d');
            ctx.clearRect(0, 0, this.personaje.width, this.personaje.height);
            const dir = this.caminando ? 'derecha' : 'abajo';
            const frame = this.caminando ? CICLO_CAMINAR[Math.floor(t / FRAME_CAMINAR_MS) % 4] : 0;
            dibujarSprite(ctx, this.hoja, dir, frame, 0, 0);
        }

        if (this.alLlegar && this.mostrado >= 100) {
            this.alLlegar();
            this.alLlegar = null;
        }
        this.raf = requestAnimationFrame(this.bucle);
    }

    mostrarError(mensaje, alReintentar = null) {
        this.caminando = false;
        this.textoError.textContent = mensaje;
        this.botonReintentar.hidden = !alReintentar;
        this.botonReintentar.onclick = alReintentar;
        this.cajaError.hidden = false;
    }

    ocultarError() {
        this.caminando = true;
        this.cajaError.hidden = true;
    }

    /** Espera a que la barra llegue a 100 %, hace el fundido y se quita. */
    terminar() {
        return new Promise((resolve) => {
            this.alLlegar = () => {
                this.raiz.classList.add('carga--saliendo');
                setTimeout(() => {
                    cancelAnimationFrame(this.raf);
                    this.raiz.hidden = true;
                    resolve();
                }, 600);
            };
        });
    }
}
