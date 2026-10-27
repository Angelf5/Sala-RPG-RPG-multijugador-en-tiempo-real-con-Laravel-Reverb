// Sonidos generados con WebAudio (sin archivos): osciladores cortos = sonidos retro.
// El volumen sale de Ajustes; M activa o silencia todo.

import { ajustes } from './ajustes.js';

const VOLUMEN_MAXIMO = 0.12; // los osciladores cuadrados son fuertes: con esto alcanza
const EVENTOS_DE_GESTO = ['touchend', 'pointerup', 'click', 'keydown'];

// Efectos: lista de notas [frecuencia Hz, duración s] que suenan una después de otra.
const EFECTOS = {
    entra: { tipo: 'square', notas: [[523, 0.07], [784, 0.1]] },
    sale: { tipo: 'square', notas: [[523, 0.07], [392, 0.1]] },
    mensaje: { tipo: 'sine', notas: [[988, 0.06]] },
    abrir: { tipo: 'triangle', notas: [[660, 0.04], [990, 0.05]] },
    pagina: { tipo: 'triangle', notas: [[1400, 0.025]] },
    correcta: { tipo: 'square', notas: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.16]] },
    incorrecta: { tipo: 'square', notas: [[247, 0.12], [196, 0.22]] },
    error: { tipo: 'square', notas: [[180, 0.12]] },
    cuenta: { tipo: 'square', notas: [[523, 0.08]] },
    ya: { tipo: 'square', notas: [[784, 0.08], [1047, 0.2]] },
    victoria: { tipo: 'square', notas: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [784, 0.08], [1047, 0.3]] },
    reto: { tipo: 'square', notas: [[392, 0.09], [523, 0.09], [659, 0.09], [784, 0.22]] }, // corneta: ¡a duelo!
};

class Audio {
    constructor() {
        this.ctx = null; // se crea recién con la primera interacción: el navegador no deja sonar antes

        // iOS solo habilita el audio si se crea Y se hace sonar algo DENTRO de un toque.
        // Con el primer toque (o tecla) creamos el contexto y tocamos un sonido mudo.
        const desbloquear = () => {
            const ctx = this.contexto();
            if (!ctx) return;
            const silencio = ctx.createBuffer(1, 1, 22050);
            const fuente = ctx.createBufferSource();
            fuente.buffer = silencio;
            fuente.connect(ctx.destination);
            fuente.start(0);
            if (ctx.state === 'running') {
                for (const ev of EVENTOS_DE_GESTO) window.removeEventListener(ev, desbloquear, true);
            }
        };
        for (const ev of EVENTOS_DE_GESTO) window.addEventListener(ev, desbloquear, true);
    }

    get silencio() {
        return ajustes.get('silencio') || ajustes.get('volumen') === 0;
    }

    contexto() {
        // Hasta el primer gesto real del usuario (tecla o toque), el navegador no deja sonar y
        // crear el AudioContext antes solo deja un warning en la consola. Ese sonido se saltea.
        if (!this.ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
        if (!this.ctx) {
            const Contexto = window.AudioContext ?? window.webkitAudioContext;
            if (!Contexto) return null;
            this.ctx = new Contexto();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    nota(ctx, tipo, frecuencia, inicio, duracion, volumen) {
        const osc = ctx.createOscillator();
        const gan = ctx.createGain();
        osc.type = tipo;
        osc.frequency.value = frecuencia;
        gan.gain.setValueAtTime(volumen, inicio);
        gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
        osc.connect(gan).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + duracion);
    }

    /** Un blip cortito (la "voz" de los NPCs al escribir). */
    blip(frecuencia = 520, duracion = 0.035) {
        if (this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const variacion = 0.97 + Math.random() * 0.06; // que no suene como una máquina
        this.nota(ctx, 'square', frecuencia * variacion, ctx.currentTime, duracion, VOLUMEN_MAXIMO * 0.5 * ajustes.get('volumen'));
    }

    efecto(nombre) {
        const efecto = EFECTOS[nombre];
        if (!efecto || this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const volumen = VOLUMEN_MAXIMO * ajustes.get('volumen');
        let t = ctx.currentTime;
        for (const [frecuencia, duracion] of efecto.notas) {
            this.nota(ctx, efecto.tipo, frecuencia, t, duracion, volumen);
            t += duracion * 0.9;
        }
    }

    /**
     * Papel que se arruga/despliega: ruido blanco en ráfagas cortas, filtrado para que
     * suene "seco" (sin agudos ni graves). Lo usa el diario del easter egg.
     */
    papel() {
        if (this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const duracion = 0.45;
        const muestras = Math.floor(ctx.sampleRate * duracion);
        const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
        const datos = buffer.getChannelData(0);
        for (let i = 0; i < muestras; i++) {
            const t = i / muestras;
            const envolvente = Math.sin(Math.PI * t) ** 0.6; // sube y baja
            const crujido = Math.random() < 0.15 ? 1 : 0.25; // ráfagas: el papel no suena parejo
            datos[i] = (Math.random() * 2 - 1) * envolvente * crujido;
        }
        const fuente = ctx.createBufferSource();
        fuente.buffer = buffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.value = 2600;
        filtro.Q.value = 0.7;
        const gan = ctx.createGain();
        gan.gain.value = VOLUMEN_MAXIMO * 2.2 * ajustes.get('volumen');
        fuente.connect(filtro).connect(gan).connect(ctx.destination);
        fuente.start();
    }

    /** Ruido blanco filtrado y con caída: base del espadazo y del golpe. */
    ruido({ duracion, frecuencia, q = 0.8, tipo = 'bandpass', volumen = 1 }) {
        if (this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const muestras = Math.floor(ctx.sampleRate * duracion);
        const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
        const datos = buffer.getChannelData(0);
        for (let i = 0; i < muestras; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras) ** 2;
        const fuente = ctx.createBufferSource();
        fuente.buffer = buffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = tipo;
        filtro.frequency.value = frecuencia;
        filtro.Q.value = q;
        const gan = ctx.createGain();
        gan.gain.value = VOLUMEN_MAXIMO * 2 * volumen * ajustes.get('volumen');
        fuente.connect(filtro).connect(gan).connect(ctx.destination);
        fuente.start();
    }

    /** "Swish" de la espada cortando el aire. */
    espadazo() {
        this.ruido({ duracion: 0.16, frecuencia: 4200, tipo: 'highpass', volumen: 0.8 });
    }

    /** Golpe que pegó: ruido grave + un tono que cae. */
    golpe() {
        this.ruido({ duracion: 0.2, frecuencia: 380, q: 1.2, volumen: 1.4 });
        this.efecto('error');
    }

    /** M: devuelve true si quedó en silencio. */
    alternarSilencio() {
        const silencio = !ajustes.get('silencio');
        ajustes.set('silencio', silencio);
        return silencio;
    }
}

export const audio = new Audio();
