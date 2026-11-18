# ---------- Etapa 1: compilación del frontend React + Vite ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Etapa 2: proxy inverso Nginx (DMZ) ----------
FROM nginx:1.27-alpine
RUN apk add --no-cache iproute2 \
 && rm -f /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/intranet.farmaceutica.local.conf /etc/nginx/conf.d/intranet.farmaceutica.local.conf
COPY nginx/proxy_headers.inc /etc/nginx/conf.d/proxy_headers.inc
COPY oficina/net-init.sh /usr/local/bin/net-init.sh
COPY nginx/entrypoint-proxy.sh /usr/local/bin/entrypoint-proxy.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod +x /usr/local/bin/net-init.sh /usr/local/bin/entrypoint-proxy.sh

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint-proxy.sh"]
