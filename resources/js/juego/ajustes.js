// Preferencias de cada jugador (volumen, nombres, tamaño de texto). Se guardan en
// localStorage: son de este navegador y no viajan al servidor. Si el almacenamiento
// no está disponible (modo privado estricto), funcionan igual mientras dure la pestaña.

const CLAVE = 'sala-rpg:ajustes';

const POR_DEFECTO = {
    volumen: 0.7, // 0 a 1
    silencio: false, // tecla M
    nombres: 'auto', // 'auto' (cercanos si hay más de 25) | 'todos' | 'cercanos'
    texto: 'normal', // 'normal' | 'grande' | 'muy-grande'
};

export const TAMANOS_TEXTO = { normal: '100%', grande: '115%', 'muy-grande': '130%' };

function leer() {
    try {
        return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
    } catch {
        return { ...POR_DEFECTO };
    }
}

const valores = leer();
const oyentes = new Set();

export const ajustes = {
    get(clave) {
        return valores[clave];
    },

    set(clave, valor) {
        valores[clave] = valor;
        try {
            localStorage.setItem(CLAVE, JSON.stringify(valores));
        } catch {
            // sin almacenamiento: vale solo para esta pestaña
        }
        oyentes.forEach((fn) => fn(clave, valor));
    },

    /** fn(clave, valor) se llama cada vez que cambia algo. */
    alCambiar(fn) {
        oyentes.add(fn);
    },
};

/** El tamaño de texto escala toda la UI HTML (está hecha en rem). */
export function aplicarTamanoTexto() {
    document.documentElement.style.fontSize = TAMANOS_TEXTO[ajustes.get('texto')] ?? '100%';
}
