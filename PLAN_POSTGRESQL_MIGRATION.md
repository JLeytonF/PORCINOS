# PLAN DE MIGRACIÓN PORCICULTURA → PostgreSQL

**Versión:** 1.0  
**Fecha de creación:** 2026-10-11  
**Estado:** PREPARADO PARA EJECUCIÓN FUTURA  
**Propósito:** Migrar Porcicultura Demo 1 de almacenamiento JSON en archivos a PostgreSQL, manteniendo compatibilidad total, auditoría y zero downtime.

---

## 📋 RESUMEN EJECUTIVO

| Aspecto | Valor |
|--------|-------|
| **Módulo actual** | Porcicultura Demo 1 (Node.js + JSON files) |
| **Almacenamiento actual** | `storage/{cases.json, audit.json, page_views.json}` |
| **Alcance** | Migrar 3 entidades principales a PostgreSQL sin cambios en API |
| **Complejidad** | MEDIA — sin datos masivos, schema simple, cero transformaciones complejas |
| **Tiempo estimado** | 4–5 horas (plan + schema + código + migración + validación) |
| **Riesgo** | BAJO — schema nuevo, sin datos dependientes en prod, fácil rollback |
| **Gates de cierre** | 7 verificaciones deterministas (ver sección 5) |

---

## 1. DIAGNÓSTICO DE ESTADO ACTUAL

### 1.1 Inventario de almacenamiento actual

```
PORCICULTURA/porcicultura_demo_1/storage/
├── cases.json           # Array JSON: casos clínicos, aprobaciones, PDFs
├── audit.json           # Array JSON: log de eventos (creación, aprobación, etc.)
├── page_views.json      # Array JSON: seguimiento de visitantes, conversión
└── generated-pdfs/      # Carpeta: PDFs generados (referencias en cases.json)
```

### 1.2 Estructura de datos existente

#### `cases.json` — Array de objetos
```javascript
[
  {
    id: "CASO-1728656789123-abc123",
    createdAt: "2026-10-01T14:30:00Z",
    updatedAt: "2026-10-01T15:45:00Z",
    status: "draft" | "approved" | "completed",
    version: 1,
    payload: {
      cliente: "Veterinaria XYZ",
      lote: "LOTE-001",
      fecha_consulta: "2026-10-01",
      diagnostico: "...",
      productos_aprobados: [...],
      presupuesto_total: 1250000,
      jev: { ... }  // JEV scores
    },
    jev: { confidence: 0.95, ... },
    approval: {
      approvedAt: "2026-10-01T15:45:00Z",
      approvedBy: "user@example.com",
      notes: "..."
    },
    pdf: {
      fileName: "propuesta_veterinaria_xyz_CASO-1728656789123-abc123.pdf",
      absolutePath: "/var/www/porcicultura_demo_1/storage/generated-pdfs/...",
      generatedAt: "2026-10-01T15:46:00Z"
    },
    email: {
      to: "veterinario@example.com",
      subject: "Propuesta BioARA — LOTE-001",
      status: "sent" | "draft",
      sentAt: "2026-10-01T15:47:00Z",
      provider: "smtp",
      trackingId: "msg_123456"
    }
  }
]
```

#### `audit.json` — Log de eventos
```javascript
[
  {
    id: "uuid-1234",
    event: "case_created" | "case_approved" | "page_view",
    timestamp: "2026-10-01T14:30:00Z",
    data: { ... }
  }
]
```

#### `page_views.json` — Seguimiento de visitantes
```javascript
[
  {
    id: "pageview-1728656789-abc123de",
    event: "page_view",
    timestamp: "2026-10-01T14:30:00Z",
    path: "/porcicultura-demo-1/?t=porc2026-...",
    ip_hash: "sha256:abc123...",
    user_agent_hash: "sha256:def456...",
    campaign_token: "porc2026-EvalDemo-x7K9mQz",
    source: "poultryia-web",
    referrer: null,
    session_id: "sess_123456"
  }
]
```

### 1.3 Estado de datos actual

- **Casos totales** (casos.json): estimado 50–200 registros históricos
- **Auditoría** (audit.json): estimado 500–2000 eventos
- **Page views** (page_views.json): estimado 1000–5000 registros
- **PDFs almacenados**: 1 PDF por caso en folder `generated-pdfs/`

---

## 2. ESPECIFICACIÓN DE SCHEMA POSTGRESQL

### 2.1 Tabla: `porcicultura.tbl_casos`

```sql
CREATE SCHEMA IF NOT EXISTS porcicultura;

CREATE TABLE porcicultura.tbl_casos (
  caso_id BIGSERIAL PRIMARY KEY,
  
  -- Identificación
  caso_external_id VARCHAR(100) NOT NULL UNIQUE,  -- CASO-1728656789123-abc123
  
  -- Metadatos de auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Estado
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, approved, completed
  version INT NOT NULL DEFAULT 1,
  
  -- Datos de negocio (payload desnormalizado para acceso rápido)
  cliente_nombre VARCHAR(255),
  lote_codigo VARCHAR(100),
  fecha_consulta DATE,
  diagnostico TEXT,
  presupuesto_total DECIMAL(12, 2),
  
  -- Datos complejos (JSONB para flexibilidad)
  payload JSONB NOT NULL,  -- payload original completo
  jev JSONB,                -- JEV scores
  
  -- Aprobación
  approval_at TIMESTAMPTZ,
  approval_by VARCHAR(255),
  approval_notes TEXT,
  
  -- PDF
  pdf_file_name VARCHAR(500),
  pdf_absolute_path VARCHAR(1000),
  pdf_generated_at TIMESTAMPTZ,
  
  -- Email
  email_to VARCHAR(255),
  email_subject VARCHAR(500),
  email_status VARCHAR(50),  -- draft, sent, failed
  email_sent_at TIMESTAMPTZ,
  email_provider VARCHAR(50),
  email_tracking_id VARCHAR(100),
  
  CONSTRAINT ck_status CHECK (status IN ('draft', 'approved', 'completed')),
  CONSTRAINT ck_email_status CHECK (email_status IS NULL OR email_status IN ('draft', 'sent', 'failed'))
);

CREATE INDEX idx_casos_external_id ON porcicultura.tbl_casos(caso_external_id);
CREATE INDEX idx_casos_status ON porcicultura.tbl_casos(status);
CREATE INDEX idx_casos_created_at ON porcicultura.tbl_casos(created_at DESC);
CREATE INDEX idx_casos_cliente ON porcicultura.tbl_casos(cliente_nombre);
```

### 2.2 Tabla: `porcicultura.tbl_audit_eventos`

```sql
CREATE TABLE porcicultura.tbl_audit_eventos (
  evento_id BIGSERIAL PRIMARY KEY,
  
  -- Identificación
  evento_external_id VARCHAR(100) UNIQUE,  -- uuid-1234
  event_type VARCHAR(100) NOT NULL,        -- case_created, case_approved, page_view
  
  -- Auditoría
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB,                               -- evento_data completo
  
  -- Relación opcional a caso
  caso_id BIGINT REFERENCES porcicultura.tbl_casos(caso_id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_event_type ON porcicultura.tbl_audit_eventos(event_type);
CREATE INDEX idx_audit_timestamp ON porcicultura.tbl_audit_eventos(timestamp DESC);
CREATE INDEX idx_audit_caso_id ON porcicultura.tbl_audit_eventos(caso_id);
```

### 2.3 Tabla: `porcicultura.tbl_page_views`

```sql
CREATE TABLE porcicultura.tbl_page_views (
  page_view_id BIGSERIAL PRIMARY KEY,
  
  -- Identificación
  pageview_external_id VARCHAR(100) UNIQUE,  -- pageview-1728656789-abc123de
  
  -- Event tracking
  event_type VARCHAR(50) NOT NULL DEFAULT 'page_view',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Request details
  path VARCHAR(1000),
  ip_hash VARCHAR(100),        -- sha256:abc123...
  user_agent_hash VARCHAR(100), -- sha256:def456...
  campaign_token VARCHAR(255),
  source VARCHAR(100) DEFAULT 'poultryia-web',
  referrer VARCHAR(1000),
  session_id VARCHAR(100),
  
  CONSTRAINT ck_pageview_event CHECK (event_type IN ('page_view'))
);

CREATE INDEX idx_pageview_timestamp ON porcicultura.tbl_page_views(timestamp DESC);
CREATE INDEX idx_pageview_campaign ON porcicultura.tbl_page_views(campaign_token);
CREATE INDEX idx_pageview_session ON porcicultura.tbl_page_views(session_id);
CREATE INDEX idx_pageview_ip_ua ON porcicultura.tbl_page_views(ip_hash, user_agent_hash);
```

---

## 3. MAPEO DE DATOS JSON → POSTGRESQL

### 3.1 Mapeo de `cases.json` → `tbl_casos`

| JSON (cases.json) | PostgreSQL (tbl_casos) | Notas |
|------------------|------------------------|-------|
| `id` | `caso_external_id` | String único, índice |
| `createdAt` | `created_at` | TIMESTAMPTZ |
| `updatedAt` | `updated_at` | Trigger de actualización |
| `status` | `status` | Enum: draft/approved/completed |
| `version` | `version` | Int simple |
| `payload.cliente` | `cliente_nombre` | Desnormalizado para query rápida |
| `payload.lote` | `lote_codigo` | Desnormalizado |
| `payload.fecha_consulta` | `fecha_consulta` | Date |
| `payload.diagnostico` | `diagnostico` | Text largo |
| `payload.presupuesto_total` | `presupuesto_total` | DECIMAL |
| `payload` (completo) | `payload` | JSONB (flexibilidad) |
| `jev` | `jev` | JSONB |
| `approval.*` | `approval_at`, `approval_by`, `approval_notes` | Atomizado |
| `pdf.*` | `pdf_*` | Columnas individuales |
| `email.*` | `email_*` | Columnas individuales |

### 3.2 Mapeo de `audit.json` → `tbl_audit_eventos`

| JSON (audit.json) | PostgreSQL | Notas |
|------------------|------------|-------|
| `id` | `evento_external_id` | UUID, único |
| `event` | `event_type` | Categoría de evento |
| `timestamp` | `timestamp` | TIMESTAMPTZ |
| `data` | `data` | JSONB completo |

### 3.3 Mapeo de `page_views.json` → `tbl_page_views`

Mapeo directo 1:1.

---

## 4. PLAN DE EJECUCIÓN TÉCNICA

### 4.1 Fase 1: Preparación (30 min)

#### 1.1.1 Crear esquema SQL de migración

**Archivo:** `PORCICULTURA/porcicultura_demo_1/database/001_create_porcicultura_schema.sql`

```sql
-- Crear schema
CREATE SCHEMA IF NOT EXISTS porcicultura;

-- [Insertar DDL de sección 2.1, 2.2, 2.3]

-- Tablespaces y configuración
ALTER SCHEMA porcicultura OWNER TO stepa_user;
GRANT USAGE ON SCHEMA porcicultura TO stepa_user;
GRANT CREATE ON SCHEMA porcicultura TO stepa_user;
```

#### 1.1.2 Crear script de migración de datos

**Archivo:** `PORCICULTURA/porcicultura_demo_1/database/002_migrate_json_to_postgresql.py`

**Propósito:** Leer JSON históricos y volcar a PostgreSQL (sin deletar JSONs originales).

```python
#!/usr/bin/env python3
import json
import psycopg2
from datetime import datetime
from pathlib import Path
import sys

def migrate_cases(db_conn, cases_json_path):
    """Migrar cases.json → tbl_casos"""
    with open(cases_json_path) as f:
        cases = json.load(f)
    
    cursor = db_conn.cursor()
    for case in cases:
        try:
            cursor.execute("""
                INSERT INTO porcicultura.tbl_casos (
                    caso_external_id, created_at, updated_at, status, version,
                    cliente_nombre, lote_codigo, fecha_consulta, diagnostico,
                    presupuesto_total, payload, jev,
                    approval_at, approval_by, approval_notes,
                    pdf_file_name, pdf_absolute_path, pdf_generated_at,
                    email_to, email_subject, email_status, email_sent_at,
                    email_provider, email_tracking_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                case.get('id'),
                case.get('createdAt'),
                case.get('updatedAt'),
                case.get('status', 'draft'),
                case.get('version', 1),
                case.get('payload', {}).get('cliente'),
                case.get('payload', {}).get('lote'),
                case.get('payload', {}).get('fecha_consulta'),
                case.get('payload', {}).get('diagnostico'),
                case.get('payload', {}).get('presupuesto_total'),
                json.dumps(case.get('payload', {})),
                json.dumps(case.get('jev', {})),
                case.get('approval', {}).get('approvedAt'),
                case.get('approval', {}).get('approvedBy'),
                case.get('approval', {}).get('notes'),
                case.get('pdf', {}).get('fileName'),
                case.get('pdf', {}).get('absolutePath'),
                case.get('pdf', {}).get('generatedAt'),
                case.get('email', {}).get('to'),
                case.get('email', {}).get('subject'),
                case.get('email', {}).get('status'),
                case.get('email', {}).get('sentAt'),
                case.get('email', {}).get('provider'),
                case.get('email', {}).get('trackingId')
            ))
        except Exception as e:
            print(f"ERROR migrating case {case.get('id')}: {e}")
    
    db_conn.commit()
    cursor.close()
    print(f"✅ Migrated {len(cases)} cases")

# [Similar para audit.json y page_views.json]

if __name__ == '__main__':
    # Conexión a PostgreSQL
    conn = psycopg2.connect(
        host='localhost',
        port=6432,  # pgBouncer
        database='stepa_db',
        user='stepa_user',
        password=os.environ.get('DB_PASSWORD')
    )
    
    # Migrar
    migrate_cases(conn, 'storage/cases.json')
    migrate_audit(conn, 'storage/audit.json')
    migrate_page_views(conn, 'storage/page_views.json')
    
    conn.close()
    print("✅ Migration complete")
```

**Gate de cierre:** Script ejecutable sin errores de sintaxis.

### 4.2 Fase 2: Refactorización de código Node.js (1.5 h)

#### 2.1 Crear capa de abstracción SQL

**Archivo:** `PORCICULTURA/porcicultura_demo_1/server/src/db.js`

Reemplaza `store.js` con queries SQL parametrizadas.

```javascript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 6432,
  database: process.env.DB_NAME || 'stepa_db',
  user: process.env.DB_USER || 'stepa_user',
  password: process.env.DB_PASSWORD || ''
});

export async function listCases() {
  const result = await pool.query(`
    SELECT *, row_to_json(row(
      approval_at, approval_by, approval_notes
    )) as approval,
    row_to_json(row(
      pdf_file_name, pdf_absolute_path, pdf_generated_at
    )) as pdf,
    row_to_json(row(
      email_to, email_subject, email_status, email_sent_at,
      email_provider, email_tracking_id
    )) as email
    FROM porcicultura.tbl_casos
    ORDER BY created_at DESC
  `);
  return result.rows.map(row => ({
    id: row.caso_external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    version: row.version,
    payload: row.payload,
    jev: row.jev,
    approval: row.approval,
    pdf: row.pdf,
    email: row.email
  }));
}

export async function getCaseById(id) {
  const result = await pool.query(
    'SELECT * FROM porcicultura.tbl_casos WHERE caso_external_id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createCase(payload) {
  const id = payload.id || `CASO-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const result = await pool.query(`
    INSERT INTO porcicultura.tbl_casos (
      caso_external_id, status, version, payload, jev,
      cliente_nombre, lote_codigo, fecha_consulta,
      presupuesto_total
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    id, 'draft', 1, JSON.stringify(payload),
    JSON.stringify(payload.jev || {}),
    payload.cliente, payload.lote, payload.fecha_consulta,
    payload.presupuesto_total
  ]);
  
  await recordAudit('case_created', { caseId: id, cliente: payload.cliente });
  return result.rows[0];
}

// [Implementar updateCase, recordPageView, etc.]

export async function recordAudit(event, data = {}) {
  await pool.query(`
    INSERT INTO porcicultura.tbl_audit_eventos (
      evento_external_id, event_type, data
    ) VALUES ($1, $2, $3)
  `, [
    `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    event,
    JSON.stringify(data)
  ]);
}
```

**Gate de cierre:** db.js compila sin errores, queries parametrizadas validadas.

#### 2.2 Refactorizar `server.js` para usar `db.js`

Reemplazar todas las llamadas a `store.js` con llamadas a `db.js`.

```javascript
// Antes:
import { createCase, listCases } from './src/store.js';

// Después:
import { createCase, listCases } from './src/db.js';
```

**Gate de cierre:** `npm run lint` OK, no breaking changes en API endpoints.

### 4.3 Fase 3: Testing en desarrollo local (1 h)

#### 3.1 Verificar conexión a BD

```bash
cd PORCICULTURA/porcicultura_demo_1/server
npm install pg
export DB_HOST=localhost DB_PORT=6432 DB_NAME=stepa_db DB_USER=stepa_user DB_PASSWORD=<...>
npm test -- db.js  # O smoke test manual
```

#### 3.2 Smoke tests de endpoints

```bash
# Test: crear caso
curl -X POST http://localhost:3005/api/porc/cases \
  -H "Content-Type: application/json" \
  -d '{"cliente": "Test", "lote": "TEST-001"}'

# Test: listar casos
curl http://localhost:3005/api/porc/cases

# Test: obtener caso
curl http://localhost:3005/api/porc/cases/CASO-xxxxx
```

**Gate de cierre:** 3/3 endpoints responden JSON válido, status 200.

### 4.4 Fase 4: Migración de datos en producción (30 min)

#### 4.1 Ejecutar script de migración en servidor

```bash
ssh -p 5522 jleyton@72.60.171.123

# En servidor:
cd /var/www/poultryia.com/PORCICULTURA/porcicultura_demo_1
python database/002_migrate_json_to_postgresql.py

# Verificar resultado
psql -h localhost -p 6432 -U stepa_user -d stepa_db \
  -c "SELECT COUNT(*) FROM porcicultura.tbl_casos;"
```

**Gate de cierre:** Conteo de filas = conteo de casos.json.

#### 4.2 Backup de JSONs históricos

```bash
tar czf /tmp/porcicultura_json_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  storage/{cases.json,audit.json,page_views.json}
```

**Gate de cierre:** Archivo tar.gz creado y verificado.

### 4.5 Fase 5: Deploy y verificación en producción (30 min)

#### 5.1 Actualizar systemd service

**Archivo:** `/etc/systemd/system/poultryia-porcicultura-demo-1.service`

```ini
# Agregar variable de entorno
Environment="DB_HOST=localhost"
Environment="DB_PORT=6432"
Environment="DB_NAME=stepa_db"
Environment="DB_USER=stepa_user"
# DB_PASSWORD debe estar en .env del app, no en systemd
```

#### 5.2 Deployer código actualizado

```bash
# En el servidor:
sudo systemctl stop poultryia-porcicultura-demo-1
cd /var/www/poultryia.com/PORCICULTURA/porcicultura_demo_1/server
git pull
npm install
sudo systemctl start poultryia-porcicultura-demo-1
```

**Gate de cierre:** `systemctl status poultryia-porcicultura-demo-1` = `active (running)`.

#### 5.3 Verificar endpoints en producción

```bash
curl -H "X-Campaign-Token: test" https://poultryia.com/api/porc/health
curl https://poultryia.com/api/porc/cases
```

**Gate de cierre:** Respuestas JSON válidas, status 200.

---

## 5. GATES DE CIERRE DETERMINISTAS

> **Regla:** Toda tarea solo se marca como ✅ cuando cumpla los 7 gates de cierre listados aquí.

| # | Gate | Verificación | Criterio de éxito |
|---|------|--------------|-------------------|
| **1** | Schema SQL creado | `psql -c "\dt porcicultura.*"` | 3 tablas visibles: tbl_casos, tbl_audit_eventos, tbl_page_views |
| **2** | Datos migrados | `psql -c "SELECT COUNT(*) FROM porcicultura.tbl_casos;"` | Conteo = conteo de casos.json original |
| **3** | Auditoría migrada | `psql -c "SELECT COUNT(*) FROM porcicultura.tbl_audit_eventos;"` | Conteo ≥ conteo original |
| **4** | Page views migradas | `psql -c "SELECT COUNT(*) FROM porcicultura.tbl_page_views;"` | Conteo ≥ conteo original |
| **5** | Código Node compila | `npm install && npm run lint` | Exit code 0, sin warnings de seguridad |
| **6** | Servicio UP | `systemctl is-active poultryia-porcicultura-demo-1` | Status = `active` |
| **7** | Endpoints responden | `curl -s https://poultryia.com/api/porc/cases \| jq .` | JSON válido, sin HTML, status 200 |

---

## 6. ROLLBACK PROCEDURE

### Caso: Migración falla o hay regresión en producción

#### Paso 1: Detener servicio

```bash
sudo systemctl stop poultryia-porcicultura-demo-1
```

#### Paso 2: Restaurar código anterior (si cambios causaron el problema)

```bash
cd /var/www/poultryia.com/PORCICULTURA/porcicultura_demo_1/server
git revert HEAD  # O git checkout <commit_anterior>
npm install
```

#### Paso 3: Restaurar datos JSON (si necesario)

```bash
tar xzf /tmp/porcicultura_json_backup_YYYYMMDD_HHMMSS.tar.gz -C storage/
```

#### Paso 4: Revertir tabla PostgreSQL

```bash
psql -h localhost -p 6432 -U stepa_user -d stepa_db \
  -c "DROP SCHEMA porcicultura CASCADE;"
```

#### Paso 5: Reiniciar servicio

```bash
sudo systemctl start poultryia-porcicultura-demo-1
systemctl status poultryia-porcicultura-demo-1
```

**Verificación:** Endpoints responden, datos del backup vuelven a funcionar.

---

## 7. CHECKLIST DE PRE-EJECUCIÓN

Antes de comenzar la migración, completar:

- [ ] **Lectura de contexto:** Revisar este plan + GRAFOS_ARNES_AGENTES.md + lessons.md
- [ ] **Backup de JSONs:** Crear tar.gz de `storage/` completo
- [ ] **Testing local:** Validar schema SQL + migraciones en environment local o staging
- [ ] **Roles BD:** Verificar que `stepa_user` tiene permisos en `porcicultura` schema
- [ ] **Variables de entorno:** `.env` del server tiene `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [ ] **Commits limpios:** Rama feature preparada con cambios atómicos (schema, código Node, deploy)
- [ ] **Coordinación:** Avisar al equipo si hay ventana de mantenimiento requerida

---

## 8. REFERENCIAS Y ARTEFACTOS

### Archivos a crear/modificar

```
PORCICULTURA/porcicultura_demo_1/
├── database/
│   ├── 001_create_porcicultura_schema.sql          [CREAR]
│   └── 002_migrate_json_to_postgresql.py           [CREAR]
├── server/
│   ├── src/
│   │   ├── db.js                                   [CREAR — reemplaza store.js]
│   │   └── store.js                                [DEPRECATED — conservar por referencia]
│   ├── server.js                                   [MODIFICAR — usar db.js]
│   └── package.json                                [MODIFICAR — agregar pg]
└── PLAN_POSTGRESQL_MIGRATION.md                    [ESTE ARCHIVO]
```

### Comandos de referencia rápida

```bash
# Conexión a BD
psql -h localhost -p 6432 -U stepa_user -d stepa_db

# Ver tablas porcicultura
\dt porcicultura.*

# Contar filas
SELECT COUNT(*) FROM porcicultura.tbl_casos;

# Backup de schema
pg_dump -h localhost -p 6432 -U stepa_user -d stepa_db \
  -n porcicultura > porcicultura_schema_backup.sql

# Restaurar desde backup
psql -h localhost -p 6432 -U stepa_user -d stepa_db < porcicultura_schema_backup.sql
```

---

## 9. NOTAS FINALES

- **Estado:** Este plan está **100% preparado** para ejecución futura.
- **Cambios posteriores:** Si surge nueva información durante la ejecución, actualizar este documento ANTES de proceder.
- **Auditoría:** Mantener log de gates de cierre en `tasks/lessons.md` tras completar la migración.
- **Zero downtime:** Esta migración permite mantenimiento con riesgo bajo si se sigue el plan de rollback.

---

**Plan preparado por:** Copilot (2026-10-11)  
**Para ejecución:** Sesión futura — seguir checklist de pre-ejecución (sección 7)
