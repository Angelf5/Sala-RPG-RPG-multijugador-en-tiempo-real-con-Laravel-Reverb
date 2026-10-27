// Teclado. Guarda las direcciones apretadas en orden: manda la última que apretaste
// (si soltás esa, vuelve a la anterior que sigas apretando).

const DIRECCION_DE_TECLA = {
    ArrowUp: 'arriba', KeyW: 'arriba',
    ArrowDown: 'abajo', KeyS: 'abajo',
    ArrowLeft: 'izquierda', KeyA: 'izquierda',
    ArrowRight: 'derecha', KeyD: 'derecha',
};

const escribiendo = (e) => e.target instanceof HTMLElement
    && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));

export class Entrada {
    constructor() {
        this.apretadas = [];
        // Un toque corto mientras todavía estás terminando un paso se guarda para el paso
        // siguiente; si no, se perdería (la tecla ya se soltó cuando el paso termina).
        this.pendiente = null;
        this.bloqueada = false; // true mientras hay chat, diálogo, libro, etc.

        window.addEventListener('keydown', (e) => {
            if (escribiendo(e)) return;
            const dir = DIRECCION_DE_TECLA[e.code];
            if (!dir) return;
            e.preventDefault(); // que las flechas no scrolleen la página
            if (!this.apretadas.includes(e.code)) this.apretadas.push(e.code);
            // Solo el primer keydown (no la autorrepetición del teclado): si no, al soltar
            // una tecla mantenida quedaría un toque guardado y daría un paso de más.
            if (!this.bloqueada && !e.repeat) this.pendiente = dir;
        });
        window.addEventListener('keyup', (e) => {
            this.apretadas = this.apretadas.filter((c) => c !== e.code);
        });
        // Si la ventana pierde el foco con una tecla apretada, no queremos que siga caminando sola.
        window.addEventListener('blur', () => {
            this.apretadas = [];
            this.pendiente = null;
        });
    }

    /** Dirección que se quiere caminar ahora, o null. */
    direccion() {
        if (this.bloqueada) {
            this.pendiente = null;
            return null;
        }
        const pendiente = this.pendiente;
        this.pendiente = null;
        if (this.apretadas.length) return DIRECCION_DE_TECLA[this.apretadas[this.apretadas.length - 1]];
        return pendiente;
    }
}
