// Datos de la biblioteca desde Laravel. Se piden recién cuando hacen falta y se guardan
// en memoria: la segunda vez que abrís el mismo libro no hay request.
//   GET /biblioteca      → estantes con títulos (sin páginas)
//   GET /libros/{slug}   → un libro completo

const cache = new Map();

async function pedir(url) {
    if (!cache.has(url)) {
        const promesa = fetch(url, { headers: { Accept: 'application/json' } }).then(async (r) => {
            if (!r.ok) throw new Error(r.status === 404 ? 'Ese libro no existe.' : `Error ${r.status} al cargar.`);
            return (await r.json()).data;
        });
        cache.set(url, promesa);
        promesa.catch(() => cache.delete(url)); // si falló, que el próximo intento vuelva a pedir
    }
    return cache.get(url);
}

export class Biblioteca {
    constructor({ urlBiblioteca, urlLibros }) {
        this.urlBiblioteca = urlBiblioteca;
        this.urlLibros = urlLibros;
    }

    async estantes() {
        return pedir(this.urlBiblioteca);
    }

    async estante(slug) {
        return (await this.estantes()).find((e) => e.slug === slug) ?? null;
    }

    async libro(slug) {
        return pedir(`${this.urlLibros}/${encodeURIComponent(slug)}`);
    }

    /** Un libro al azar de toda la biblioteca (para la recomendación de Claude, etapa 6). */
    async libroAlAzar() {
        const todos = (await this.estantes()).flatMap((e) => e.libros.map((l) => ({ ...l, estante: e.slug })));
        return todos[Math.floor(Math.random() * todos.length)];
    }
}
