// HUD: wifi (estado de la conexión) + contador arriba a la derecha, toasts arriba al centro.
// Todo el texto que viene de usuarios va con textContent, nunca innerHTML (anti-XSS).

import { dibujarGrilla, crearCanvas } from '../pixel.js';
import { audio } from '../audio.js';

const WIFI = [
    '.XXXXXXX.',
    'X.......X',
    '..XXXXX..',
    '.X.....X.',
    '...XXX...',
    '.........',
    '....X....',
];

// Estados de pusher-js → color y texto. "unavailable" es cuando no logra llegar al servidor
// (por ejemplo, Reverb apagado): por eso va en rojo, igual que "sin conexión".
const ESTADOS = {
    connected: { color: '#4cd964', texto: 'Conectado' },
    connecting: { color: '#ffcc00', texto: 'Reconectando…' },
    initialized: { color: '#ffcc00', texto: 'Conectando…' },
    unavailable: { color: '#ff3b30', texto: 'Sin conexión con el servidor de tiempo real' },
    failed: { color: '#ff3b30', texto: 'Sin conexión' },
    disconnected: { color: '#ff3b30', texto: 'Sin conexión' },
};

const DURACION_TOAST = 3000;

// Ancho mínimo del espacio libre al costado del mapa para poner el chat ahí.
export const MARGEN_MINIMO_LATERAL = 240;

export class Hud {
    constructor(raiz) {
        this.raiz = raiz;
        this.contadorEl = raiz.querySelector('[data-contador]');
        this.wifiEl = raiz.querySelector('[data-wifi]');
        this.toastsEl = raiz.querySelector('[data-toasts]');

        this.wifiCanvas = crearCanvas(WIFI[0].length * 3, WIFI.length * 3);
        this.wifiEl.prepend(this.wifiCanvas);
        this.wifi('connected');
    }

    /** `margen`: px libres a cada costado del canvas. */
    acomodar(margen) {
        this.lateral = margen >= MARGEN_MINIMO_LATERAL;
        this.raiz.classList.toggle('hud--lateral', this.lateral);
        this.raiz.style.setProperty('--margen', `${Math.max(0, margen)}px`);
    }

    mostrar() {
        this.raiz.hidden = false;
    }

    wifi(estado) {
        const { color, texto } = ESTADOS[estado] ?? ESTADOS.connecting;
        const ctx = this.wifiCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.wifiCanvas.width, this.wifiCanvas.height);
        dibujarGrilla(ctx, WIFI, { X: color }, 0, 0, 3);
        this.wifiEl.title = texto;
        this.wifiEl.setAttribute('aria-label', texto);
        this.wifiEl.dataset.estado = estado;
    }

    contador(cantidad, cupo) {
        this.contadorEl.textContent = `${cantidad}/${cupo}`;
    }

    /** Aviso arriba al centro. tipo: 'info' | 'error' */
    toast(texto, tipo = 'info') {
        const el = document.createElement('div');
        el.className = tipo === 'error' ? 'toast toast--error' : 'toast';
        if (tipo === 'error') audio.efecto('error');
        el.textContent = texto;
        this.toastsEl.append(el);
        // Máximo 4 a la vista: si entra mucha gente junta no tapan la pantalla.
        while (this.toastsEl.children.length > 4) this.toastsEl.firstElementChild.remove();
        setTimeout(() => {
            el.classList.add('toast--saliendo');
            setTimeout(() => el.remove(), 400);
        }, DURACION_TOAST);
    }
}
