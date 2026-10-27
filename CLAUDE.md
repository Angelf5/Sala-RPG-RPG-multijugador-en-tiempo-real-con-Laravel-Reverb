# Sala RPG — TUP UTN Formosa · Programación IV

> **Para Claude Code:** este archivo es la especificación completa del proyecto. Leelo entero antes de tocar código.
> Trabajá **por etapas** (sección 9): hacé SOLO la etapa que te pidan, probala, mostrale al usuario cómo verificarla y frená.
> **No ejecutes `php artisan boost:install`**: sobrescribe este archivo. Ignorá el texto de Laravel Boost que hay en `AGENTS.md`.
> El usuario es estudiante: explicá brevemente lo que hacés y por qué, en español rioplatense.
> **Procesos del usuario:** para tus pruebas usá otros puertos (ej. 8001 y 8090) y **nunca cierres** los `serve`, `reverb:start` o `vite` del usuario, ni procesos de VS Code.
> **MySQL de XAMPP:** no prendas ni apagues el MySQL de XAMPP. Si necesitás la base y está apagada, pedile al usuario que lo prenda.
> **Datos del usuario:** nunca borres, truncates ni vacíes tablas de la base sala_rpg (ni corras migrate:fresh sobre ella) sin preguntar antes. Para pruebas usá sala_rpg_test o una base aparte, o borrá solo los registros que creaste vos, identificándolos primero.
> **Tests:** antes de cerrar cada parte corré la suite en SQLite y en MySQL (composer test:mysql).

---

## 1. Qué es

Un mini RPG multijugador en tiempo real, estilo anime / pixel art, para el trabajo de Programación IV.
Hasta **50 alumnos** entran con su nombre, eligen **chico o chica** y un **color**, y caminan por una habitación-biblioteca donde:

- ven moverse a los demás en vivo (canal de **presencia** + **whispers** de Reverb),
- chatean con globos de texto sobre la cabeza,
- leen **libros** con la teoría de la cátedra (4 estantes),
- hablan con dos NPCs: **Claude** (mentora de la biblioteca, explica teoría y toma examen) y **Claude Code** (programador, da tips y comandos).

El juego es en sí mismo un **ejemplo funcionando** del programa de la materia: cada libro termina con una página “🎮 En este juego…” que señala dónde se aplica ese concepto. **Esas páginas tienen que ser verdad**: si cambiás un comportamiento (límites, nombres de canales, rutas), actualizá el texto del libro en `kit/contenido/libros.json`.

## 2. Entorno del usuario

- **Windows** + **XAMPP** (MySQL, PHP) + Git Bash + VS Code. Proyecto en `C:\xampp\htdocs\sala-rpg`.
- Ya se ejecutó: `composer create-project laravel/laravel sala-rpg` y `php artisan install:broadcasting --reverb`.
- Versiones instaladas: **Laravel 13**, `laravel/reverb ^1`, `laravel-echo ^2`, `pusher-js ^8`, **Vite 8**, **Tailwind 4**, PHPUnit 12.
- Base de datos: **MySQL de XAMPP** (usuario `root`, sin contraseña por defecto). Base: `sala_rpg`. El `.env` hoy apunta a SQLite: cambiarlo.
- Para desarrollar se usan tres procesos: `php artisan serve`, `php artisan reverb:start` y `npm run dev`.
- `config/reverb.php` ya trae `accept_client_events_from = members` → los **whispers funcionan en canales de presencia** sin tocar nada.

## 3. Kit (ya está en el repo)

```
kit/
├── retratos/        6 PNG 480×600 con fondo transparente, ojos alineados en (240,255)
│   ├── claude_normal.png   claude_feliz.png   claude_pensativa.png
│   └── code_normal.png     code_guino.png     code_bug.png
├── contenido/
│   ├── libros.json     4 estantes, 35 libros (páginas con texto + código opcional + "en_este_juego")
│   ├── dialogos.json   saludos, menús y pools de frases de los 2 NPCs
│   └── examen.json     50 preguntas de opción múltiple (correcta = índice 0-3)
└── LEEME.md
```

Dónde va cada cosa:
- `kit/retratos/*` → copiar a `public/img/retratos/`.
- `kit/contenido/libros.json` y `examen.json` → copiar a `database/seeders/data/` y cargarlos con seeders.
- `kit/contenido/dialogos.json` → copiar a `resources/js/juego/data/dialogos.json` (se importa desde JS).
- No borres `kit/`: es la fuente del contenido.

**Todo el resto del arte (mapa, muebles, personajes, NPCs en el mapa, posters) se genera por código** (pixel art dibujado en canvas desde matrices). No usar imágenes externas ni logos oficiales de nadie.

## 4. Arquitectura

```
Navegador ──HTTP (login, chat, libros, examen, guardar posición)──► Laravel (serve / Apache)
    ▲                                                                   │ broadcast firmado con SECRET
    │ WebSocket (Echo + pusher-js)                                      ▼
    └──────────────────────────────── Reverb :8080 ◄────────────────────┘
          canal de presencia  sala.1
          • here / joining / leaving  → quién está
          • whisper 'mover'           → pasos (directo navegador→Reverb→otros, sin Laravel)
          • whisper 'estoy'           → posición actual para el que acaba de entrar
          • evento  .MensajeEnviado   → chat (pasa por Laravel: validación + rate limit)
```

**Decisión clave (explicarla en la defensa):** con 50 jugadores caminando, mandar cada paso por HTTP serían cientos de requests/seg y `php artisan serve` atiende de a uno. Por eso el **movimiento va por whisper** (rápido, no validado por el servidor, datos efímeros) y el **chat va por Laravel** (validado, con rate limit, persistido). Es el trade-off “server-authoritative vs. client events”.

**Sincronización del que entra tarde:** los datos de `here()` son los del momento en que cada uno se unió (posición vieja). Por eso, en `joining(user)`, **cada cliente ya presente responde con un whisper `estoy` {id,x,y,dir}** para que el nuevo los ubique bien. Además la posición propia se guarda en BD (cada 5 s si cambió + al cerrar con `sendBeacon`) para que al recargar aparezcas donde estabas.

## 5. Modelo de datos

**users** (migración que modifica la tabla existente):
- `email` y `password` → **nullable** (el login es solo con nombre).
- agregar: `genero` enum(`chico`,`chica`), `color` char(7), `x` unsignedTinyInteger default 15, `y` unsignedTinyInteger default 18, `dir` string(9) default `arriba` (tiene que entrar `izquierda`), `ultima_vez` timestamp nullable.

**estantes**: `id, slug unique, nombre, icono, color, descripcion, orden`.
**libros**: `id, estante_id FK, slug unique, titulo, clase, paginas json, en_este_juego text nullable, orden`. (`Estante hasMany Libro`, `Libro belongsTo Estante`, cast `paginas` → array.)
**mensajes**: `id, user_id FK, texto string(80), timestamps`. (`User hasMany Mensaje`.)
**preguntas**: `id, libro_slug, pregunta, opciones json, correcta tinyint, explicacion`.

Seeders: `BibliotecaSeeder` (lee `database/seeders/data/libros.json`) y `ExamenSeeder` (lee `examen.json`), llamados desde `DatabaseSeeder`. Deben ser idempotentes (`updateOrCreate` por slug).

## 6. Backend

### Rutas (`routes/web.php`)
| Método | URL | Middleware | Qué hace |
|---|---|---|---|
| GET | `/` | guest | Pantalla de inicio (nombre + chico/chica + color). Si ya está logueado → `/sala`. |
| POST | `/entrar` | guest, throttle:10,1 | Valida, crea el `User`, `Auth::login`, regenera sesión → `/sala`. `Log::info`. |
| POST | `/salir` | auth | Logout → `/`. |
| GET | `/sala` | auth | Vista del juego. Pasa el jugador actual como JSON al Blade. |
| POST | `/posicion` | auth, throttle:30,1 | Guarda `x,y,dir` (validar rango del mapa y que la celda sea caminable). 204. |
| GET | `/chat` | auth | Últimos 30 mensajes (con nombre y color del autor). |
| POST | `/chat` | auth, throttle:`chat` | Crea mensaje, `broadcast(new MensajeEnviado($m))->toOthers()`. 201. |
| GET | `/biblioteca` | auth | Estantes con títulos de libros (sin páginas). |
| GET | `/libros/{slug}` | auth | Libro completo. 404 si no existe. |
| GET | `/examen` | auth | 5 preguntas al azar. |

- Rate limiter `chat` en `AppServiceProvider`: **10 por minuto por usuario**. Al superarlo → 429 y `Log::warning`. El front muestra “¡Más despacio!”.
- Validación de `/entrar`: `nombre` required, 2–20 caracteres, regex letras (con acentos y ñ), números y espacios, `trim`; `genero` in:chico,chica; `color` in: la paleta (sección 7). Los nombres pueden repetirse.
- Validación de `/chat`: `texto` required, string, max:80, trim. Rechazar solo espacios.
- `/sala` con cupo: si ya hay 50 en la sala (lo informa el front vía `here()`), el front muestra “Sala llena (50/50)”; además `REVERB_APP_MAX_CONNECTIONS=60` en `.env`.
- El mapa (matriz de caminables) debe existir **en un solo lugar compartido**: definirlo en `resources/js/juego/data/mapa.json` y leerlo también desde PHP (`resource_path(...)`) para validar `/posicion`.
- Usar controladores flacos + una clase de servicio donde haya lógica (ej. `SalaService` para validar posición). Es contenido de la materia (capas).

### Canal (`routes/channels.php`)
```php
Broadcast::channel('sala.1', fn (User $user) => [
    'id' => $user->id, 'nombre' => $user->name, 'genero' => $user->genero,
    'color' => $user->color, 'x' => $user->x, 'y' => $user->y, 'dir' => $user->dir,
]);
```

### Evento
`App\Events\MensajeEnviado implements ShouldBroadcast` → `PresenceChannel('sala.1')`, `broadcastAs(): 'MensajeEnviado'`, `broadcastWith()` = `{id, user_id, nombre, color, texto, hora}`. En JS se escucha con **`.listen('.MensajeEnviado')`** (con punto).

`.env`: `BROADCAST_CONNECTION=reverb`, `QUEUE_CONNECTION=sync`, `DB_CONNECTION=mysql`, `DB_DATABASE=sala_rpg`.

## 7. Frontend

Vanilla JS modular (sin frameworks) + Canvas 2D. Tailwind solo para las pantallas HTML (inicio). Estructura sugerida:

```
resources/js/juego/
├── main.js            arranque, bucle (requestAnimationFrame), estados
├── config.js          constantes (TILE=32, paleta, velocidades)
├── data/mapa.json     mapa (ver 7.2)   data/dialogos.json (del kit)
├── mapa.js            dibujo del mapa a un canvas offscreen + colisiones
├── pixel.js           helpers: dibujar matrices de píxeles con paleta, escalar
├── sprites.js         generación de sprites de jugadores (chico/chica × color × 4 dir × 3 frames)
├── npcs.js            sprites y lógica de Claude y Claude Code en el mapa
├── red.js             Echo: join sala.1, here/joining/leaving, whispers, chat, estado de conexión
├── entrada.js         teclado
├── ui/carga.js  ui/hud.js  ui/chat.js  ui/dialogo.js  ui/libro.js  ui/examen.js
└── audio.js           blips con WebAudio (sin archivos), mute con M
resources/css/juego.css
```

### 7.1 Pantallas
1. **Inicio** (`/`): fondo negro, título “SALA RPG” y subtítulo “TUP · UTN Formosa — Programación IV”. Campo nombre, selector **Chico / Chica** (con preview del sprite animado caminando hacia abajo, que cambia en vivo), **paleta de 12 colores**, botón “Entrar”. Errores de validación visibles.
   Paleta: `#e74c3c` rojo, `#e67e22` naranja, `#f1c40f` amarillo, `#9acd32` lima, `#27ae60` verde, `#1abc9c` turquesa, `#3498db` celeste, `#2c3e9e` azul, `#8e44ad` violeta, `#e84393` rosa, `#8b5a2b` marrón, `#7f8c8d` gris.
2. **Carga** (dentro de `/sala`): fondo negro, “CARGANDO...” con letter-spacing amplio, barra blanca fina de ~300px sobre gris oscuro, porcentaje debajo, y arriba de la barra **tu propio personaje caminando**. El progreso es real:
   fuentes 10% → sprites generados 30% → retratos cargados 55% → Echo conectado 80% → `here()` recibido 100% → fade a la sala. Si Reverb no responde en 8 s: mensaje claro (“No se pudo conectar al servidor de tiempo real. ¿Está corriendo `php artisan reverb:start`?”) y botón reintentar.
3. **Sala**: canvas centrado y escalado al máximo entero que entre en la ventana (`image-rendering: pixelated`), fondo negro.

### 7.2 Mapa (30×20 tiles de 32px → 960×640)
```
 0 ##############################
 1 #cc...PPPP.......UUUU....cc..#
 2 #cc...PPPP.......UUUU....cc..#
 3 #AAA.SSS..............TTT.DDD#
 4 #AAA.SSS.......L......TTT.DDD#
 5 #............................#
 6 #p..........................p#
 7 #.........rrrrrrrrrr.........#
 8 #.........rrrrrrrrrr.........#
 9 #.........rrrrrrrrrr.........#
10 #.........rrrrrrrrrr.........#
11 #.........rrrrrrrrrr.........#
12 #............................#
13 #EEEE....................ssss#
14 #EEEE....................mm..#
15 #.K......................ssss#
16 #............................#
17 #p..........................p#
18 #............................#
19 ##############@@##############
```
- `#` borde/pared. **Filas 1–2 son la cara de la pared (no caminables)**; sobre ellas: `c` cuadros pequeños, `P` **poster de Claude**, `U` **poster TUP UTN**, `.` pared lisa (empapelado a cuadritos beige como en la referencia).
- `A` estante **APIs y Datos** (azul) · `S` **Seguridad** (rojo) · `T` **Tiempo Real** (amarillo) · `D` **Despliegue** (verde). Cada uno 3×2, con lomos de libros del color del estante y un cartelito con el ícono. No caminables.
- `L` **NPC Claude** (mirando abajo). `K` **NPC Claude Code** (mirando arriba, hacia el escritorio). No caminables.
- `E` escritorio con PC (pantalla con brillo verde de terminal). `s` sillón, `m` mesa ratona, `p` planta. No caminables.
- `r` alfombra geométrica gris/blanca (caminable). `.` piso de madera en tablas (caminable). `@` puerta (spawn en (15,18) mirando arriba).
- El mapa va en `data/mapa.json` como array de strings + leyenda `{char: {caminable, tipo}}`.
- Posters (dibujados por código, sin logos oficiales): **Claude**: fondo terracota `#c4673f`, una mini versión pixel de la NPC Claude (pelo cobrizo, anteojos, suéter crema) y el texto “CLAUDE”. **TUP**: fondo azul marino, texto grande “TUP” y abajo “UTN · FORMOSA”. Si existe `public/img/posters/tup.png`, usarla en lugar del poster generado.

### 7.3 Personajes
- Sprite base 16×24 px dibujado a escala 2 (32×48), anclado a la celda (los pies en la celda, la cabeza sobresale hacia arriba). Ordenar el dibujo por `y` (los de abajo tapan a los de arriba).
- **Chico**: pelo corto, remera + pantalón. **Chica**: pelo largo, remera + pollera. Estilo chibi (cabeza grande).
- El **color elegido** pinta la remera; pantalón/pollera = el mismo color oscurecido 35%. Contorno oscuro de 1px.
- Color de pelo y tono de piel: derivados del `id` (hash) entre 5 opciones naturales cada uno, para variedad sin agregar más pasos al inicio.
- 4 direcciones × 3 frames (quieto, paso A, paso B). Generar todo una vez en un canvas offscreen y cachear por `genero+color+pelo+piel`.
- Nombre arriba de la cabeza (fuente pixel chica, sombra negra). El tuyo con un triangulito encima para ubicarte.
- **NPCs en el mapa**: Claude = pelo largo cobrizo `#b5532a`, anteojos dorados, suéter crema `#eadcc2`, bufanda terracota. Claude Code = pelo naranja en punta `#f07a1a`, buzo negro con vivos naranjas, auriculares. Animación idle (parpadeo/respiración). Un “!” flotante cuando estás al lado.

### 7.4 Movimiento y red
- Movimiento por celdas con flechas o WASD. Un paso dura **125 ms** (máx. 8 pasos/s) con interpolación suave. Colisión solo contra el mapa (**los jugadores se atraviesan entre sí**). Girar sin moverse si la celda está bloqueada.
- En cada paso: `canal.whisper('mover', {id, x, y, dir})`. Nada si estás quieto.
- Remotos: guardar destino e interpolar; si la distancia es > 2 celdas (lag o reconexión), teletransportar.
- `here(users)`: crear todos (con la posición del payload). `joining(user)`: crearlo y **responderle** con `whisper('estoy', {id,x,y,dir})`. `leaving(user)`: fade out y borrar. `listenForWhisper('estoy')`: corregir posición.
- Guardar posición propia: `POST /posicion` cada 5 s si cambió, y en `pagehide` con `navigator.sendBeacon` (FormData con `_token`).
- **Estado de conexión**: `Echo.connector.pusher.connection.bind('state_change')` → ícono wifi del HUD: verde `connected`, amarillo `connecting`, rojo `unavailable`/`disconnected`/`failed` (al apagar Reverb, pusher-js pasa a `unavailable` a los ~10 s). Al volver a `connected`, re-sincronizar (re-join y pedir posiciones).
- Cupo: si `here()` trae ≥ 50, mostrar “Sala llena (50/50)” y no entrar.

### 7.5 Chat
- `Enter` abre el input (abajo a la izquierda); `Enter` envía, `Esc` cancela. Mientras escribís, el personaje no se mueve.
- Contador 0/80. `POST /chat`. Error 429 → toast “¡Más despacio!”, 422 → mostrar el mensaje.
- Globo de texto sobre la cabeza durante 4 s (máx. 2 líneas, cortar con “…”). Panel de historial plegable (últimos 30, `GET /chat` al entrar).
- **Siempre `textContent`, nunca `innerHTML`** para texto de usuarios (anti-XSS, está en un libro).
- Con mucha gente: si hay más de 25 jugadores en pantalla, mostrar los nombres solo de los que estén a ≤ 4 celdas (opción en Ajustes).

### 7.6 Interacción (tecla E / Espacio, mirando hacia el objeto adyacente)
- **Estante** → menú con los libros de ese estante (título + clase) → abre el libro.
- **Libro**: UI de libro abierto centrado (dos páginas en desktop, una en pantallas angostas), título, número de página, `←/→` para pasar, `Esc` para cerrar. Bloques de `codigo` en monoespaciada sobre fondo oscuro. Última página “🎮 En este juego…” con estilo destacado (si `en_este_juego` no es null).
- **NPC** → caja de diálogo (7.7).
- **Escritorio** → mensaje corto: “La terminal de Claude Code. Mejor hablá con él.”

### 7.7 Diálogos (datos en `dialogos.json`)
- Caja abajo, ancho completo, borde doble estilo RPG. **Retrato** del NPC a la izquierda, sobresaliendo por arriba de la caja (mostrar ~240×300, de los PNG 480×600), con la expresión indicada en cada línea. Cartel con el nombre del NPC.
- Texto con efecto máquina de escribir (~40 caracteres/s) + blip suave. `Espacio`/`Enter`: si está escribiendo, completa; si terminó, avanza.
- Al terminar las líneas de una opción, vuelve al menú. Menú con `↑/↓` + `Enter`. `{nombre}` → nombre del jugador. Saludo según hora (mañana < 12, tarde < 20, noche) y `repetido` si ya habló con ese NPC en esta sesión.
- Acciones: `recomendar_libro` (elige un libro al azar y resalta su estante con un brillo por 6 s), `iniciar_examen` (7.8), `al_azar` (una línea al azar del `pool`, sin repetir la última), `cierra`.
- Mientras hay diálogo, el jugador no se mueve. Los demás siguen viéndote quieto.

### 7.8 Modo examen (con Claude)
- `GET /examen` → 5 preguntas. Mostrar pregunta + 4 opciones (↑/↓ + Enter) en la caja de diálogo, con el retrato de Claude.
- Correcta → expresión `feliz` + frase de `examen.correcta`. Incorrecta → `pensativa` + frase + la `explicacion` + “Repasá: «título del libro»”.
- Al final, puntaje con la frase de `examen.final` según rango.

### 7.9 HUD (inspirado en la referencia del usuario)
- Arriba a la izquierda, columna de botones redondos color crema con íconos violeta oscuro: **⚙ Ajustes** (volumen, mostrar nombres: todos/cercanos, tamaño de texto), **ℹ Info** (controles + créditos: “Proyecto de Programación IV — TUP UTN Formosa”), **👥 Jugadores** (lista de conectados con su color).
- Arriba a la derecha: ícono **wifi** (estado de conexión) + contador `12/50`.
- Toasts arriba al centro: “Ana entró a la sala”, “Ana salió”.
- Abajo a la derecha, ayuda de controles chiquita: `WASD mover · E interactuar · Enter chat · M sonido`.

### 7.10 Estética
- Tipografías: **Poppins** para la UI y una pixel (**Press Start 2P** o **VT323**) para nombres, globos y títulos. Desde Google Fonts o Bunny Fonts.
- Paleta cálida de la habitación de referencia: maderas `#8a5a3b`/`#a8714a`, pared beige `#d8c3a0`, oscuros `#2a1e17`. UI oscura semitransparente `rgba(15,12,20,.92)` con bordes crema `#f3e6d0`.
- Todo dibujado con `imageSmoothingEnabled = false`.

## 8. Calidad mínima
- **Tests de feature** (`php artisan test`): no se puede ver `/sala` sin login; `/entrar` valida nombre/género/color; `/chat` rechaza vacío y > 80 (422); el limitador devuelve 429 al mensaje 11; `/chat` emite `MensajeEnviado` (`Event::fake`); `/posicion` rechaza celdas no caminables; `/libros/{slug}` 404 si no existe; los seeders cargan 4 estantes y 35 libros.
- `php artisan pint` antes de cerrar cada etapa.
- Sin errores en la consola del navegador. Probar con **2 navegadores** (uno normal y uno en incógnito) para ver el multijugador.

## 9. Etapas (hacer de a una)

**Etapa 0 — Base.** MySQL (`sala_rpg`) en `.env`, `BROADCAST_CONNECTION=reverb`, `QUEUE_CONNECTION=sync`. Copiar archivos del kit a su lugar. Migraciones (users + estantes + libros + mensajes + preguntas), modelos con relaciones, seeders. `php artisan migrate:fresh --seed` funciona. ✔ Verificar en phpMyAdmin que hay 35 libros.

**Etapa 1 — Entrar y cargar.** Pantalla de inicio con preview del personaje (los sprites de 7.3 se hacen acá), `/entrar`, `/salir`, middleware auth en `/sala`, pantalla de carga con progreso real conectando Echo al canal `sala.1`. ✔ Entrar con un nombre, ver la carga llegar a 100%.

**Etapa 2 — La habitación.** Mapa 7.2 completo dibujado por código (pisos, paredes, posters, estantes, muebles, alfombra), movimiento local con colisiones, NPCs dibujados (todavía sin diálogo). ✔ Caminar por toda la sala sin atravesar muebles.

**Etapa 3 — Multijugador.** Presencia + whispers `mover`/`estoy`, interpolación, entrada/salida con toasts, guardar posición, HUD con wifi y contador. ✔ Dos navegadores se ven moverse en vivo; al apagar Reverb, el wifi se pone rojo y al prenderlo se recupera.

**Etapa 4 — Chat.** Evento `MensajeEnviado`, rate limiter, globos, historial, toasts de error. ✔ Mensajes en vivo; el 11.º mensaje en un minuto muestra “¡Más despacio!”.

**Etapa 5 — Biblioteca.** Endpoints, menú de estante, UI del libro con páginas, código y “🎮 En este juego”. ✔ Abrir libros de los 4 estantes.

**Etapa 6 — NPCs.** Caja de diálogo con retratos y expresiones, menús, pools, recomendar libro. ✔ Charlar con los dos NPCs.

**Etapa 7 — Modo examen.** ✔ Hacer un examen de 5 preguntas con Claude.

**Etapa 8 — Publicar para la clase (Cloudflare Tunnel).** Ver sección 10. ✔ Un compañero entra desde su casa.

**Etapa 9 — Pulido.** Sonidos WebAudio, ajustes, tests de la sección 8, controles táctiles opcionales (d-pad en pantalla si es táctil), README para entregar con capturas e instrucciones.

## 10. Publicación con Cloudflare Tunnel (etapa 8)

- **No usar `php artisan serve` con 50 personas**: en Windows el servidor embebido de PHP atiende una petición a la vez. Servir Laravel con el **Apache de XAMPP**: crear un `VirtualHost` en un puerto propio (ej. 8081) con `DocumentRoot` en `C:/xampp/htdocs/sala-rpg/public` y `AllowOverride All`. Explicarle al usuario cómo editar `httpd-vhosts.conf` y agregar el `Listen 8081`.
- Compilar los assets: `npm run build` (con el túnel no se usa el servidor de Vite).
- Dos túneles rápidos (sin cuenta), cada uno en su terminal:
  `cloudflared tunnel --url http://localhost:8081` (app) y `cloudflared tunnel --url http://localhost:8080` (Reverb). Cada uno imprime una URL `https://xxxx.trycloudflare.com`.
- `.env` para ese día (Laravel sigue hablando con Reverb por la máquina local, 127.0.0.1; solo el navegador usa el túnel):
  ```
  APP_URL=https://<app>.trycloudflare.com
  REVERB_HOST=127.0.0.1   # no "localhost": en Windows prueba primero IPv6 (::1), Reverb escucha en IPv4 y cada broadcast tardaba ~0,2 s de más
  REVERB_PORT=8080
  REVERB_SCHEME=http
  VITE_REVERB_HOST=<reverb>.trycloudflare.com
  VITE_REVERB_PORT=443
  VITE_REVERB_SCHEME=https
  ```
  y después `php artisan config:clear` + `npm run build`.
- Confiar en el proxy para que Laravel genere URLs https: `$middleware->trustProxies(at: '*')` en `bootstrap/app.php`.
- Las URLs rápidas cambian en cada arranque: dejar un script `publicar.sh` (Git Bash) o una guía `PUBLICAR.md` paso a paso.
- Mantener la compu enchufada, sin suspensión, y XAMPP + `reverb:start` + los dos túneles abiertos.
