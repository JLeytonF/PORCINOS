#!/usr/bin/env bash
# deploy_demo1.sh — Despliega porcicultura_demo_1 a https://poultryia.com/porcicultura-demo-1/
# Uso: bash PORCICULTURA/porcicultura_demo_1/scripts/deploy_demo1.sh
# (ejecutar desde la raiz del repo)

set -euo pipefail

REMOTE_USER="jleyton"
REMOTE_HOST="72.60.171.123"
SERVER="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS="-p 5522 -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15"
SCP_OPTS="-P 5522 -o StrictHostKeyChecking=no -o ConnectTimeout=30"
DEMO_SRC="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_DIR="/home/${REMOTE_USER}/porc_demo1_temp"
REMOTE_PATH="/var/www/poultryia.com/porcicultura-demo-1"
NGINX_SNIPPET="/etc/nginx/snippets/poultryia-api.conf"

echo "=== Porcicultura Demo 1 — Deploy a poultryia.com ==="

# Subir via rsync a carpeta temp del usuario (sin sudo)
echo "[1/3] Subiendo archivos al servidor..."
rsync -avz --checksum --delete \
    --exclude='apps-script/' \
    --exclude='.clasp.json' \
    --exclude='setup.ps1' \
    --exclude='scripts/' \
    --exclude='.git/' \
    -e "ssh ${SSH_OPTS}" \
    "${DEMO_SRC}/" \
    "${SERVER}:${TEMP_DIR}/"

# SSH con -t para permitir sudo interactivo
echo "[2/3] Instalando y configurando Nginx..."
ssh ${SSH_OPTS} -t "${SERVER}" bash -s << REMOTE
set -euo pipefail

# Mover a directorio web
sudo mkdir -p "${REMOTE_PATH}"
sudo rsync -av --delete "${TEMP_DIR}/" "${REMOTE_PATH}/"
sudo chown -R www-data:www-data "${REMOTE_PATH}"
sudo chmod -R 755 "${REMOTE_PATH}"
rm -rf "${TEMP_DIR}"

# Agregar location block si no existe
if ! grep -q "porcicultura-demo-1" "${NGINX_SNIPPET}"; then
    sudo tee -a "${NGINX_SNIPPET}" << 'NGINX_BLOCK'

# Porcicultura Demo 1 — demo temporal evaluacion externa (noindex)
location /porcicultura-demo-1/ {
    alias /var/www/poultryia.com/porcicultura-demo-1/;
    try_files \$uri \$uri/ /porcicultura-demo-1/index.html;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-cache" always;
}
NGINX_BLOCK
    echo "  Location block agregado"
else
    echo "  Location block ya existe"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "  Nginx recargado"
REMOTE

# Verificar
echo "[3/3] Verificando acceso..."
sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L "https://poultryia.com/porcicultura-demo-1/")
echo "  HTTP (sin token): ${HTTP} — debe redirigir (200 del destino)"

echo ""
echo "================================================"
echo " DEMO OPERATIVA"
echo " URL: https://poultryia.com/porcicultura-demo-1/?t=porc2026-EvalDemo-x7K9mQz"
echo "================================================"
