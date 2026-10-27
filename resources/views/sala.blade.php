<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    {{-- viewport-fit=cover: en iPhone usamos toda la pantalla y respetamos el notch con safe-area --}}
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    {{-- Echo lee este token para autorizar el canal de presencia en /broadcasting/auth --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Sala RPG</title>
    @fonts
    <script>
        {{-- @json escapa < > & ' " : un nombre no puede "romper" el script (anti-XSS) --}}
        window.SALA = @json($config);
    </script>
    @vite(['resources/css/juego.css', 'resources/js/juego/main.js'])
</head>
<body>
    <section id="carga" class="carga" aria-live="polite">
        <p class="carga-titulo">CARGANDO...</p>
        <div class="carga-pista">
            <canvas data-personaje class="carga-personaje" width="32" height="48"></canvas>
            <div class="carga-barra"><div data-relleno class="carga-relleno"></div></div>
        </div>
        <p data-porcentaje class="carga-porcentaje">0%</p>

        <div data-error class="carga-error" role="alert" hidden>
            <p data-error-texto></p>
            <button type="button" data-reintentar class="boton">Reintentar</button>
        </div>
    </section>

    <main id="sala" class="sala" hidden>
        <canvas id="pantalla" aria-label="La sala"></canvas>
    </main>

    {{-- Controles en pantalla: solo aparecen en pantallas táctiles --}}
    <div id="tactil" class="tactil" hidden></div>

    {{-- Ventanas encima del juego: menú de estante, libro y (etapa 6) diálogos --}}
    <div id="modales" class="modales"></div>

    <div id="hud" class="hud" hidden>
        <nav data-botones class="hud-botones" aria-label="Menú"></nav>
        <div class="hud-estado">
            <span data-wifi class="hud-wifi" role="img"></span>
            <span data-contador class="hud-contador">1/{{ $config['cupo'] }}</span>
        </div>
        <div data-toasts class="hud-toasts" aria-live="polite"></div>
        {{-- Duelos: cuenta 3-2-1-¡YA! en el centro y reloj arriba --}}
        <p id="duelo-reloj" class="duelo-reloj" hidden></p>
        <p id="duelo-cuenta" class="duelo-cuenta" aria-live="assertive" hidden></p>
        <p class="hud-ayuda">WASD mover · E interactuar · Enter chat · M sonido</p>

        <div id="chat" class="chat">
            <section data-historial class="chat-historial">
                <button type="button" data-plegar class="chat-titulo" aria-expanded="true" aria-controls="chat-lista">
                    Chat <span class="chat-flecha" aria-hidden="true">▾</span>
                </button>
                <ol id="chat-lista" data-lista class="chat-lista" aria-live="polite"></ol>
            </section>
            <form data-form class="chat-form" hidden>
                <input data-input type="text" maxlength="80" autocomplete="off" spellcheck="false" enterkeyhint="send"
                       placeholder="Escribí y apretá Enter (Esc cancela)" aria-label="Mensaje del chat">
                <span data-contador-chat class="chat-contador">0/80</span>
                <button type="submit" class="chat-accion" aria-label="Enviar">➤</button>
                <button type="button" data-cancelar class="chat-accion" aria-label="Cancelar">✕</button>
            </form>
            <p data-pista class="chat-pista">Enter para chatear</p>
        </div>
    </div>
</body>
</html>
