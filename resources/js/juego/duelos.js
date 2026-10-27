// Duelos del lado del cliente.
//   (b) retar, recibir la invitación y contestar.
//   (c) el combate: cuenta 3-2-1-¡YA!, moverse dentro del ring, espadazos, ❤️.
//   (d) el final: por vidas, por tiempo (el reloj llega a 0) o por desconexión del rival.
// El navegador PIDE y ANIMA; el servidor (DueloService) decide si un reto o un golpe vale.

import { audio } from './audio.js';
import { MenuJugador, VistaInvitacion } from './ui/reto.js';

const MS_COOLDOWN = 600; // igual que el servidor: así no mandamos golpes que va a rechazar
const MS_GRACIA_DESCONEXION = 2500; // un corte cortito de wifi no es un abandono

export class Duelos {
    /**
     * @param ganchos { alIniciar(d), alGolpe(d), alTerminar(d) }: lo que hace main.js con los
     *                personajes (teletransportar, parpadear, retroceder, avisos).
     */
    constructor({ red, hud, modales, url, yoId, ganchos = {} }) {
        this.yoId = yoId;
        this.red = red;
        this.hud = hud;
        this.modales = modales;
        this.url = url; // /duelos
        this.ganchos = ganchos;
        this.token = document.querySelector('meta[name="csrf-token"]').content;
        this.esperando = null; // { dueloId, nombre, timer } mientras esperamos la respuesta
        this.invitacion = null; // la ventana de invitación abierta, si hay
        this.combate = null; // el duelo que se está peleando en la arena (para todos los que están ahí)
        this.ultimoAtaque = 0;
        this.anuncio = null; // { texto, hasta }: "🏆 Ana gana" en el centro de la pantalla

        red.on('duelo-propuesto', (datos) => this.recibirInvitacion(datos));
        red.on('duelo-respondido', (datos) => this.recibirRespuesta(datos));
        red.on('duelo-iniciado', (datos) => this.iniciar(datos));
        red.on('duelo-golpe', (datos) => this.recibirGolpe(datos));
        red.on('duelo-terminado', (datos) => this.terminar(datos));
    }

    async pedir(ruta, cuerpo, metodo = 'POST') {
        const respuesta = await fetch(`${this.url}${ruta}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': this.token },
            body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo ?? {}),
        });
        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            // 204 sin cuerpo
        }
        if (respuesta.ok) return datos?.data ?? null;
        const error = new Error(
            datos?.errors ? Object.values(datos.errors)[0][0]
                : respuesta.status === 403 ? 'No podés hacer eso.'
                    : datos?.message || (respuesta.status === 429 ? '¡Más despacio!' : 'Algo salió mal.'),
        );
        error.status = respuesta.status;
        throw error;
    }

    // ───────────── (b) Retar ─────────────

    /** A al lado de otro jugador en la arena. */
    abrirMenu(jugador) {
        if (this.modales.abierto) return;
        if (this.combate) {
            this.hud.toast('Hay un duelo en curso: esperá a que termine.', 'error');
            return;
        }
        const menu = new MenuJugador(jugador, {
            alRetar: () => {
                this.modales.cerrar(menu);
                this.retar(jugador);
            },
            alCerrar: () => this.modales.cerrar(menu),
        });
        this.modales.abrir(menu);
    }

    async retar(jugador) {
        if (this.esperando) {
            this.hud.toast(`Ya estás esperando la respuesta de ${this.esperando.nombre}.`, 'error');
            return;
        }
        try {
            const duelo = await this.pedir('', { retado_id: jugador.id });
            this.hud.toast(`Retaste a ${jugador.nombre}. Esperando respuesta…`);
            audio.efecto('reto');
            const segundos = Math.max(1, Math.round((new Date(duelo.expira_at) - Date.now()) / 1000)) || 15;
            this.esperando = {
                dueloId: duelo.id,
                nombre: jugador.nombre,
                // Si no contesta a tiempo, la invitación vence sola en el servidor.
                timer: setTimeout(() => {
                    this.hud.toast(`${jugador.nombre} no respondió.`);
                    this.esperando = null;
                }, (segundos + 1) * 1000),
            };
        } catch (error) {
            this.hud.toast(error.message, 'error');
        }
    }

    recibirRespuesta({ duelo_id: dueloId, aceptado, retado }) {
        if (this.esperando?.dueloId !== dueloId) return;
        clearTimeout(this.esperando.timer);
        this.esperando = null;
        if (aceptado) {
            this.hud.toast(`¡${retado.nombre} aceptó el duelo!`);
        } else {
            this.hud.toast(`${retado.nombre} rechazó el duelo.`);
        }
    }

    recibirInvitacion(invitacion) {
        if (this.invitacion) return; // ya hay una abierta (el servidor igual no deja dos)
        audio.efecto('reto');
        const cerrar = () => {
            vista.detener();
            this.modales.cerrar(vista);
            this.invitacion = null;
        };
        const vista = new VistaInvitacion(invitacion, {
            alAceptar: async () => {
                cerrar();
                try {
                    await this.pedir(`/${invitacion.duelo_id}/aceptar`);
                } catch (error) {
                    this.hud.toast(error.message, 'error');
                }
            },
            alRechazar: () => {
                cerrar();
                this.pedir(`/${invitacion.duelo_id}/rechazar`).catch(() => {});
            },
            alVencer: () => {
                cerrar();
                this.hud.toast('La invitación al duelo se venció.');
            },
        });
        this.invitacion = vista;
        this.modales.abrir(vista, { sonido: false });
    }

    // ───────────── (c) El combate ─────────────

    /** DueloIniciado (por arena.1): lo reciben los dos que pelean y los que miran. */
    iniciar(d) {
        const ahora = performance.now();
        this.combate = {
            id: d.duelo_id,
            ids: [d.retador.id, d.retado.id],
            nombres: { [d.retador.id]: d.retador.nombre, [d.retado.id]: d.retado.nombre },
            vidas: { [d.retador.id]: d.vidas, [d.retado.id]: d.vidas },
            ring: d.ring,
            empieza: ahora + d.empieza_en_ms,
            termina: ahora + d.empieza_en_ms + d.duracion * 1000,
            ultimoNumero: null,
        };
        this.ganchos.alIniciar?.(d);
    }

    /** El que entra a la arena con un duelo ya empezado (GET /duelos/en-curso). */
    async consultarEnCurso() {
        try {
            const d = await this.pedir('/en-curso', null, 'GET');
            if (!d) return;
            const ahora = performance.now();
            this.combate = {
                id: d.duelo_id,
                ids: [d.retador.id, d.retado.id],
                nombres: { [d.retador.id]: d.retador.nombre, [d.retado.id]: d.retado.nombre },
                vidas: d.vidas,
                ring: d.ring,
                empieza: ahora + d.empieza_en_ms,
                termina: ahora + d.termina_en_ms,
                ultimoNumero: null,
            };
            this.ganchos.alIniciar?.({ ...d, tarde: true });
        } catch {
            // sin info: no pasa nada, el próximo evento la trae
        }
    }

    /** Salimos de la arena: lo que pase allá ya no nos llega. */
    olvidar() {
        this.combate = null;
    }

    participa(id) {
        return !!this.combate?.ids.includes(id);
    }

    enRing(x, y) {
        const r = this.combate?.ring;
        return !!r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    }

    /** Los que pelean no se mueven durante la cuenta 3-2-1. */
    congelado(id) {
        return this.participa(id) && performance.now() < this.combate.empieza;
    }

    /** Durante un duelo: los que pelean no salen del ring y los demás no entran. */
    puedePisar(id, x, y) {
        if (!this.combate) return true;
        return this.participa(id) ? this.enRing(x, y) : !this.enRing(x, y);
    }

    peleando(id) {
        return this.participa(id) && performance.now() >= this.combate.empieza;
    }

    /**
     * A durante el duelo. La animación sale siempre; el POST solo si el rival está en la
     * casilla de enfrente (eso lo decide el cliente: el servidor no sabe dónde está cada uno).
     */
    async atacar(yo, rival, enfrente) {
        if (!this.peleando(yo.id)) return;
        const ahora = performance.now();
        if (ahora - this.ultimoAtaque < MS_COOLDOWN) return;
        this.ultimoAtaque = ahora;

        yo.espadazo();
        audio.espadazo();
        this.red.susurrar('espada', { id: yo.id, dir: yo.dir });
        if (!rival || !enfrente) return;

        try {
            await this.pedir(`/${this.combate.id}/golpe`, { objetivo_id: rival.id, dir: yo.dir });
        } catch (error) {
            // 429 (muy rápido) es normal si se superpone con la animación: no molestamos.
            if (error.status !== 429) this.hud.toast(error.message, 'error');
        }
    }

    /** DueloGolpe: el servidor dio un golpe por válido. */
    recibirGolpe(d) {
        if (this.combate?.id !== d.duelo_id) return;
        this.combate.vidas = d.vidas;
        audio.golpe();
        this.ganchos.alGolpe?.(d);
    }

    /** DueloTerminado: por vidas, por tiempo o por abandono. Lo decide el servidor. */
    terminar(d) {
        if (this.combate?.id !== d.duelo_id) return;
        const { nombres, ids, ring } = this.combate;
        this.combate = null;
        const texto = d.empate ? '¡Empate!' : `🏆 ${nombres[d.ganador_id]} gana`;
        this.anuncio = { texto, hasta: performance.now() + 3500 };
        audio.efecto(d.empate ? 'ya' : 'victoria');
        this.ganchos.alTerminar?.({ ...d, nombres, ids, ring });
    }

    /**
     * Se terminaron los 60 s en nuestro reloj: los que pelean le piden al servidor que cierre
     * el duelo (él chequea la hora; si llegan los dos pedidos, el segundo no hace nada).
     */
    async avisarFinDeTiempo() {
        const c = this.combate;
        if (!c || c.avisoTiempo || !this.participa(this.yoId)) return;
        c.avisoTiempo = true;
        try {
            await this.pedir(`/${c.id}/finalizar`);
        } catch (error) {
            // "Todavía no se terminó el tiempo" (los relojes difieren un poquito): reintento.
            if (error.status === 422) setTimeout(() => { if (this.combate === c) c.avisoTiempo = false; }, 1000);
        }
    }

    /**
     * leaving(): si se fue mi rival, espero un poco (por si fue un corte breve y vuelve)
     * y le aviso al servidor. Él le pregunta a Reverb si de verdad no está.
     */
    alguienSalio(jugador) {
        const c = this.combate;
        if (!c || !this.participa(this.yoId) || !this.participa(jugador.id) || jugador.id === this.yoId) return;
        setTimeout(async () => {
            if (this.combate !== c) return; // ya terminó por otro lado
            try {
                await this.pedir(`/${c.id}/abandono`);
            } catch {
                // "sigue conectado": volvió a tiempo, el duelo sigue
            }
        }, MS_GRACIA_DESCONEXION);
    }

    vidasDe(id) {
        return this.participa(id) ? this.combate.vidas[id] : null;
    }

    /** Lo que muestra el centro de la pantalla: '3', '2', '1', '¡YA!', el ganador o nada. */
    cuenta() {
        if (this.anuncio && performance.now() < this.anuncio.hasta) return this.anuncio.texto;
        this.anuncio = null;
        if (!this.combate) return null;
        const falta = this.combate.empieza - performance.now();
        let texto = null;
        if (falta > 0) texto = String(Math.ceil(falta / 1000));
        else if (falta > -800) texto = '¡YA!';
        if (texto && texto !== this.combate.ultimoNumero) {
            this.combate.ultimoNumero = texto;
            audio.efecto(texto === '¡YA!' ? 'ya' : 'cuenta');
        }
        return texto;
    }

    /** "⚔️ Ana vs Beto · 0:47" mientras dura (y suelta el ring si se pasó el tiempo). */
    reloj() {
        if (!this.combate) return null;
        const restante = Math.max(0, this.combate.termina - performance.now());
        if (restante === 0) {
            this.avisarFinDeTiempo();
            if (performance.now() > this.combate.termina + 10000) {
                // Nunca llegó el DueloTerminado (¿Reverb caído?): soltamos el ring igual.
                this.combate = null;
                return null;
            }
        }
        const [a, b] = this.combate.ids;
        const s = Math.ceil(restante / 1000);
        return `⚔️ ${this.combate.nombres[a]} vs ${this.combate.nombres[b]} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
}
