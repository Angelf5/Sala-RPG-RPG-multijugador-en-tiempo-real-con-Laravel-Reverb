<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sala RPG — TUP UTN Formosa</title>
    @fonts
    @vite(['resources/css/app.css', 'resources/js/inicio.js'])
</head>
<body class="min-h-screen bg-black font-sans text-[#f3e6d0] antialiased">
    <main class="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
        <header class="text-center">
            <h1 class="font-pixel text-3xl tracking-widest text-white sm:text-4xl">SALA RPG</h1>
            <p class="mt-4 text-sm text-[#f3e6d0]/70">TUP · UTN Formosa — Programación IV</p>
        </header>

        <form method="POST" action="{{ route('entrar') }}" id="form-entrar"
              class="w-full space-y-6 rounded-xl border-2 border-[#f3e6d0]/80 bg-[rgba(15,12,20,.92)] p-6">
            @csrf

            @if ($errors->any())
                <div class="rounded-md border border-red-400/60 bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
                    <ul class="list-inside list-disc">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <div>
                <label for="nombre" class="mb-1 block text-sm font-semibold">Tu nombre</label>
                <input id="nombre" name="nombre" type="text" value="{{ old('nombre') }}" maxlength="20" required autofocus
                       autocomplete="off" placeholder="Ej: Ana"
                       class="w-full rounded-md border border-[#f3e6d0]/40 bg-black/50 px-3 py-2 text-white placeholder:text-white/30 focus:border-[#f3e6d0] focus:outline-none @error('nombre') border-red-400 @enderror">
            </div>

            <div class="flex items-center gap-5">
                {{-- Un pedacito de "piso" para que la sombra se vea sobre el fondo oscuro --}}
                <div class="shrink-0 rounded-lg bg-[#3a2a20] px-2 pt-1 pb-2">
                    <canvas id="preview" class="pixelado block h-[200px] w-[128px]"
                            aria-label="Vista previa de tu personaje"></canvas>
                </div>

                <fieldset class="flex-1">
                    <legend class="mb-2 text-sm font-semibold">Personaje</legend>
                    <div class="grid grid-cols-2 gap-2">
                        @foreach (['chico' => 'Chico', 'chica' => 'Chica'] as $valor => $texto)
                            <label class="cursor-pointer rounded-md border-2 border-[#f3e6d0]/30 px-3 py-2 text-center font-semibold transition has-checked:border-[#f3e6d0] has-checked:bg-[#f3e6d0] has-checked:text-[#2a1e17] has-focus-visible:ring-2 has-focus-visible:ring-white">
                                <input type="radio" name="genero" value="{{ $valor }}" class="sr-only"
                                       @checked(old('genero', 'chico') === $valor)>
                                {{ $texto }}
                            </label>
                        @endforeach
                    </div>
                    <p class="mt-3 text-xs text-[#f3e6d0]/50">El pelo y el tono de piel se sortean al entrar.</p>
                </fieldset>
            </div>

            <fieldset>
                <legend class="mb-2 text-sm font-semibold">Color</legend>
                <div class="grid grid-cols-6 gap-2">
                    @foreach ($paleta as $hex => $nombreColor)
                        <label title="{{ $nombreColor }}"
                               class="aspect-square cursor-pointer rounded-full border-2 border-black/40 transition hover:scale-110 has-checked:scale-110 has-checked:ring-4 has-checked:ring-[#f3e6d0] has-focus-visible:ring-4 has-focus-visible:ring-white"
                               style="background: {{ $hex }}">
                            <input type="radio" name="color" value="{{ $hex }}" class="sr-only"
                                   @checked(old('color', '#3498db') === $hex)>
                            <span class="sr-only">{{ $nombreColor }}</span>
                        </label>
                    @endforeach
                </div>
            </fieldset>

            <button type="submit"
                    class="w-full rounded-md bg-[#f3e6d0] py-3 font-pixel text-sm tracking-widest text-[#2a1e17] transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60">
                ENTRAR
            </button>
        </form>
    </main>
</body>
</html>
