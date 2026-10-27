import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                // Pantalla de inicio (Tailwind + preview del personaje)
                'resources/css/app.css',
                'resources/js/inicio.js',
                // El juego (canvas, sin Tailwind)
                'resources/css/juego.css',
                'resources/js/juego/main.js',
            ],
            refresh: true,
            // Las fuentes se descargan al compilar y se sirven desde nuestro servidor.
            fonts: [
                bunny('Poppins', { weights: [400, 600, 700] }),
                bunny('Press Start 2P', { alias: 'press-start' }),
                // Del diario del easter egg: sin precarga (se bajan solo cuando se abre).
                bunny('UnifrakturMaguntia', { alias: 'gotica', preload: false }),
                bunny('Old Standard TT', { alias: 'diario', weights: [400, 700], preload: false }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
