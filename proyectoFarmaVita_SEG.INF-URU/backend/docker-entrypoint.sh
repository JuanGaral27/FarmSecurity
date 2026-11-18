#!/bin/sh
# Configura las rutas estáticas hacia fw-01 (requiere NET_ADMIN) y
# luego ejecuta la API como usuario sin privilegios "node".
set -e

if [ -n "$STATIC_ROUTES" ]; then
  OLDIFS="$IFS"; IFS=';'
  for r in $STATIC_ROUTES; do
    IFS="$OLDIFS"
    # shellcheck disable=SC2086
    ip route replace $r && echo "[backend] Ruta estática: $r" || echo "[backend] ERROR ruta: $r"
    IFS=';'
  done
  IFS="$OLDIFS"
fi
ip route

exec su-exec node node /app/dist/main.js
