<?php

namespace App\Http\Controllers;

use App\Http\Resources\EstanteResource;
use App\Http\Resources\LibroResource;
use App\Models\Estante;
use App\Models\Libro;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BibliotecaController extends Controller
{
    /**
     * Los 4 estantes con los títulos de sus libros, sin las páginas (para no mandar todo de una).
     * with() trae todos los libros en UNA consulta extra, en vez de una por estante (problema N+1).
     */
    public function index(): AnonymousResourceCollection
    {
        $estantes = Estante::with('libros:id,estante_id,slug,titulo,clase,orden')->orderBy('orden')->get();

        return EstanteResource::collection($estantes);
    }

    /** Un libro completo. Si el slug no existe, firstOrFail() responde 404. */
    public function libro(string $slug): LibroResource
    {
        $libro = Libro::where('slug', $slug)->firstOrFail();

        return new LibroResource($libro->load('estante'));
    }
}
