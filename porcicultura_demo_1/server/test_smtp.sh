#!/bin/bash
# Test de flujo completo: JEV → aprobación → PDF → email real
set -e

BASE="http://127.0.0.1:3005"

echo "=== 1. Crear caso ==="
CASE_RESP=$(curl -sf -X POST "$BASE/api/cases" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Test SMTP Live","granja":"Granja Prueba","fase":"Levante","viaPreferida":"Agua","desafio":"Digestivo","animalesTratar":100,"emailCliente":"business@poultryia.com","pesoPromedio":25,"edadDias":60}')

echo "$CASE_RESP"
CASE_ID=$(echo "$CASE_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "  ID: $CASE_ID"

echo ""
echo "=== 2. Aprobar caso ==="
curl -sf -X POST "$BASE/api/cases/$CASE_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"veterinarianName":"Veterinario BioARA","viaAprobada":"Agua","dosisAprobada":"150 g/1000L","diasAprobados":7,"observaciones":"Prueba SMTP real desde servidor"}'
echo ""

echo ""
echo "=== 3. Generar PDF ==="
curl -sf -X POST "$BASE/api/cases/$CASE_ID/render-pdf" \
  -H "Content-Type: application/json"
echo ""

echo ""
echo "=== 4. Enviar correo REAL ==="
EMAIL_RESP=$(curl -sf -X POST "$BASE/api/cases/$CASE_ID/send-email" \
  -H "Content-Type: application/json")
echo "$EMAIL_RESP"

echo ""
echo "=== RESULTADO ==="
if echo "$EMAIL_RESP" | grep -q '"provider":"smtp"'; then
  echo "CORREO_SMTP_ENVIADO_OK"
elif echo "$EMAIL_RESP" | grep -q '"provider":"dry_run"'; then
  echo "CORREO_DRY_RUN — SMTP_PASS no activo"
else
  echo "RESULTADO_DESCONOCIDO"
fi
