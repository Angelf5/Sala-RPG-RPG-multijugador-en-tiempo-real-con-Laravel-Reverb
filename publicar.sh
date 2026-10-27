#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Publicar la Sala RPG para la clase con Cloudflare Tunnel (Git Bash, Windows).
#
#  Uso:   ./publicar.sh
#  Antes: Apache (con el VirtualHost del puerto 8081) y MySQL prendidos en XAMPP,
#         y `npm run dev` CERRADO. Los detalles están en PUBLICAR.md.
#
#  Qué hace:
#   1. Abre dos túneles rápidos (sin cuenta): uno para la app (Apache :8081) y otro
#      para Reverb (:8080). Cada uno da una URL https://xxxx.trycloudflare.com.
#   2. Guarda tu .env en .env.desarrollo y le pone los valores para publicar
#      (URLs del túnel, APP_DEBUG=false, APP_ENV=production).
#   3. Compila los assets (npm run build) con la URL de Reverb del túnel.
#   4. Prende Reverb si no estaba corriendo.
#   5. Con Ctrl+C cierra todo y te devuelve el .env de desarrollo.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")"

PUERTO_APP=8081
PUERTO_REVERB=8080
LOGS=storage/logs
CLOUDFLARED="$(command -v cloudflared || true)"
[ -z "$CLOUDFLARED" ] && [ -x "/c/Program Files (x86)/cloudflared/cloudflared.exe" ] && CLOUDFLARED="/c/Program Files (x86)/cloudflared/cloudflared.exe"
[ -z "$CLOUDFLARED" ] && [ -x "/c/Program Files/cloudflared/cloudflared.exe" ] && CLOUDFLARED="/c/Program Files/cloudflared/cloudflared.exe"

verde() { printf '\033[32m%s\033[0m\n' "$*"; }
rojo() { printf '\033[31m%s\033[0m\n' "$*"; }
paso() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

PIDS=()
ENV_MODIFICADO=0

restaurar() {
    paso "Cerrando la publicación…"
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
    if [ "$ENV_MODIFICADO" = 1 ] && [ -f .env.desarrollo ]; then
        mv -f .env.desarrollo .env
        php artisan config:clear >/dev/null
        verde "✔ Volvió tu .env de desarrollo (APP_DEBUG=true, URLs locales)."
        echo "  Para seguir programando: npm run dev (y php artisan serve / reverb:start como siempre)."
    fi
    exit 0
}
trap restaurar INT TERM

# Cambia (o agrega) una variable del .env.
poner_env() {
    local clave="$1" valor="$2"
    if grep -q "^${clave}=" .env; then
        sed -i "s|^${clave}=.*|${clave}=${valor}|" .env
    else
        echo "${clave}=${valor}" >> .env
    fi
}

# Espera a que cloudflared escriba su URL en el log (hasta 40 s).
esperar_url() {
    local log="$1" url=""
    for _ in $(seq 1 80); do
        url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$log" 2>/dev/null | head -1)"
        [ -n "$url" ] && { echo "$url"; return 0; }
        sleep 0.5
    done
    return 1
}

# ── 1. Chequeos ───────────────────────────────────────────────────────────────
paso "Revisando que esté todo listo"

if [ -z "$CLOUDFLARED" ]; then
    rojo "✘ No encontré cloudflared. Instalalo con:  winget install --id Cloudflare.cloudflared"
    exit 1
fi
verde "✔ cloudflared: $("$CLOUDFLARED" --version | head -1)"

if ! curl -s -o /dev/null --max-time 5 "http://localhost:${PUERTO_APP}/up"; then
    rojo "✘ Apache no responde en http://localhost:${PUERTO_APP}."
    echo "  Prendé Apache en el panel de XAMPP y revisá el VirtualHost del puerto ${PUERTO_APP} (PUBLICAR.md, paso 1)."
    exit 1
fi
verde "✔ Apache sirve la sala en el puerto ${PUERTO_APP}"

if [ -f public/hot ]; then
    if curl -s -o /dev/null --max-time 2 "$(cat public/hot)/@vite/client"; then
        rojo "✘ Está corriendo 'npm run dev'. Cerralo (Ctrl+C en su terminal): con el túnel se usan los assets compilados."
        exit 1
    fi
    rm -f public/hot # quedó de un 'npm run dev' que se cerró mal
fi

if [ -f .env.desarrollo ]; then
    rojo "✘ Ya existe .env.desarrollo: parece que una publicación anterior no se cerró bien."
    echo "  Revisalo y, si es tu .env de siempre, restauralo con:  mv .env.desarrollo .env"
    exit 1
fi

# ── 2. Túneles ────────────────────────────────────────────────────────────────
paso "Abriendo los túneles de Cloudflare (tarda unos segundos)"
: > "$LOGS/tunel-app.log"
: > "$LOGS/tunel-reverb.log"
"$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:${PUERTO_APP}" > "$LOGS/tunel-app.log" 2>&1 &
PIDS+=($!)
"$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:${PUERTO_REVERB}" > "$LOGS/tunel-reverb.log" 2>&1 &
PIDS+=($!)

URL_APP="$(esperar_url "$LOGS/tunel-app.log")" || { rojo "✘ El túnel de la app no dio URL (mirá $LOGS/tunel-app.log)."; restaurar; }
URL_REVERB="$(esperar_url "$LOGS/tunel-reverb.log")" || { rojo "✘ El túnel de Reverb no dio URL (mirá $LOGS/tunel-reverb.log)."; restaurar; }
HOST_REVERB="${URL_REVERB#https://}"
verde "✔ App:    $URL_APP"
verde "✔ Reverb: $URL_REVERB"

# ── 3. .env para publicar ─────────────────────────────────────────────────────
paso "Configurando el .env para publicar (tu .env queda guardado en .env.desarrollo)"
cp .env .env.desarrollo
ENV_MODIFICADO=1
poner_env APP_URL "$URL_APP"
poner_env APP_ENV production
poner_env APP_DEBUG false            # nunca mostrar errores reales a los visitantes
# Laravel le habla a Reverb por adentro de la compu; solo el navegador usa el túnel.
# 127.0.0.1 y no "localhost": en Windows, "localhost" prueba primero IPv6 y cada aviso
# a Reverb pierde ~0,2 s antes de caer en IPv4 (Reverb escucha solo en IPv4).
poner_env REVERB_HOST 127.0.0.1
poner_env REVERB_PORT "$PUERTO_REVERB"
poner_env REVERB_SCHEME http
poner_env VITE_REVERB_HOST "$HOST_REVERB"
poner_env VITE_REVERB_PORT 443
poner_env VITE_REVERB_SCHEME https
php artisan config:clear >/dev/null
verde "✔ .env listo (APP_DEBUG=false)"

# ── 4. Assets compilados ──────────────────────────────────────────────────────
paso "Compilando los assets con la URL de Reverb del túnel (npm run build)"
if ! npm run build > "$LOGS/build-publicar.log" 2>&1; then
    rojo "✘ Falló npm run build (mirá $LOGS/build-publicar.log)."
    restaurar
fi
verde "✔ Assets compilados"

# ── 5. Reverb ─────────────────────────────────────────────────────────────────
paso "Reverb"
if curl -s -o /dev/null --max-time 2 "http://localhost:${PUERTO_REVERB}"; then
    verde "✔ Reverb ya estaba corriendo: lo dejo como está"
else
    php artisan reverb:start > "$LOGS/reverb-publicar.log" 2>&1 &
    PIDS+=($!)
    sleep 2
    verde "✔ Reverb prendido (log en $LOGS/reverb-publicar.log)"
fi

# ── Listo ─────────────────────────────────────────────────────────────────────
printf '\n\033[1;32m═══════════════════════════════════════════════════════════════\033[0m\n'
printf '\033[1;32m  ¡La sala está publicada! Compartí esta dirección:\033[0m\n\n'
printf '      \033[1m%s\033[0m\n\n' "$URL_APP"
printf '\033[1;32m═══════════════════════════════════════════════════════════════\033[0m\n'
echo "  • Dejá esta terminal abierta y la compu enchufada, sin suspensión."
echo "  • Apache y MySQL tienen que seguir prendidos en XAMPP."
echo "  • Ctrl+C para cerrar todo y volver al .env de desarrollo."
echo

# Espera hasta Ctrl+C (o hasta que se caiga un túnel).
while true; do
    for pid in "${PIDS[@]:0:2}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            rojo "✘ Se cerró uno de los túneles. Mirá $LOGS/tunel-app.log y $LOGS/tunel-reverb.log."
            restaurar
        fi
    done
    sleep 5
done
