#!/usr/bin/env bash
# deploy_demo1.sh — Frontend + Backend + Nginx + PM2
# Uso: bash PORCICULTURA/porcicultura_demo_1/scripts/deploy_demo1.sh
# Ejecutar desde la raíz del repo.

set -euo pipefail

REMOTE_USER="jleyton"
REMOTE_HOST="72.60.171.123"
SERVER="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS="-p 5522 -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15"
SCP_OPTS="-P 5522 -o StrictHostKeyChecking=no -o ConnectTimeout=30"
DEMO_SRC="$(cd "$(dirname "$0")/.." && pwd)"
# Rutas absolutas en el servidor remoto (expandidas localmente y enviadas por heredoc)
NODE_BIN="/home/jleyton/.nvm/versions/node/v22.21.0/bin/node"
NPM_BIN="/home/jleyton/.nvm/versions/node/v22.21.0/bin/npm"
PM2_BIN="/usr/bin/pm2"
REMOTE_PATH="/var/www/poultryia.com/porcicultura-demo-1"
NGINX_SNIPPET="/etc/nginx/snippets/poultryia-api.conf"
BACKEND_PORT="3005"
PM2_NAME="porc-demo1-api"

echo "=== Porcicultura Demo 1 — Deploy completo (frontend + backend) ==="

# ─────────────────────────────────────────────
# 1. Subir archivos (frontend + backend)
# ─────────────────────────────────────────────
echo ""
echo "[1/4] Subiendo archivos al servidor..."

TEMP_DIR="/home/${REMOTE_USER}/porc_demo1_temp"

rsync -avz --checksum --delete \
    --exclude='apps-script/' \
    --exclude='.clasp.json' \
    --exclude='setup.ps1' \
    --exclude='scripts/' \
    --exclude='.git/' \
    --exclude='server/node_modules/' \
    --exclude='server/storage/' \
    -e "ssh ${SSH_OPTS}" \
    "${DEMO_SRC}/" \
    "${SERVER}:${TEMP_DIR}/"

# ─────────────────────────────────────────────
# 2. Instalar, mover archivos y configurar nginx
# ─────────────────────────────────────────────
echo ""
echo "[2/4] Instalando en el servidor..."

ssh ${SSH_OPTS} "${SERVER}" bash -s << REMOTE
set -euo pipefail

# Mover frontend al directorio web
sudo mkdir -p "${REMOTE_PATH}"
sudo rsync -av --delete \
    --exclude='server/' \
    "${TEMP_DIR}/" "${REMOTE_PATH}/"
sudo chown -R www-data:www-data "${REMOTE_PATH}"
sudo chmod -R 755 "${REMOTE_PATH}"

# Mover backend (mantiene storage persistente si ya existe)
sudo mkdir -p "${REMOTE_PATH}/server"
sudo rsync -av --delete \
    --exclude='node_modules/' \
    --exclude='storage/' \
    "${TEMP_DIR}/server/" "${REMOTE_PATH}/server/"
sudo chown -R jleyton:jleyton "${REMOTE_PATH}/server"

rm -rf "${TEMP_DIR}"
echo "  Archivos instalados"

# Instalar dependencias Node del backend (PATH incluye nvm para que npm encuentre node)
cd "${REMOTE_PATH}/server"
export PATH="${NODE_BIN%/node}:${PATH}"
"${NPM_BIN}" install --omit=dev --quiet 2>&1 | tail -3
echo "  Dependencias del backend instaladas"

# Crear .env de producción si no existe
if [ ! -f "${REMOTE_PATH}/server/.env" ]; then
    cat > "${REMOTE_PATH}/server/.env" << 'ENVFILE'
PORT=3005
HOST=127.0.0.1
APP_NAME=Porcicultura BioARA API
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=business@poultryia.com
SMTP_PASS=
SMTP_FROM=business@poultryia.com
EMAIL_TO_DEFAULT=business@poultryia.com
DATA_DIR=/var/www/poultryia.com/porcicultura-demo-1/server/storage
LOG_LEVEL=info
NODE_ENV=production
ENVFILE
    echo "  .env de producción creado (falta SMTP_PASS)"
else
    echo "  .env ya existe, se conserva"
fi

# Crear directorio de storage
mkdir -p "${REMOTE_PATH}/server/storage/generated-pdfs"

# Agregar location block frontend si no existe
if ! grep -q "porcicultura-demo-1" "${NGINX_SNIPPET}" 2>/dev/null; then
    sudo tee -a "${NGINX_SNIPPET}" > /dev/null << 'NGINXFRONT'

# Porcicultura Demo 1 — frontend SPA
location /porcicultura-demo-1/ {
    alias /var/www/poultryia.com/porcicultura-demo-1/;
    try_files \$uri \$uri/ /porcicultura-demo-1/index.html;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    expires off;
}
NGINXFRONT
    echo "  Bloque frontend nginx agregado"
else
    echo "  Bloque frontend nginx ya existe"
fi

# Agregar location block del backend API si no existe
if ! grep -q "api/porc" "${NGINX_SNIPPET}" 2>/dev/null; then
    sudo tee -a "${NGINX_SNIPPET}" > /dev/null << 'NGINXAPI'

# Porcicultura Demo 1 — backend API
location /api/porc/ {
    proxy_pass http://127.0.0.1:3005/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 30s;
    proxy_connect_timeout 5s;
}
NGINXAPI
    echo "  Bloque API nginx agregado"
else
    echo "  Bloque API nginx ya existe"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "  Nginx recargado"
REMOTE

# ─────────────────────────────────────────────
# 3. Arrancar / recargar backend con PM2
# ─────────────────────────────────────────────
echo ""
echo "[3/4] Iniciando backend con PM2..."

ssh ${SSH_OPTS} "${SERVER}" bash -s << REMOTE
set -euo pipefail

cd "${REMOTE_PATH}/server"

if "${PM2_BIN}" list | grep -q "${PM2_NAME}"; then
    "${PM2_BIN}" reload "${PM2_NAME}" --update-env
    echo "  PM2: ${PM2_NAME} recargado"
else
    "${PM2_BIN}" start server.js \
        --name "${PM2_NAME}" \
        --interpreter "${NODE_BIN}" \
        --env production \
        --log "/var/log/porc-demo1-api.log" \
        --error "/var/log/porc-demo1-api.error.log"
    "${PM2_BIN}" save --force
    echo "  PM2: ${PM2_NAME} arrancado"
fi

# Esperar a que el proceso quede activo
sleep 3

# Verificar proceso vivo
"${PM2_BIN}" list | grep "${PM2_NAME}" | head -1 || true

# Verificar respuesta interna
HEALTH="\$(curl -sf http://127.0.0.1:${BACKEND_PORT}/api/health || echo 'FAIL')"
if echo "\$HEALTH" | grep -q '"ok":true'; then
    echo "  Backend responde OK: \$HEALTH"
else
    echo "  ADVERTENCIA: backend no responde todavía: \$HEALTH"
fi
REMOTE

# ─────────────────────────────────────────────
# 4. Verificación final
# ─────────────────────────────────────────────
echo ""
echo "[4/4] Verificación final..."
sleep 3

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L "https://poultryia.com/porcicultura-demo-1/")
HEALTH_API=$(curl -sf "https://poultryia.com/api/porc/health" 2>/dev/null || echo "SIN_RESPUESTA")
TOKEN_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "https://poultryia.com/porcicultura-demo-1/?t=porc2026-EvalDemo-x7K9mQz")

echo "  Frontend (sin token):         HTTP ${HTTP}"
echo "  Backend /api/porc/health:     ${HEALTH_API}"
echo "  Frontend (con token válido):  HTTP ${TOKEN_PAGE}"

echo ""
echo "════════════════════════════════════════════════════"
echo " DEPLOY COMPLETADO"
echo " Frontend: https://poultryia.com/porcicultura-demo-1/?t=porc2026-EvalDemo-x7K9mQz"
echo " Backend health: https://poultryia.com/api/porc/health"
echo ""
echo " SIGUIENTE PASO: Configurar SMTP_PASS en el servidor"
echo "  ssh -p 5522 jleyton@72.60.171.123"
echo "  nano /var/www/poultryia.com/porcicultura-demo-1/server/.env"
echo "  pm2 reload ${PM2_NAME}"
echo "════════════════════════════════════════════════════"

