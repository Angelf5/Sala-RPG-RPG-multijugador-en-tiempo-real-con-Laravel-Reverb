// Modo examen con Claude: 5 preguntas de GET /examen en la caja de diálogo.
// Correcta → expresión feliz + felicitación. Incorrecta → pensativa + explicación
// + "Repasá: «libro»". Al final, el puntaje con la frase de examen.final según el rango.

import { audio } from './audio.js';

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

function rangoDe(puntaje, total) {
    if (puntaje === total) return '5';
    if (puntaje >= 3) return '3-4';
    return '0-2';
}

async function pedirPreguntas(url) {
    const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    return (await respuesta.json()).data;
}

/** Toma el examen dentro de una caja de diálogo ya abierta. Esc lo corta (DialogoCerrado). */
export async function tomarExamen({ caja, def, url }) {
    let preguntas;
    try {
        preguntas = await pedirPreguntas(url);
    } catch {
        await caja.decir([{ expresion: 'pensativa', texto: 'Uy, no pude traer las preguntas. Probemos de nuevo en un ratito.' }]);
        return;
    }

    let puntaje = 0;
    for (const [n, p] of preguntas.entries()) {
        const elegida = await caja.elegir(p.opciones, {
            pregunta: { expresion: 'normal', texto: `Pregunta ${n + 1} de ${preguntas.length}: ${p.pregunta}` },
            unaColumna: true,
        });

        if (elegida === p.correcta) {
            puntaje++;
            audio.efecto('correcta');
            await caja.decir([alAzar(def.examen.correcta)]);
        } else {
            audio.efecto('incorrecta');
            await caja.decir([
                alAzar(def.examen.incorrecta),
                { expresion: 'pensativa', texto: `La correcta era «${p.opciones[p.correcta]}». ${p.explicacion}` },
                ...(p.libro ? [{ expresion: 'normal', texto: `Repasá: «${p.libro.titulo}».` }] : []),
            ]);
        }
    }

    caja.reemplazos.puntaje = puntaje;
    await caja.decir([def.examen.final[rangoDe(puntaje, preguntas.length)]]);
}
