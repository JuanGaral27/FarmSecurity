#!/usr/bin/env bash
# =====================================================================
#  FarmaVita · Batería de pruebas de seguridad (ejecutar en el anfitrión)
#  Uso: ./scripts/pruebas_seguridad.sh
# =====================================================================
set -u
HOST_HDR="Host: intranet.farmaceutica.local"
API="http://10.10.20.10/api"
PASS=0; FAIL=0

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
rojo()  { printf '\033[31m%s\033[0m\n' "$1"; }
titulo(){ printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

esperar() { # descripción, comando, resultado esperado (0 = éxito, 1 = fallo)
  local desc="$1" cmd="$2" esperado="$3"
  if eval "$cmd" >/dev/null 2>&1; then r=0; else r=1; fi
  if [ "$r" = "$esperado" ]; then verde "  [OK]    $desc"; PASS=$((PASS+1));
  else rojo "  [FALLO] $desc"; FAIL=$((FAIL+1)); fi
}

token() { # pc usuario clave
  docker exec "$1" sh -c "curl -s -H '$HOST_HDR' -H 'Content-Type: application/json' \
    -d '{\"username\":\"$2\",\"password\":\"$3\"}' $API/auth/login | jq -r '.access_token // empty'"
}

http_code() { # pc metodo ruta token [json]
  local datos=""
  [ -n "${5:-}" ] && datos="-H 'Content-Type: application/json' -d '$5'"
  docker exec "$1" sh -c "curl -s -o /dev/null -w '%{http_code}' -X $2 -H '$HOST_HDR' \
    -H 'Authorization: Bearer $4' $datos $API$3"
}

titulo "1. Microsegmentación (firewall fw-01)"
for pc in pc_almacen_01 pc_ventas_01 pc_admin_01 pc_laboratorio_01; do
  esperar "$pc -> ping DMZ 10.10.20.10"        "docker exec $pc ping -c1 -W2 10.10.20.10" 0
  esperar "$pc -> ping Apps 10.10.30.20"       "docker exec $pc ping -c1 -W2 10.10.30.20" 0
  esperar "$pc -> ping Datos 10.10.40.10 BLOQUEADO" "docker exec $pc ping -c1 -W2 10.10.40.10" 1
  esperar "$pc -> TCP 5432 Datos BLOQUEADO"    "docker exec $pc nc -z -w3 10.10.40.10 5432" 1
done
esperar "farma_backend -> PostgreSQL 5432 (permitido)" \
  "docker exec farma_backend node -e \"require('net').connect(5432,'10.10.40.10').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))\"" 0

titulo "2. Autenticación LDAP -> JWT"
T_ALM=$(token pc_almacen_01 almacenista1 password_almacen_123)
T_VEN=$(token pc_ventas_01 farmaceutico1 password_ventas_123)
T_LAB=$(token pc_laboratorio_01 laboratorista1 password_lab_123)
esperar "almacenista1 obtiene token"   "[ -n '$T_ALM' ]" 0
esperar "farmaceutico1 obtiene token"  "[ -n '$T_VEN' ]" 0
esperar "laboratorista1 obtiene token" "[ -n '$T_LAB' ]" 0
esperar "Contraseña incorrecta rechazada" "[ -n \"\$(token pc_ventas_01 farmaceutico1 malaclave)\" ]" 1
esperar "Inyección LDAP rechazada"        "[ -n \"\$(token pc_ventas_01 '*' x)\" ]" 1

titulo "3. RBAC"
esperar "ventas NO puede evaluar lotes (403)" \
  "[ \"\$(http_code pc_ventas_01 POST /laboratorio/lotes/LT-VAC-2026-003/evaluar $T_VEN '{\"estado\":\"APROBADO\",\"temperaturaRegistro\":5}')\" = 403 ]" 0
esperar "laboratorio NO puede vender (403)" \
  "[ \"\$(http_code pc_laboratorio_01 POST /ventas $T_LAB '{\"medicamentoId\":1,\"cantidad\":1}')\" = 403 ]" 0
esperar "almacen NO puede ver ventas (403)" \
  "[ \"\$(http_code pc_almacen_01 GET /ventas $T_ALM)\" = 403 ]" 0
esperar "Sin token -> 401" \
  "[ \"\$(http_code pc_ventas_01 GET /inventario/medicamentos x)\" = 401 ]" 0

titulo "4. Trazabilidad (lotes)"
esperar "Venta de medicamento con lote APROBADO (id 1) -> 201" \
  "[ \"\$(http_code pc_ventas_01 POST /ventas $T_VEN '{\"medicamentoId\":1,\"cantidad\":1}')\" = 201 ]" 0
esperar "Venta de vacuna con lote PENDIENTE (id 4) -> 422" \
  "[ \"\$(http_code pc_ventas_01 POST /ventas $T_VEN '{\"medicamentoId\":4,\"cantidad\":1}')\" = 422 ]" 0
esperar "Venta con stock insuficiente -> 422" \
  "[ \"\$(http_code pc_ventas_01 POST /ventas $T_VEN '{\"medicamentoId\":3,\"cantidad\":9999}')\" = 422 ]" 0

printf '\nResultado: \033[32m%d correctas\033[0m, \033[31m%d fallidas\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
