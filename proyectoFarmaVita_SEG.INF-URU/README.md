# FarmaVita · proyectoFarmaVita_SEG.INF-URU

Infraestructura empresarial contenerizada para una distribuidora y laboratorio farmacéutico, diseñada con
**defensa en profundidad**, **microsegmentación (Zero Trust interno)**, **RBAC** y **continuidad operativa**.

| Pilar | Implementación |
|---|---|
| Prevención de ransomware | `fw-01` (nftables, forward DROP): ninguna oficina alcanza `10.10.40.0/24`; sólo Apps → PostgreSQL TCP/5432 |
| Trazabilidad | Venta bloqueada (422) si el medicamento no tiene un lote **APROBADO**; descuento de stock con `pessimistic_write` |
| Continuidad | UPS 20 kVA doble conversión + generador diésel 80 kVA con ATS, 72 h (ver `docs/informe_farmavita.pdf`) |

## Requisitos

- Docker Engine 24+ con Docker Compose v2 (Linux, o Docker Desktop en Windows/macOS)
- ~3 GB libres (imágenes de compilación de Node y Rust)

## Puesta en marcha

```bash
unzip proyectoFarmaVita_SEG.INF-URU.zip
cd proyectoFarmaVita_SEG.INF-URU
docker compose up -d --build          # o: docker-compose up -d --build
docker compose ps
docker logs fw-01                     # reglas nftables cargadas
docker logs farma_backend             # "API FarmaVita escuchando en :3000" y datos semilla
```

La primera compilación tarda varios minutos (frontend, backend y binario Rust). OpenLDAP necesita ~10 s
para cargar el LDIF la primera vez; si un login devuelve 503 justo al arrancar, espere unos segundos.

### Intranet web

El proxy de la DMZ se publica en el puerto **8080** del anfitrión:

- http://localhost:8080
- o añada `127.0.0.1 intranet.farmaceutica.local` a su archivo `hosts` y abra http://intranet.farmaceutica.local:8080

Cualquier otro `Host` recibe un cierre de conexión (444).

### Terminal de almacén (TUI en Rust)

```bash
docker exec -it pc_almacen_01 terminal_almacen
```

Inicie sesión con `almacenista1 / password_almacen_123`. Teclas: `↑↓` mover, `i`/`Enter` registrar ingreso,
`r` actualizar (además se refresca cada 5 s), `l` cerrar sesión, `q` salir. Sólo el rol `almacen` puede operar
esta terminal. El cliente contacta con `10.10.20.10` enviando `Host: intranet.farmaceutica.local`.

## Credenciales (LDAP `dc=farmaceutica,dc=local`)

| Usuario | Contraseña | VLAN | Rol |
|---|---|---|---|
| almacenista1 | password_almacen_123 | 210 | almacen |
| farmaceutico1 | password_ventas_123 | 220 | ventas |
| laboratorista1 | password_lab_123 | 240 | laboratorio |
| admin1 | password_admin_123 | 230 | admin (añadido para que la VLAN 230 tenga un usuario; solo lectura/auditoría) |

Administrador del directorio: `cn=admin,dc=farmaceutica,dc=local` / `admin_ldap_farma`.

## Arquitectura de red

| VLAN | Red Docker | Subred | Gateway (fw-01) | Hosts |
|---|---|---|---|---|
| 20 | red_dmz | 10.10.20.0/24 | .254 | farma_proxy 10.10.20.10 (Nginx + React) |
| 30 | red_apps | 10.10.30.0/24 | .254 | farma_backend .20 (NestJS), farma_ldap .30 |
| 40 | red_datos | 10.10.40.0/24 | .254 | farma_db 10.10.40.10 (PostgreSQL 16) |
| 210 | vlan210_almacen | 10.10.210.0/24 | .254 | pc_almacen_01 .10 (TUI Rust) |
| 220 | vlan220_ventas | 10.10.220.0/24 | .254 | pc_ventas_01 .10 |
| 230 | vlan230_admin | 10.10.230.0/24 | .254 | pc_admin_01 .10 |
| 240 | vlan240_laboratorio | 10.10.240.0/24 | .254 | pc_laboratorio_01 .10 |

Las PCs no publican puertos y su ruta por defecto apunta a `fw-01`. El proxy y la API tienen rutas estáticas
hacia la siguiente zona vía `fw-01`, de modo que **todo** flujo entre segmentos atraviesa el firewall.

### Reglas del firewall (`firewall/nftables.conf`)

`forward` con política **DROP**, en este orden:

1. `ct state established,related accept` · `ct state invalid drop`
2. Oficinas (210–240) → Datos: **drop** (incluido ICMP)
3. Oficinas → DMZ/Apps: ICMP echo-request **accept**
4. Oficinas → DMZ y Apps: **accept**
5. Proxy 10.10.20.10 → API 10.10.30.20 TCP/3000: **accept**
6. Apps → 10.10.40.10 TCP/5432: **accept**

NAT `postrouting`: masquerade de las oficinas por `eth*` (requisito) y, además, de DMZ→Apps y Apps→Datos para
garantizar retorno simétrico con la pasarela Docker por defecto de los servidores.

> Nota: las reglas 5 y la parte de NAT interno no estaban en la especificación original, pero son necesarias para
> que el proxy de la DMZ pueda alcanzar la API a través del firewall. Como efecto del masquerade, Nginx ve como
> origen la IP del firewall (10.10.20.254) en lugar de la de cada PC; la limitación de tasa del login es, por tanto,
> compartida entre oficinas (30/min, ráfaga 20).

## API REST (prefijo `/api` en el proxy)

| Método | Ruta | Roles |
|---|---|---|
| POST | /auth/login | público (bind LDAP) |
| GET | /auth/perfil | autenticado |
| GET | /inventario/medicamentos[/:id] | almacen, ventas, laboratorio, admin |
| POST | /inventario/medicamentos | almacen |
| POST | /inventario/medicamentos/:id/ingreso | almacen |
| GET | /laboratorio/lotes | laboratorio, almacen, admin |
| POST | /laboratorio/lotes/:codigoLote/evaluar | laboratorio |
| POST | /ventas | ventas |
| GET | /ventas | ventas, admin |
| GET | /health | público |

Reglas de negocio:

- Alta de medicamento o ingreso con un **lote nuevo** → el lote queda `PENDIENTE` (cuarentena).
- Evaluar como `APROBADO` con temperatura fuera de rango (2–8 °C en cadena de frío; ≤ máximo en el resto) → 400 *excursión térmica*.
- Venta sin lote `APROBADO` → 422 `LOTE_NO_APROBADO`. Stock insuficiente → 422 `STOCK_INSUFICIENTE`.
- Venta y reabastecimiento usan transacción + `SELECT … FOR UPDATE` (`pessimistic_write`).

Datos semilla: Acetaminofén, Amoxicilina, Insulina (APROBADOS), Vacuna antitetánica (PENDIENTE) e
Ibuprofeno (RECHAZADO), útiles para demostrar el bloqueo de ventas.

## Pruebas

```bash
# Desde el anfitrión: batería completa (red, LDAP, RBAC, trazabilidad)
./scripts/pruebas_seguridad.sh

# Desde una oficina concreta
docker exec pc_ventas_01 pruebas_oficina.sh farmaceutico1 password_ventas_123

# Demostración manual de aislamiento
docker exec pc_ventas_01 ping -c2 10.10.40.10            # sin respuesta
docker exec pc_ventas_01 psql -h 10.10.40.10 -U postgres  # timeout
docker exec fw-01 nft list ruleset                        # contadores por regla
```

## Estructura

```
.
├── .env                         Variables de entorno
├── docker-compose.yml           9 servicios, 7 redes
├── firewall/                    Alpine + nftables (fw-01)
├── nginx/                       Proxy inverso DMZ + compilación del frontend
├── ldap/bootstrap/              LDIF: ou=usuarios, ou=grupos, usuarios y grupos
├── db/init/                     Endurecimiento PostgreSQL + esquema de auditoría
├── backend/                     NestJS + TypeORM (auth, inventory, laboratorio, ventas)
├── frontend/                    React + Vite + TypeScript
├── terminal_almacen/            Cliente TUI Rust (ratatui + ureq), binario estático musl
├── oficina/                     Imagen de estación de trabajo y pruebas
├── scripts/pruebas_seguridad.sh Batería de pruebas desde el anfitrión
└── docs/                        informe_farmavita.tex (+ PDF compilado)
```

## Reinicio limpio

```bash
docker compose down -v      # elimina contenedores y volúmenes (BD y LDAP se regeneran)
docker compose up -d --build
```

## Notas para producción

Las contraseñas de `.env` y del LDIF son de laboratorio académico: cámbielas, active LDAPS/TLS en OpenLDAP,
sirva la intranet por HTTPS y guarde `JWT_SECRET` en un gestor de secretos.
