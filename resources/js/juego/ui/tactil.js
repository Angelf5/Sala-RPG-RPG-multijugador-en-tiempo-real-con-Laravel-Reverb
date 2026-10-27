// Controles en pantalla para celulares y tablets: d-pad + botones A (= tecla E: interactuar
// y confirmar) y 💬 (chat). Simulan las mismas teclas que el teclado, así caminar, los menús,
// los libros y el examen funcionan sin código especial para táctil. Para cerrar cualquier
// ventana está su ✕ (por eso no hace falta un botón "atrás").

import { el } from './modales.js';

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

function tecla(tipo, code) {
    const key = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', KeyE: 'e' }[code];
    window.dispatchEvent(new KeyboardEvent(tipo, { code, key, bubbles: true }));
}

/**
 * @param mantener  true (d-pad): la tecla queda apretada mientras el dedo está apoyado.
 *                  false (A): la tecla se "aprieta y suelta" en el click, que es el ÚLTIMO
 *                  evento del toque. Si se disparara al apoyar el dedo, la ventana que abre
 *                  esconde el botón y el click de levantar el dedo caería sobre esa ventana
 *                  (y la cerraría al toque).
 */
function boton(clase, texto, etiqueta, code, mantener = true) {
    const b = el('button', `tactil-boton ${clase}`, texto);
    b.type = 'button';
    b.setAttribute('aria-label', etiqueta);
    if (code && !mantener) {
        b.addEventListener('click', () => {
            tecla('keydown', code);
            tecla('keyup', code);
        });
    } else if (code) {
        // pointerdown/up y no click: mantener apretada una flecha tiene que seguir caminando.
        b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            b.setPointerCapture(e.pointerId);
            tecla('keydown', code);
        });
        const soltar = () => tecla('keyup', code);
        b.addEventListener('pointerup', soltar);
        b.addEventListener('pointercancel', soltar);
    }
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú al mantener apretado
    return b;
}

/** Devuelve una función para mostrar en el 💬 cuántos mensajes llegaron sin leer (o nada). */
export function crearControlesTactiles({ raiz, alChat }) {
    if (!esTactil()) return () => {};

    const pad = el('div', 'tactil-pad');
    pad.append(
        boton('tactil-arriba', '▲', 'Arriba', 'ArrowUp'),
        boton('tactil-izquierda', '◀', 'Izquierda', 'ArrowLeft'),
        boton('tactil-derecha', '▶', 'Derecha', 'ArrowRight'),
        boton('tactil-abajo', '▼', 'Abajo', 'ArrowDown'),
    );

    const acciones = el('div', 'tactil-acciones');
    const chat = boton('tactil-chat', '💬', 'Chat');
    // El teclado del celular solo se abre si el foco va al input dentro del toque.
    chat.addEventListener('click', alChat);
    acciones.append(chat, boton('tactil-a', 'A', 'Interactuar', 'KeyE', false));

    raiz.append(pad, acciones);
    raiz.hidden = false;
    document.body.classList.add('es-tactil');
    // En el celular no hay Enter ni Esc a la vista: el texto de ayuda habla de los botones.
    const input = document.querySelector('[data-input]');
    if (input) input.placeholder = 'Escribí un mensaje…';

    const globito = el('span', 'tactil-globito');
    globito.hidden = true;
    chat.append(globito);
    return (cantidad) => {
        globito.hidden = cantidad === 0;
        globito.textContent = cantidad > 9 ? '9+' : String(cantidad);
        chat.setAttribute('aria-label', cantidad ? `Chat (${cantidad} sin leer)` : 'Chat');
    };
}
