#!/bin/bash
# ---------------------------------------------------------------------
# pruebas_oficina.sh - Validación de microsegmentación desde una oficina
# Uso: pruebas_oficina.sh [usuario] [contraseña]
# ---------------------------------------------------------------------
USUARIO="${1:-}"
CLAVE="${2:-}"
PROXY=10.10.20.10
HOST_HDR="Host: intranet.farmaceutica.local"

ok()   { printf '  \033[32m[OK]\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31m[FALLO]\033[0m %s\n' "$1"; }

echo "== Estación: $(hostname) =="
echo "Ruta por defecto: $(ip route | awk '/default/ {print $3}')"
echo

echo "1) Conectividad permitida"
ping -c1 -W2 10.10.20.10 >/dev/null 2>&1 && ok "Ping a DMZ (10.10.20.10)" || fail "Ping a DMZ"
ping -c1 -W2 10.10.30.20 >/dev/null 2>&1 && ok "Ping a Apps (10.10.30.20)" || fail "Ping a Apps"
curl -s -o /dev/null -w '%{http_code}' -H "$HOST_HDR" "http://$PROXY/" | grep -q 200 \
  && ok "HTTP intranet.farmaceutica.local" || fail "HTTP intranet"

echo
echo "2) Aislamiento de la red de datos (debe FALLAR la conexión)"
ping -c1 -W2 10.10.40.10 >/dev/null 2>&1 && fail "Ping a Datos RESPONDIÓ (brecha)" || ok "Ping a Datos bloqueado"
nc -z -w3 10.10.40.10 5432 >/dev/null 2>&1 && fail "TCP 5432 accesible (brecha)" || ok "PostgreSQL 10.10.40.10:5432 inaccesible"

if [ -n "$USUARIO" ]; then
  echo
  echo "3) Autenticación LDAP -> JWT como '$USUARIO'"
  RESP=$(curl -s -H "$HOST_HDR" -H 'Content-Type: application/json' \
          -d "{\"username\":\"$USUARIO\",\"password\":\"$CLAVE\"}" \
          "http://$PROXY/api/auth/login")
  TOKEN=$(echo "$RESP" | jq -r '.access_token // empty')
  if [ -n "$TOKEN" ]; then
    ok "Login correcto. Rol: $(echo "$RESP" | jq -r .role)"
    echo "     Medicamentos visibles:"
    curl -s -H "$HOST_HDR" -H "Authorization: Bearer $TOKEN" \
      "http://$PROXY/api/inventario/medicamentos" \
      | jq -r '.[] | "       - [\(.id)] \(.nombre) · stock \(.stock) · lote \(.loteActual)"'
  else
    fail "Login rechazado: $RESP"
  fi
fi
