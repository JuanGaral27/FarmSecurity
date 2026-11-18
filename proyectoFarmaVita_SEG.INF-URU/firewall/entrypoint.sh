#!/bin/sh
set -e

echo "[fw-01] Habilitando reenvío IPv4..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
echo "[fw-01] ip_forward = $(cat /proc/sys/net/ipv4/ip_forward)"

echo "[fw-01] Interfaces detectadas:"
ip -br addr show | grep -v '^lo'

echo "[fw-01] Validando /etc/nftables.conf..."
nft -c -f /etc/nftables.conf

echo "[fw-01] Cargando reglas nftables..."
nft -f /etc/nftables.conf
nft list ruleset

echo "[fw-01] Firewall operativo. Política forward: DROP."
trap 'echo "[fw-01] Deteniendo"; exit 0' TERM INT
while true; do sleep 3600 & wait $!; done
