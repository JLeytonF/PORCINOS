# Porcicultura Hostinger Backend — ejecución real

Este backend está construido para reemplazar la lógica demo local por un flujo serio de negocio usando el hosting de PoultryIA.

## Objetivo

- almacenar casos en persistencia real
- validar caso con metodología JEV
- bloquear aprobaciones incompletas
- generar PDF desde snapshot aprobado
- enviar correo desde Hostinger/SMTP real
- registrar auditoría completa

## Estructura

```text
server/
  server.js
  package.json
  .env.example
  storage/
    cases.json
    audit.json
    generated-pdfs/
  README_HOSTINGER_EXECUTION.md
```

## Instalación

```bash
cd PORCICULTURA/porcicultura_demo_1/server
npm install
cp .env.example .env
```

## Arranque

```bash
npm start
```

## Endpoints principales

### Salud

```http
GET /api/health
```

### Validar caso

```http
POST /api/cases/validate
Content-Type: application/json
```

### Crear caso

```http
POST /api/cases
Content-Type: application/json
```

### Aprobar caso

```http
POST /api/cases/:id/approve
Content-Type: application/json
```

### Generar PDF final

```http
POST /api/cases/:id/render-pdf
Content-Type: application/json
```

### Enviar correo real

```http
POST /api/cases/:id/send-email
Content-Type: application/json
```

## Variables SMTP requeridas

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=business@poultryia.com
SMTP_PASS=***
SMTP_FROM=business@poultryia.com
```

## Proceso JEV

Este backend arma automáticamente:

- Justificación del caso
- Evidencia del caso
- Verificación de coherencia
- Bloqueo de aprobación incompleta
- Snapshot aprobado
- PDF final
- Email real

## Nota de producción

Este backend está pensado para desplegarse en Hostinger, en el mismo entorno del dominio PoultryIA, con SMTP real y almacenamiento persistente.

No usa Azure ni mailto.
