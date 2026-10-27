// Chat: Enter abre el input, Enter envía, Esc cancela. Mientras escribís no te movés.
// El mensaje va por HTTP a Laravel (POST /chat: validación + rate limit + se guarda) y
// Laravel lo emite por Reverb a los demás (evento MensajeEnviado).
// SIEMPRE textContent para el texto de los usuarios: nunca innerHTML (anti-XSS).

const MAX = 80;
const HISTORIAL_MAX = 30;

const largo = (texto) => [...texto].length; // cuenta emojis como 1, igual que PHP (mb_strlen)

function horaLocal(iso) {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export class Chat {
    /**
     * @param alMensaje  (mensaje) => void   se llama con cada mensaje nuevo (propio o ajeno)
     */
    constructor({ raiz, entrada, hud, red, url, alMensaje }) {
        this.entrada = entrada;
        this.hud = hud;
        this.red = red;
        this.url = url;
        this.alMensaje = alMensaje;
        this.token = document.querySelector('meta[name="csrf-token"]').content;
        this.abierto = false;
        this.enviando = false;
        this.noLeidos = 0;
        this.alCambiarNoLeidos = () => {}; // en táctil, el botón 💬 muestra cuántos llegaron
        this.raiz = raiz;
        this.lateral = null;

        this.form = raiz.querySelector('[data-form]');
        this.input = raiz.querySelector('[data-input]');
        this.contador = raiz.querySelector('[data-contador-chat]');
        this.lista = raiz.querySelector('[data-lista]');
        this.historial = raiz.querySelector('[data-historial]');
        this.botonPlegar = raiz.querySelector('[data-plegar]');
        this.pista = raiz.querySelector('[data-pista]');

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.isComposing || e.repeat) return;
            if (this.abierto) {
                this.input.focus();
                return;
            }
            // Si otra ventana (diálogo, libro) tiene el control, Enter es de ella.
            if (this.entrada.bloqueada || e.target instanceof HTMLInputElement) return;
            e.preventDefault();
            this.abrir();
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.isComposing) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.enviar();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cerrar();
            }
        });
        this.input.addEventListener('input', () => this.actualizarContador());
        this.form.addEventListener('submit', (e) => { e.preventDefault(); this.enviar(); });
        raiz.querySelector('[data-cancelar]').addEventListener('click', () => this.cerrar());

        // Celular: el teclado virtual achica la "visual viewport" pero no la ventana. Calculamos
        // cuánto tapa y subimos el input esa distancia, así nunca queda debajo del teclado.
        const vv = window.visualViewport;
        if (vv) {
            const ajustarTeclado = () => {
                const tapado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                document.documentElement.style.setProperty('--teclado', `${Math.round(tapado)}px`);
            };
            vv.addEventListener('resize', ajustarTeclado);
            vv.addEventListener('scroll', ajustarTeclado);
        }

        this.botonPlegar.addEventListener('click', () => this.plegar(!this.historial.classList.contains('chat-historial--plegado')));

        // Si nos reconectamos pudimos perder mensajes: recargamos el historial.
        red.on('here', () => this.cargarHistorial());
        red.on('mensaje', (m) => this.recibir(m));
    }

    /**
     * Al costado del mapa (hay lugar): desplegado. Encima del mapa (ventana angosta):
     * arranca plegado y semitransparente para no tapar el juego. Solo se re-pliega al cambiar de modo.
     */
    acomodar(lateral) {
        if (lateral === this.lateral) return;
        this.lateral = lateral;
        this.raiz.classList.toggle('chat--superpuesto', !lateral);
        this.plegar(!lateral);
    }

    abrir() {
        this.abierto = true;
        this.entrada.bloqueada = true;
        this.form.hidden = false;
        document.body.classList.add('chat-abierto');
        this.pista.hidden = true;
        this.noLeidos = 0;
        this.alCambiarNoLeidos(0);
        // En táctil el historial vive "dentro" del 💬: se muestra entero mientras escribís.
        if (document.body.classList.contains('es-tactil')) this.plegar(false);
        this.actualizarContador();
        this.input.focus();
    }

    cerrar() {
        this.abierto = false;
        this.entrada.bloqueada = false;
        this.input.value = '';
        this.input.blur();
        this.form.hidden = true;
        document.body.classList.remove('chat-abierto');
        this.pista.hidden = false;
    }

    plegar(plegado) {
        this.historial.classList.toggle('chat-historial--plegado', plegado);
        this.botonPlegar.setAttribute('aria-expanded', String(!plegado));
        if (!plegado) this.lista.scrollTop = this.lista.scrollHeight;
    }

    actualizarContador() {
        const n = largo(this.input.value);
        this.contador.textContent = `${n}/${MAX}`;
        this.contador.classList.toggle('chat-contador--lleno', n >= MAX);
    }

    async cargarHistorial() {
        try {
            const respuesta = await fetch(this.url, { headers: { Accept: 'application/json' } });
            if (!respuesta.ok) return;
            const { data } = await respuesta.json();
            this.lista.replaceChildren();
            data.forEach((m) => this.agregarAlHistorial(m));
        } catch {
            // Sin historial no pasa nada: los mensajes nuevos igual llegan.
        }
    }

    agregarAlHistorial(m) {
        const li = document.createElement('li');
        const hora = document.createElement('span');
        hora.className = 'chat-hora';
        hora.textContent = horaLocal(m.hora);
        const nombre = document.createElement('span');
        nombre.className = 'chat-nombre';
        nombre.style.color = m.color;
        nombre.textContent = `${m.nombre}:`;
        const texto = document.createElement('span');
        texto.textContent = m.texto; // textContent: un <script> se ve como texto y no se ejecuta
        li.append(hora, nombre, ' ', texto);

        const alFondo = this.lista.scrollHeight - this.lista.scrollTop - this.lista.clientHeight < 20;
        this.lista.append(li);
        while (this.lista.children.length > HISTORIAL_MAX) this.lista.firstElementChild.remove();
        if (alFondo) this.lista.scrollTop = this.lista.scrollHeight;
    }

    recibir(m) {
        this.agregarAlHistorial(m);
        this.alMensaje(m);
        if (!this.abierto) this.alCambiarNoLeidos(++this.noLeidos);
    }

    async enviar() {
        const texto = this.input.value.trim().replace(/\s+/g, ' ');
        if (!texto) {
            this.cerrar();
            return;
        }
        if (this.enviando) return;
        this.enviando = true;

        try {
            const respuesta = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': this.token,
                    'X-Socket-ID': this.red.socketId() ?? '',
                },
                body: JSON.stringify({ texto }),
            });

            if (respuesta.status === 201) {
                const { data } = await respuesta.json();
                this.cerrar();
                this.recibir(data); // a nosotros no nos llega por Reverb (toOthers)
            } else if (respuesta.status === 429) {
                this.hud.toast('¡Más despacio!', 'error'); // el texto queda para reintentar
            } else if (respuesta.status === 422) {
                const cuerpo = await respuesta.json();
                this.hud.toast(cuerpo.errors?.texto?.[0] ?? cuerpo.message, 'error');
            } else {
                this.hud.toast('No se pudo enviar el mensaje.', 'error');
            }
        } catch {
            this.hud.toast('Sin conexión: no se pudo enviar el mensaje.', 'error');
        } finally {
            this.enviando = false;
        }
    }
}
