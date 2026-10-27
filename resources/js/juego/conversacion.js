// Qué dice cada NPC (datos en data/dialogos.json) y cómo se encadena la charla:
// saludo según la hora → menú → líneas de la opción → vuelve al menú (o cierra).

import DIALOGOS from './data/dialogos.json';

export { DIALOGOS };

// En el mapa los NPCs se llaman 'claude' y 'code'; en dialogos.json, 'claude' y 'claude_code'.
export const CLAVE_DIALOGO = { claude: 'claude', code: 'claude_code' };

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

function franjaHoraria(fecha = new Date()) {
    const hora = fecha.getHours();
    if (hora < 12) return 'manana';
    if (hora < 20) return 'tarde';
    return 'noche';
}

// Última frase dicha de cada pool, para no repetirla dos veces seguidas.
const ultimaDelPool = new Map();

function fraseDelPool(def, nombrePool) {
    const pool = def.pools?.[nombrePool] ?? [];
    const ultima = ultimaDelPool.get(nombrePool);
    const candidatas = pool.length > 1 ? pool.filter((l) => l !== ultima) : pool;
    const elegida = alAzar(candidatas);
    ultimaDelPool.set(nombrePool, elegida);
    return elegida;
}

/**
 * Charla completa con un NPC. Termina cuando el jugador elige una opción que cierra.
 * Si cierra con Esc, la caja rechaza con DialogoCerrado (lo maneja quien llama).
 *
 * @param acciones  { recomendar_libro: async () => linea, iniciar_examen: async (caja) => void }
 *                  Las opciones cuya acción no está disponible no se muestran.
 */
export async function conversar({ caja, def, yaHablo, acciones = {} }) {
    const saludo = yaHablo ? alAzar(def.saludos.repetido) : alAzar(def.saludos[franjaHoraria()]);
    await caja.decir([saludo]);

    const disponible = (op) => !op.accion || op.accion === 'al_azar' || typeof acciones[op.accion] === 'function';
    const opciones = def.opciones.filter(disponible);

    for (;;) {
        const opcion = opciones[await caja.elegir(opciones.map((o) => o.etiqueta))];

        if (opcion.accion === 'al_azar') {
            await caja.decir([fraseDelPool(def, opcion.pool)]);
            continue;
        }

        if (opcion.accion === 'recomendar_libro') {
            const [primera, ...resto] = opcion.lineas;
            await caja.decir([primera]); // "Mmm… a ver, a ver…" mientras busca
            const recomendacion = await acciones.recomendar_libro();
            await caja.decir([...resto, recomendacion]);
            continue;
        }

        await caja.decir(opcion.lineas);

        if (opcion.accion === 'iniciar_examen') {
            await acciones.iniciar_examen(caja);
            continue;
        }

        if (opcion.cierra) return;
    }
}
