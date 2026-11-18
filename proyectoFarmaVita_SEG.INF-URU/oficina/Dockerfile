# Estación de trabajo simulada (Ventas / Administración / Laboratorio)
FROM alpine:3.20

RUN apk add --no-cache bash curl jq iproute2 iputils bind-tools netcat-openbsd \
        postgresql16-client openldap-clients nmap

COPY net-init.sh /usr/local/bin/net-init.sh
COPY pruebas_oficina.sh /usr/local/bin/pruebas_oficina.sh
RUN chmod +x /usr/local/bin/net-init.sh /usr/local/bin/pruebas_oficina.sh

CMD ["/bin/sh", "-c", "/usr/local/bin/net-init.sh && echo '[pc] Estación lista' && tail -f /dev/null"]
