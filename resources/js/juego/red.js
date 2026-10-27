// Conexión en tiempo real con Reverb usando Laravel Echo (protocolo de Pusher).
// Hay UN WebSocket (conectar) y, por encima, el canal de presencia de la sala donde estás
// (unirse): sala.1 en la biblioteca, arena.1 en la arena. Al cruzar una puerta se deja un
// canal y se entra al otro, sin reconectar el WebSocket.
// Por el canal viajan here / joining / leaving, los whispers y el chat.

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

export class ErrorRed extends Error {
    constructor(tipo, mensaje) {
        super(mensaje);
        this.tipo = tipo; // 'timeout' | 'canal'
    }
}

const WHISPERS = ['mover', 'estoy', 'espada'];

export class Red {
    constructor() {
        this.echo = null;
        this.canal = null;
        this.nombreCanal = null;
        this.oyentes = {};
    }

    /**
     * Suscribirse a eventos de la red:
     *   'here' (jugadores)   el canal se volvió a suscribir solo, ej. después de una reconexión
     *   'entra' / 'sale' (jugador)
     *   'mover' / 'estoy' (datos, idRemitente)   whispers de otros jugadores
     *   'estado' (estado)   connecting | connected | unavailable | failed | disconnected
     *   'mensaje' (mensaje)   evento MensajeEnviado del chat (lo emite Laravel, no un cliente)
     *   'duelo-propuesto' / 'duelo-respondido' (datos)   por tu canal privado
     *   'duelo-iniciado' / 'duelo-golpe' / 'duelo-terminado' (datos)   por el canal de la arena
     *   'espada' (datos, idRemitente)   whisper: alguien tiró un espadazo (solo la animación)
     */
    on(evento, fn) {
        (this.oyentes[evento] ??= []).push(fn);
        return this;
    }

    emitir(evento, ...args) {
        (this.oyentes[evento] ?? []).forEach((fn) => fn(...args));
    }

    get conectado() {
        return this.echo?.connector.pusher.connection.state === 'connected';
    }

    /**
     * Id de nuestro WebSocket. Va en el header X-Socket-ID de POST /chat para que
     * broadcast(...)->toOthers() no nos devuelva nuestro propio mensaje.
     */
    socketId() {
        return this.echo?.socketId() ?? null;
    }

    /** Manda un whisper a todos los demás del canal (Reverb lo reenvía, Laravel no se entera). */
    susurrar(evento, datos) {
        if (this.canal && this.conectado) this.canal.whisper(evento, datos);
    }

    /** Abre el WebSocket con Reverb. Resuelve cuando está conectado (o rechaza por timeout). */
    conectar({ timeoutMs }) {
        this.desconectar();

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.desconectar();
                reject(new ErrorRed('timeout', 'No se pudo conectar al servidor de tiempo real. ¿Está corriendo php artisan reverb:start?'));
            }, timeoutMs);

            this.echo = new Echo({
                broadcaster: 'reverb',
                Pusher,
                key: import.meta.env.VITE_REVERB_APP_KEY,
                wsHost: import.meta.env.VITE_REVERB_HOST,
                wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
                wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
                forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
                enabledTransports: ['ws', 'wss'],
            });

            const conexion = this.echo.connector.pusher.connection;
            conexion.bind('state_change', ({ current }) => this.emitir('estado', current));
            conexion.bind('connected', () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    /**
     * Se une al canal de presencia de una sala (y deja el anterior, si había).
     * Resuelve con la lista de here(). Laravel lo autoriza en routes/channels.php: solo deja
     * entrar al canal de la sala que tenés guardada (por eso antes se hace POST /posicion).
     */
    unirse(nombreCanal, { timeoutMs }) {
        this.salirDelCanal();

        return new Promise((resolve, reject) => {
            let primero = true;
            const timer = setTimeout(() => {
                if (!primero) return;
                primero = false;
                this.salirDelCanal();
                reject(new ErrorRed('timeout', 'El servidor de tiempo real no respondió. Probá de nuevo.'));
            }, timeoutMs);

            const canal = this.echo.join(nombreCanal);
            this.canal = canal;
            this.nombreCanal = nombreCanal;
            // Si ya dejamos este canal (cambio de sala), ignoramos lo que siga llegando de él.
            const vigente = () => this.canal === canal;

            canal
                .here((jugadores) => {
                    if (!vigente()) return;
                    if (primero) {
                        primero = false;
                        clearTimeout(timer);
                        resolve(jugadores);
                    } else {
                        // pusher-js se reconectó y re-suscribió solo: lista actualizada.
                        this.emitir('here', jugadores);
                    }
                })
                .joining((jugador) => { if (vigente()) this.emitir('entra', jugador); })
                .leaving((jugador) => { if (vigente()) this.emitir('sale', jugador); })
                .error((error) => {
                    if (!primero || !vigente()) return;
                    primero = false;
                    clearTimeout(timer);
                    this.salirDelCanal();
                    reject(new ErrorRed('canal', `El servidor no te dejó entrar (código ${error?.status ?? '?'}). Probá recargar la página.`));
                });

            // El punto inicial le dice a Echo que use el nombre tal cual (el de broadcastAs()),
            // sin anteponerle el namespace App\Events.
            canal.listen('.MensajeEnviado', (mensaje) => { if (vigente()) this.emitir('mensaje', mensaje); });
            // Duelos: solo llegan por el canal de la arena (arena.1), a peleadores y espectadores.
            canal.listen('.DueloIniciado', (d) => { if (vigente()) this.emitir('duelo-iniciado', d); });
            canal.listen('.DueloGolpe', (d) => { if (vigente()) this.emitir('duelo-golpe', d); });
            canal.listen('.DueloTerminado', (d) => { if (vigente()) this.emitir('duelo-terminado', d); });

            for (const evento of WHISPERS) {
                // Reverb agrega el user_id autenticado de quien mandó el whisper (metadata).
                // Usamos ese y no el id que viene en los datos, que el cliente podría falsificar.
                canal.listenForWhisper(evento, (datos, metadata) => {
                    if (!vigente()) return;
                    const id = Number(metadata?.user_id ?? datos?.id);
                    if (Number.isFinite(id)) this.emitir(evento, datos, id);
                });
            }
        });
    }

    /**
     * Canal PRIVADO del jugador (App.Models.User.{id}): las invitaciones a duelo y sus
     * respuestas llegan solo a quien corresponde, estés en la sala que estés.
     */
    escucharPrivado(userId) {
        this.echo.private(`App.Models.User.${userId}`)
            .listen('.DueloPropuesto', (datos) => this.emitir('duelo-propuesto', datos))
            .listen('.DueloRespondido', (datos) => this.emitir('duelo-respondido', datos));
    }

    salirDelCanal() {
        if (this.echo && this.nombreCanal) this.echo.leave(this.nombreCanal);
        this.canal = null;
        this.nombreCanal = null;
    }

    desconectar() {
        this.salirDelCanal();
        this.echo?.disconnect();
        this.echo = null;
    }
}
