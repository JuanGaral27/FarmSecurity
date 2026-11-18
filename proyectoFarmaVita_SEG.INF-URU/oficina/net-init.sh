#!/bin/sh
# ---------------------------------------------------------------------
# net-init.sh - Configura el enrutamiento del contenedor hacia fw-01
#   DEFAULT_GATEWAY : reemplaza la ruta por defecto (estaciones de oficina)
#   STATIC_ROUTES   : rutas "red via gw" separadas por ';' (servidores)
# ---------------------------------------------------------------------

if [ -n "$DEFAULT_GATEWAY" ]; then
  ip route replace default via "$DEFAULT_GATEWAY" \
    && echo "[net-init] Ruta por defecto -> $DEFAULT_GATEWAY" \
    || echo "[net-init] ERROR: no se pudo fijar la ruta por defecto (¿falta NET_ADMIN?)"
fi

if [ -n "$STATIC_ROUTES" ]; then
  OLDIFS="$IFS"; IFS=';'
  for r in $STATIC_ROUTES; do
    IFS="$OLDIFS"
    # shellcheck disable=SC2086
    ip route replace $r \
      && echo "[net-init] Ruta estática: $r" \
      || echo "[net-init] ERROR al agregar ruta: $r"
    IFS=';'
  done
  IFS="$OLDIFS"
fi

ip route
