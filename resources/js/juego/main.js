// Arranque del juego: pantalla de carga con progreso real → sala.
//   fuentes 10 % → sprites 30 % → retratos 55 % → Echo conectado 80 % → here() 100 %
// Hay varias salas (biblioteca y arena): cada una con su mapa y su canal de presencia.

import { RETRATOS, TILE, TIMEOUT_REVERB_MS } from './config.js';
import { apariencia, obtenerSprites } from './sprites.js';
import { SALAS } from './mapa.js';
import { dibujarSala } from './mapa-dibujo.js';
import { dibujarLuces } from './arena-dibujo.js';
import { crearNpcs } from './npcs.js';
import { Personaje, delta } from './personaje.js';
import { Entrada } from './entrada.js';
import { Red } from './red.js';
import { Multijugador } from './multijugador.js';
import { crearGuardado } from './posicion.js';
import { PantallaCarga } from './ui/carga.js';
import { Hud } from './ui/hud.js';
import { Chat } from './ui/chat.js';
import { Biblioteca } from './biblioteca.js';
import { Modales } from './ui/modales.js';
import { MenuEstante } from './ui/estante.js';
import { VistaLibro } from './ui/libro.js';
import { VistaDiario } from './ui/diario.js';
import { VistaRanking } from './ui/ranking.js';
import { CajaDialogo, DialogoCerrado } from './ui/dialogo.js';
import { CLAVE_DIALOGO, DIALOGOS, conversar } from './conversacion.js';
import { audio } from './audio.js';
import { tomarExamen } from './examen.js';
import { Duelos } from './duelos.js';
import { ajustes, aplicarTamanoTexto } from './ajustes.js';
import { crearBotonera } from './ui/paneles.js';
import { crearControlesTactiles } from './ui/tactil.js';
import { fijarZonaVisible } from './ui/globo.js';

const {
    jugador, cupo, salas: canales, urlRetratos, urlPosicion, urlChat, urlBiblioteca, urlLibros, urlExamen, urlSalir, urlDuelos, estantes, urlPosterTup,
} = window.SALA;

// Con mucha gente los nombres tapan todo: en modo "auto", arriba de este número solo se ven
// los cercanos (se puede cambiar en Ajustes).
const LIMITE_NOMBRES = 25;
const DISTANCIA_NOMBRES = 4;

const recursos = {
    retratos: {}, // nombre → HTMLImageElement
    posterTup: null,
    mapas: {}, // sala → canvas offscreen con la habitación ya dibujada
};

// La sala donde estás ahora (la que tenías guardada al entrar).
let salaActual = SALAS[jugador.sala] ?? SALAS.biblioteca;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const siguienteFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function cargarFuentes() {
    const fuentes = Promise.all([
        document.fonts.load('16px "Press Start 2P"'),
        document.fonts.load('16px "Poppins"'),
    ]);
    // Si una fuente tarda demasiado seguimos igual: el juego funciona con la de respaldo.
    await Promise.race([fuentes, esperar(3000)]);
}

function cargarImagen(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // una imagen faltante no frena el juego
        img.src = url;
    });
}

async function cargarImagenes(alAvanzar) {
    const tareas = RETRATOS.map((nombre) => async () => {
        recursos.retratos[nombre] = await cargarImagen(`${urlRetratos}/${nombre}.png`);
    });
    if (urlPosterTup) tareas.push(async () => { recursos.posterTup = await cargarImagen(urlPosterTup); });

    let listas = 0;
    await Promise.all(tareas.map(async (tarea) => {
        await tarea();
        alAvanzar(++listas / tareas.length);
    }));
}

const red = new Red();

async function conectar(carga) {
    carga.ocultarError();
    carga.retroceder(55);

    try {
        await red.conectar({ timeoutMs: TIMEOUT_REVERB_MS });
        red.escucharPrivado(jugador.id); // invitaciones a duelo, estés en la sala que estés
        carga.progreso(80);
        const jugadores = await red.unirse(canales[salaActual.slug], { timeoutMs: TIMEOUT_REVERB_MS });

        // here() incluye a uno mismo: si además de vos ya hay `cupo` personas, está llena.
        if (jugadores.length > cupo) {
            red.desconectar();
            carga.mostrarError(`Sala llena (${cupo}/${cupo}). Probá de nuevo en un rato.`, () => conectar(carga));
            return;
        }

        carga.progreso(100);
        await carga.terminar();
        iniciarJuego(jugadores);
    } catch (error) {
        carga.mostrarError(error.message, () => conectar(carga));
    }
}

// ───────────── El juego ─────────────

// Todas las salas miden 30×20 celdas (lo controla MapaTest): el canvas no cambia de tamaño.
const ANCHO = SALAS.biblioteca.ancho * TILE; // 960
const ALTO = SALAS.biblioteca.alto * TILE; // 640

/**
 * Dos modos de pantalla:
 *  - "completo": el mapa entero, escalado al máximo entero que entre (×1, ×2, ×3…).
 *  - "camara": si el mapa no entra ni a ×1 (celulares), mostramos solo una parte a ×1
 *    (el pixel art a 2 px por píxel, que se lee bien) y la cámara sigue al jugador.
 * Devuelve el modo, el tamaño de la vista (en px del mundo) y el espacio libre a los costados.
 */
function ajustarPantalla(canvas, ctx) {
    const s = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
    let vista;
    if (s >= 1) {
        const escala = Math.floor(s);
        vista = { modo: 'completo', w: ANCHO, h: ALTO, escala };
    } else {
        // En el eje que sí entra (ej. el alto en un celular vertical) se ve el mapa completo.
        vista = { modo: 'camara', w: Math.min(ANCHO, window.innerWidth), h: Math.min(ALTO, window.innerHeight), escala: 1 };
    }
    if (canvas.width !== vista.w || canvas.height !== vista.h) {
        canvas.width = vista.w;
        canvas.height = vista.h;
        ctx.imageSmoothingEnabled = false; // cambiar el tamaño del canvas resetea el contexto
    }
    canvas.style.width = `${vista.w * vista.escala}px`;
    canvas.style.height = `${vista.h * vista.escala}px`;
    vista.margen = Math.floor((window.innerWidth - vista.w * vista.escala) / 2);
    return vista;
}

/**
 * Posición de la cámara: centrada en el jugador, sin mostrar nada fuera del mapa.
 * En táctil apunta un poco más abajo del personaje, así él queda más arriba en la
 * pantalla y no debajo del d-pad y los botones.
 */
function posicionCamara(vista, yo) {
    const limitar = (valor, maximo) => Math.round(Math.min(Math.max(valor, 0), maximo));
    const compensarControles = document.body.classList.contains('es-tactil') ? Math.round(vista.h * 0.15) : 0;
    return {
        x: limitar(yo.px * TILE + TILE / 2 - vista.w / 2, ANCHO - vista.w),
        y: limitar(yo.py * TILE + TILE / 2 - vista.h / 2 + compensarControles, ALTO - vista.h),
    };
}

function iniciarJuego(jugadoresIniciales) {
    const sala = document.getElementById('sala');
    const canvas = document.getElementById('pantalla');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    sala.hidden = false;

    const entrada = new Entrada();
    const yo = new Personaje(jugador);
    // NPCs de cada sala (en la arena no hay).
    const npcsDe = Object.fromEntries(Object.values(SALAS).map((m) => [m.slug, crearNpcs(m)]));

    const hud = new Hud(document.getElementById('hud'));
    hud.mostrar();
    red.on('estado', (estado) => hud.wifi(estado));

    const multi = new Multijugador({ red, yo, hud, cupo, mapa: salaActual });
    multi.sincronizar(jugadoresIniciales, true);
    const guardado = crearGuardado(() => ({ sala: salaActual.slug, x: yo.x, y: yo.y, dir: yo.dir }), urlPosicion);

    const chat = new Chat({
        raiz: document.getElementById('chat'),
        entrada,
        hud,
        red,
        url: urlChat,
        alMensaje: (m) => {
            const quien = m.user_id === yo.id ? yo : multi.remotos.get(m.user_id);
            quien?.decir(m.texto);
            if (m.user_id !== yo.id) audio.efecto('mensaje');
        },
    });
    chat.cargarHistorial();

    // Si sobra lugar al costado del mapa, el chat va ahí; si no, va encima (plegado).
    let vista;
    const acomodar = () => {
        vista = ajustarPantalla(canvas, ctx);
        document.body.classList.toggle('modo-camara', vista.modo === 'camara');
        hud.acomodar(vista.margen);
        chat.acomodar(hud.lateral);
    };
    acomodar();
    window.addEventListener('resize', acomodar);

    // ─── Interacción: E o Espacio mirando hacia algo que está al lado ───
    // (Modales se crea ANTES del listener de interacción: si no, la misma E que abre
    // el menú le llegaría al menú recién abierto y elegiría un libro sola.)
    const modales = new Modales(entrada, document.getElementById('modales'));
    const biblioteca = new Biblioteca({ urlBiblioteca, urlLibros });
    // ─── Duelos (parte c): qué les pasa a los personajes cuando el servidor avisa algo ───
    const personajeDe = (id) => (id === yo.id ? yo : multi.remotos.get(id));
    const ganchosDuelo = {
        alIniciar(d) {
            if (d.tarde) return; // llegamos con el duelo empezado: ya están en el ring
            for (const p of [d.retador, d.retado]) personajeDe(p.id)?.teletransportar(p.x, p.y, p.dir);
            if (duelos.participa(yo.id)) {
                multi.avisarDondeEstoy();
                hud.toast('¡A tu lugar! Atacá con E (o A) cuando tengas al rival enfrente.');
            } else if (duelos.enRing(yo.x, yo.y)) {
                // Un espectador que había quedado dentro del ring: lo sacamos al borde.
                const r = d.ring;
                const salida = [[yo.x, r.y1 + 1], [yo.x, r.y0 - 1], [r.x0 - 1, yo.y], [r.x1 + 1, yo.y]]
                    .find(([x, y]) => salaActual.esCaminable(x, y));
                if (salida) {
                    yo.teletransportar(salida[0], salida[1], yo.dir);
                    multi.avisarDondeEstoy();
                }
            }
        },
        alGolpe(d) {
            personajeDe(d.golpeado_id)?.parpadear();
            if (d.golpeado_id !== yo.id) return;
            // El golpe te empuja una casilla para atrás (si hay lugar dentro del ring).
            const [dx, dy] = delta(d.dir);
            const [nx, ny] = [yo.x + dx, yo.y + dy];
            const rival = personajeDe(d.atacante_id);
            const ocupada = rival && rival.x === nx && rival.y === ny;
            if (!yo.moviendo && duelos.enRing(nx, ny) && salaActual.esCaminable(nx, ny) && !ocupada) {
                yo.pasoA(nx, ny, yo.dir);
                multi.avisarMovimiento();
            }
        },
        /** Final (parte d): el perdedor se rinde, el ganador festeja y los dos salen del ring. */
        alTerminar(d) {
            const ganador = personajeDe(d.ganador_id);
            const perdedor = personajeDe(d.perdedor_id);
            if (d.empate) {
                for (const id of d.ids) personajeDe(id)?.decir('¡Empate!');
            } else {
                perdedor?.decir(d.motivo === 'tiempo' ? 'Uf… ¡me rindo!' : '¡Me rindo!');
                ganador?.festejar();
                ganador?.decir(d.motivo === 'abandono' ? '¿Se fue? ¡Gané!' : '¡Gané!');
            }
            if (d.motivo === 'abandono') hud.toast(`${d.nombres[d.perdedor_id]} se desconectó: gana ${d.nombres[d.ganador_id]}`);
            // Después del festejo, cada uno sale del ring por su lado (el retador por la izquierda).
            setTimeout(() => {
                const y = Math.floor((d.ring.y0 + d.ring.y1) / 2);
                const salidas = { [d.ids[0]]: [d.ring.x0 - 1, y, 'izquierda'], [d.ids[1]]: [d.ring.x1 + 1, y, 'derecha'] };
                for (const id of d.ids) {
                    const p = personajeDe(id);
                    if (!p || !salidas[id]) continue;
                    p.teletransportar(...salidas[id]);
                    if (p === yo) multi.avisarDondeEstoy();
                }
            }, 2600);
        },
    };
    const duelos = new Duelos({ red, hud, modales, url: urlDuelos, yoId: yo.id, ganchos: ganchosDuelo });
    // Si se desconecta mi rival en pleno duelo, puede que gane yo (lo confirma el servidor).
    red.on('sale', (j) => duelos.alguienSalio(j));
    // Whisper "espada": solo la animación del espadazo de otro (el daño lo decide el servidor).
    red.on('espada', (d, id) => {
        const r = multi.remotos.get(id);
        if (r && ['arriba', 'abajo', 'izquierda', 'derecha'].includes(d?.dir)) {
            r.dir = d.dir;
            r.espadazo();
            audio.espadazo();
        }
    });
    if (salaActual.slug === 'arena') duelos.consultarEnCurso();
    biblioteca.estantes().catch(() => {}); // precarga: el primer menú abre sin demora

    function abrirLibro(menu, libro, estante) {
        const vista = new VistaLibro(libro, estante, biblioteca.libro(libro.slug), {
            alCerrar: () => {
                vista.destruir();
                modales.reemplazar(vista, menu); // Esc en el libro vuelve al estante
            },
        });
        modales.reemplazar(menu, vista);
    }

    async function abrirEstante(slug) {
        let estante;
        try {
            estante = await biblioteca.estante(slug);
        } catch {
            hud.toast('No se pudo cargar la biblioteca.', 'error');
            return;
        }
        if (!estante || modales.abierto) return;
        const menu = new MenuEstante(estante, {
            alElegir: (libro) => abrirLibro(menu, libro, estante),
            alCerrar: () => modales.cerrar(menu),
        });
        modales.abrir(menu);
    }

    // ─── NPCs ───
    const VOCES = { claude: 660, claude_code: 330 }; // frecuencia del blip de cada uno
    const yaHablaron = new Set(); // para el saludo "repetido" (en esta sesión)
    let resaltado = null; // { slug, hasta } estante recomendado que brilla

    const acciones = {
        // "Tomame examen": 5 preguntas en la misma caja, con el retrato de Claude.
        iniciar_examen: (caja) => tomarExamen({ caja, def: DIALOGOS.npcs.claude, url: urlExamen }),

        // Claude elige un libro al azar y hace brillar su estante (6 s después de cerrar la charla).
        async recomendar_libro() {
            try {
                const libro = await biblioteca.libroAlAzar();
                const estante = await biblioteca.estante(libro.estante);
                resaltado = { slug: libro.estante, hasta: Infinity };
                return { expresion: 'normal', texto: `Buscá «${libro.titulo}» (${libro.clase}) en el estante de ${estante.nombre}. ¡Te lo marqué!` };
            } catch {
                return { expresion: 'pensativa', texto: 'Uy, no pude abrir el catálogo. Probá de nuevo en un ratito.' };
            }
        },
    };

    async function hablarCon(tipoNpc) {
        const clave = CLAVE_DIALOGO[tipoNpc];
        const def = DIALOGOS.npcs[clave];
        const caja = new CajaDialogo({ def, urlRetratos, reemplazos: { nombre: yo.nombre }, voz: VOCES[clave] });
        const yaHablo = yaHablaron.has(clave);
        yaHablaron.add(clave);
        modales.abrir(caja);
        try {
            await conversar({ caja, def, yaHablo, acciones });
        } catch (error) {
            if (!(error instanceof DialogoCerrado)) throw error;
        } finally {
            caja.cerrar();
            modales.cerrar(caja);
            if (resaltado?.hasta === Infinity) resaltado.hasta = performance.now() + 6000;
        }
    }

    function dibujarResaltado(t) {
        if (!resaltado || t > resaltado.hasta) {
            resaltado = null;
            return;
        }
        if (salaActual.slug !== 'biblioteca') return; // los estantes están en la biblioteca
        const caracter = salaActual.caracteresDe((info) => info.estante === resaltado.slug)[0];
        const pulso = 0.75 + 0.25 * Math.sin(t / 160); // late entre 0.5 y 1: siempre se nota
        for (const b of salaActual.bloques(caracter)) {
            // El estante se dibuja 20 px más alto que su celda (tapa el zócalo).
            const x = b.x * TILE, y = b.y * TILE - 20, w = b.w * TILE, h = b.h * TILE + 20;
            ctx.fillStyle = `rgba(255, 230, 140, ${pulso * 0.35})`;
            ctx.fillRect(x, y, w, h);
            // Dos marcos pixelados que laten: uno pegado al mueble y otro más afuera.
            for (const [g, grosor, alfa] of [[2, 4, pulso], [10, 2, pulso * 0.6]]) {
                ctx.fillStyle = `rgba(255, 214, 90, ${alfa})`;
                ctx.fillRect(x - g, y - g, w + 2 * g, grosor);
                ctx.fillRect(x - g, y + h + g - grosor, w + 2 * g, grosor);
                ctx.fillRect(x - g, y - g, grosor, h + 2 * g);
                ctx.fillRect(x + w + g - grosor, y - g, grosor, h + 2 * g);
            }
        }
    }

    // Cartel de la arena: top 10 de victorias.
    function abrirRanking() {
        if (modales.abierto) return;
        const vista = new VistaRanking(duelos.pedir('/ranking', null, 'GET'), { alCerrar: () => modales.cerrar(vista) });
        modales.abrir(vista);
    }

    // Easter egg: el diario arrugado del piso.
    function abrirDiario() {
        if (modales.abierto) return;
        const vista = new VistaDiario({ alCerrar: () => modales.cerrar(vista) });
        modales.abrir(vista, { sonido: false });
        audio.papel();
    }

    function interactuar() {
        // El diario es una celda caminable: vale tanto pararse encima como mirarlo de al lado.
        if (salaActual.infoCelda(yo.x, yo.y).tipo === 'diario') {
            abrirDiario();
            return;
        }
        const [dx, dy] = delta(yo.dir);
        // Peleando un duelo: A es un espadazo (el POST solo si el rival está enfrente).
        if (duelos.participa(yo.id)) {
            const rivalId = duelos.combate.ids.find((id) => id !== yo.id);
            const rival = multi.remotos.get(rivalId);
            duelos.atacar(yo, rival, !!rival && rival.x === yo.x + dx && rival.y === yo.y + dy);
            return;
        }
        // En la arena, si tenés a otro jugador enfrente: menú para retarlo a duelo.
        if (salaActual.slug === 'arena') {
            const rival = multi.personajes().find((r) => !r.saliendo && r.x === yo.x + dx && r.y === yo.y + dy);
            if (rival) {
                duelos.abrirMenu(rival);
                return;
            }
        }
        const info = salaActual.infoCelda(yo.x + dx, yo.y + dy);
        if (info.tipo === 'diario') abrirDiario();
        else if (info.tipo === 'estante') abrirEstante(info.estante);
        else if (info.tipo === 'npc') hablarCon(info.npc);
        else if (info.tipo === 'escritorio') hud.toast('La terminal de Claude Code. Mejor hablá con él.');
        else if (info.tipo === 'ranking') abrirRanking();
    }

    // ─── Cambiar de sala (al cruzar una puerta) ───
    const pantallaSala = document.getElementById('sala');
    let cambiando = false;

    /** Fundido a negro (true) o de vuelta (false); espera a que termine. */
    function fundido(aNegro) {
        pantallaSala.classList.toggle('sala--fundido', aNegro);
        return esperar(180);
    }

    /**
     * 1) guardamos la sala nueva en la BD (el canal solo te deja entrar a la sala guardada),
     * 2) dejamos el canal viejo y nos unimos al nuevo, 3) aparecen los que ya estaban ahí.
     * Si algo falla, volvemos a la sala de antes.
     */
    async function cambiarSala(destino, x) {
        if (cambiando) return;
        cambiando = true;
        entrada.bloqueada = true;
        const anterior = { sala: salaActual.slug, x: yo.x, y: yo.y, dir: yo.dir };
        const nueva = SALAS[destino.sala];
        await fundido(true);

        try {
            await guardado.guardarAhora({ sala: nueva.slug, x, y: destino.y, dir: destino.dir });
            const jugadores = await red.unirse(canales[nueva.slug], { timeoutMs: TIMEOUT_REVERB_MS });
            if (jugadores.length > cupo) throw new Error(`${nueva.nombre} está llena (${cupo}/${cupo}).`);
            salaActual = nueva;
            yo.teletransportar(x, destino.y, destino.dir);
            multi.cambiarSala(nueva, jugadores);
            hud.toast(`Entraste a ${nueva.nombre}`);
            if (nueva.slug === 'arena') duelos.consultarEnCurso();
            else duelos.olvidar();
        } catch (error) {
            hud.toast(error.message || 'No se pudo cambiar de sala.', 'error');
            try {
                // De vuelta a donde estabas.
                await guardado.guardarAhora(anterior);
                const jugadores = await red.unirse(canales[anterior.sala], { timeoutMs: TIMEOUT_REVERB_MS });
                multi.cambiarSala(SALAS[anterior.sala], jugadores);
            } catch {
                hud.toast('Se perdió la conexión con la sala. Recargá la página.', 'error');
            }
        } finally {
            await fundido(false);
            entrada.bloqueada = false;
            cambiando = false;
        }
    }

    // M: sonido sí / no (funciona también con un diálogo abierto).
    window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyM' || e.repeat || e.target instanceof HTMLInputElement) return;
        hud.toast(audio.alternarSilencio() ? 'Sonido desactivado' : 'Sonido activado');
    });

    window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyE' && e.code !== 'Space') return;
        if (entrada.bloqueada || e.repeat || e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        interactuar();
    });

    // ─── HUD: botones de Ajustes / Info / Jugadores y controles táctiles ───
    crearBotonera({
        raiz: document.querySelector('[data-botones]'),
        modales,
        red,
        urlSalir,
        obtenerJugadores: () => [
            { nombre: yo.nombre, color: yo.color, esPropio: true },
            ...multi.personajes().filter((r) => !r.saliendo).map((r) => ({ nombre: r.nombre, color: r.color })),
        ],
    });
    chat.alCambiarNoLeidos = crearControlesTactiles({
        raiz: document.getElementById('tactil'),
        alChat: () => { if (!entrada.bloqueada) chat.abrir(); },
    });

    const veNombre = (r, cantidad) => {
        const cerca = Math.max(Math.abs(r.x - yo.x), Math.abs(r.y - yo.y)) <= DISTANCIA_NOMBRES;
        const modo = ajustes.get('nombres');
        if (modo === 'todos') return true;
        if (modo === 'cercanos') return cerca;
        return cantidad <= LIMITE_NOMBRES || cerca;
    };

    function moverJugador(dt) {
        const sobra = yo.actualizar(dt);
        if (yo.moviendo) return;

        const dir = entrada.direccion();
        if (!dir) return;
        if (duelos.congelado(yo.id)) return; // 3-2-1: todavía no
        const [dx, dy] = delta(dir);
        const destino = salaActual.infoCelda(yo.x + dx, yo.y + dy).destino;
        if (destino) {
            cambiarSala(destino, yo.x + dx); // una puerta: se conserva la columna
            return;
        }
        if (salaActual.esCaminable(yo.x + dx, yo.y + dy) && duelos.puedePisar(yo.id, yo.x + dx, yo.y + dy)) {
            yo.pasoA(yo.x + dx, yo.y + dy, dir);
            if (sobra > 0) yo.actualizar(sobra);
            multi.avisarMovimiento();
        } else if (yo.dir !== dir) {
            yo.dir = dir; // bloqueado: solo gira (y avisamos, así los demás te ven mirando para ahí)
            multi.avisarMovimiento();
        }
    }

    const cartelCuenta = document.getElementById('duelo-cuenta');
    const cartelReloj = document.getElementById('duelo-reloj');
    /** Solo toca el DOM si cambió el texto (esto corre 60 veces por segundo). */
    function mostrarDuelo() {
        const cuenta = duelos.cuenta();
        const reloj = duelos.reloj();
        if (cartelCuenta.textContent !== (cuenta ?? '')) {
            cartelCuenta.textContent = cuenta ?? '';
            cartelCuenta.hidden = !cuenta;
            cartelCuenta.classList.toggle('duelo-cuenta--ya', cuenta === '¡YA!');
            // El anuncio del final es una frase: va más chico y sin latir, para no tapar la sala.
            cartelCuenta.classList.toggle('duelo-cuenta--final', !!cuenta && cuenta.length > 4);
        }
        if (cartelReloj.textContent !== (reloj ?? '')) {
            cartelReloj.textContent = reloj ?? '';
            cartelReloj.hidden = !reloj;
        }
    }

    let anterior = performance.now();
    function bucle(t) {
        const dt = Math.min(100, t - anterior); // si la pestaña estuvo oculta, no "saltar"
        anterior = t;

        moverJugador(dt);
        multi.actualizar(dt);

        // Cámara: corremos todo el dibujo para que el jugador quede en el centro.
        const camara = vista.modo === 'camara' ? posicionCamara(vista, yo) : { x: 0, y: 0 };
        ctx.setTransform(1, 0, 0, 1, -camara.x, -camara.y);
        fijarZonaVisible(camara.x, camara.x + vista.w);

        ctx.drawImage(recursos.mapas[salaActual.slug], 0, 0);
        if (salaActual.slug === 'arena') dibujarLuces(ctx, salaActual, t);
        dibujarResaltado(t);
        // Orden por profundidad: los que están más abajo tapan a los de arriba.
        const npcs = npcsDe[salaActual.slug];
        const remotos = multi.personajes();
        const entidades = [...npcs, ...remotos, yo].sort((a, b) => a.py - b.py);
        entidades.forEach((e) => e.dibujar(ctx, t));
        // Los nombres van al final para que ningún sprite los tape.
        // Nombres y globos comparten la lista de lugares ocupados: si dos jugadores están
        // pegados, sus nombres se apilan en vez de pisarse. El tuyo primero: queda en su lugar.
        const ocupados = [];
        yo.dibujarNombre(ctx, t, true, ocupados, duelos.vidasDe(yo.id));
        npcs.forEach((n) => n.dibujarNombre(ctx, t, yo, ocupados));
        remotos.forEach((r) => {
            r.baseEtiqueta = null;
            const vidas = duelos.vidasDe(r.id);
            if (vidas !== null || veNombre(r, remotos.length + 1)) r.dibujarNombre(ctx, t, false, ocupados, vidas);
        });
        // Los globos, arriba de todo. El propio primero: queda pegado a tu cabeza y,
        // si otro choca con él, el otro es el que sube.
        yo.dibujarGlobo(ctx, true, ocupados);
        remotos.forEach((r) => r.dibujarGlobo(ctx, false, ocupados));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        mostrarDuelo();

        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
}

async function arrancar() {
    aplicarTamanoTexto();
    const carga = new PantallaCarga(document.getElementById('carga'));

    await cargarFuentes();
    carga.progreso(10);

    const hoja = obtenerSprites({ genero: jugador.genero, color: jugador.color, ...apariencia(jugador.id) });
    carga.ponerPersonaje(hoja);
    await siguienteFrame();
    carga.progreso(30);

    await cargarImagenes((fraccion) => carga.progreso(30 + 25 * fraccion));

    // Las salas se dibujan después de las fuentes (tienen texto) y de las imágenes (poster opcional).
    for (const mapa of Object.values(SALAS)) {
        recursos.mapas[mapa.slug] = dibujarSala(mapa, {
            estantes: Object.fromEntries(estantes.map((e) => [e.slug, e])),
            imagenTup: recursos.posterTup,
        });
    }
    await siguienteFrame();

    await conectar(carga);
}

arrancar();
