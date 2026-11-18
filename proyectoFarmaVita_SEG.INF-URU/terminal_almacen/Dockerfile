# ---------- Etapa 1: compilación estática (musl) ----------
FROM rust:1-alpine AS build
RUN apk add --no-cache musl-dev
ENV RUSTFLAGS="-C target-feature=+crt-static"
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

# ---------- Etapa 2: estación pc_almacen_01 ----------
FROM alpine:3.20
RUN apk add --no-cache bash curl jq iproute2 iputils bind-tools netcat-openbsd \
        postgresql16-client ncurses-terminfo-base
COPY --from=build /src/target/release/terminal_almacen /usr/local/bin/terminal_almacen
COPY net-init.sh /usr/local/bin/net-init.sh
COPY pruebas_oficina.sh /usr/local/bin/pruebas_oficina.sh
RUN chmod +x /usr/local/bin/net-init.sh /usr/local/bin/pruebas_oficina.sh
ENV TERM=xterm-256color \
    LANG=C.UTF-8 \
    FARMA_API_URL=http://10.10.20.10/api \
    FARMA_HOST=intranet.farmaceutica.local

CMD ["/bin/sh", "-c", "/usr/local/bin/net-init.sh && echo '[pc_almacen_01] Lista. Ejecute: docker exec -it pc_almacen_01 terminal_almacen' && tail -f /dev/null"]
