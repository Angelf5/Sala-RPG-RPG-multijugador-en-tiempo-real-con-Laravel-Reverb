// Guarda la sala y la posición propia en la BD para que al recargar aparezcas donde estabas:
// al cruzar una puerta (enseguida), cada 5 s (solo si cambió) y al cerrar o salir de la
// pestaña con navigator.sendBeacon.

const CADA_MS = 5000;

const clave = ({ sala, x, y, dir }) => `${sala},${x},${y},${dir}`;

/**
 * @param obtener () => { sala, x, y, dir }   la posición actual
 * @returns { guardarAhora(posicion) }        para guardar YA (al cambiar de sala)
 */
export function crearGuardado(obtener, url) {
    const token = document.querySelector('meta[name="csrf-token"]').content;
    let ultima = clave(obtener()); // la que ya está en la BD

    const enviar = (pos) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify(pos),
    });

    setInterval(() => {
        const pos = obtener();
        if (clave(pos) === ultima) return;
        ultima = clave(pos);
        enviar(pos).catch(() => { /* sin red: se reintenta en 5 s si te seguís moviendo */ });
    }, CADA_MS);

    // pagehide se dispara al cerrar, recargar o navegar a otra página. Un fetch normal se
    // cancelaría; sendBeacon garantiza que el navegador lo mande igual. No admite headers,
    // por eso el token CSRF va como campo _token dentro del FormData.
    window.addEventListener('pagehide', () => {
        const pos = obtener();
        if (clave(pos) === ultima) return;
        const datos = new FormData();
        datos.append('_token', token);
        for (const [k, v] of Object.entries(pos)) datos.append(k, v);
        navigator.sendBeacon(url, datos);
    });

    return {
        /** Guarda ya mismo y espera la respuesta (el canal de la sala nueva lo necesita). */
        async guardarAhora(pos) {
            const respuesta = await enviar(pos);
            if (!respuesta.ok) throw new Error(`No se pudo guardar la posición (${respuesta.status}).`);
            ultima = clave(pos);
        },
    };
}
