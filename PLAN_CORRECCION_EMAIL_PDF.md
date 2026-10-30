# Plan de Corrección: Email y PDF — Sincronización de Contenido

**Estado:** PLANIFICACIÓN  
**Prioridad:** CRÍTICA (afecta flujo de negocio de envío de propuestas)  
**Fecha:** 2026-10-11  

---

## 🔍 Diagnóstico — Root Cause Analysis

### Problema Reportado
El correo enviado contiene información **genérica/sin sentido** que NO coincide con:
- El análisis real del caso en la aplicación
- El PDF generado desde "IMPRIMIR PDF"

### Root Cause Identificado

**Bug localizado en: Arquitectura de serialización de datos Frontend→Backend**

#### Síntoma técnico
```
Frontend (app/main.js)
  ↓
  currentCaseData = { 
    protocolos: [LISTA COMPLETA CATÁLOGO],  ← 40+ productos
    technicalApprovalRows: [PRODUCTOS SELECCIONADOS],  ← 2-3 reales
    unifiedPriorityOne: [CATÁLOGO FILTRADO],
    ← NUNCA incluye approvedProtocols
  }
  ↓
  sendApprovedEmail() → POST /api/porc/cases { ...currentCaseData }
  ↓
Backend (server.js)
  ↓
  buildMailContent(caseRecord) → resolveProtocolRows(payload)
    ↓
    payload.approvedProtocols?  ← NO existe
    payload.protocolos?  ← SÍ existe = LISTA COMPLETA CATÁLOGO ❌
    ↓
  HTML mail ← RELLENA CON LISTA COMPLETA GENÉRICA
  
PERO: PDF funciona porque usa otra lógica/fuente
```

### Raíz del bug

**Línea 1740 (`main.js:sendApprovedEmail()`):**
```javascript
const backendPayload = {
  ...currentCaseData,  // ← INCLUYE protocolos (lista completa)
  emailCliente: ...,
  emailBioara: ...,
  veterinaryNotes: ...,
  consumoAlimentoRealKgDia: ...,
  inversionTotalCop: ...,
  roiPct: ...
  // ← FALTA: approvedProtocols (productos seleccionados)
};
```

**Línea 218 (`server.js:buildMailContent()`):**
```javascript
function resolveProtocolRows(payload = {}) {
  if (Array.isArray(payload.approvedProtocols) && payload.approvedProtocols.length) {
    return payload.approvedProtocols;  // ← Busca esto primero (NO EXISTE)
  }
  if (Array.isArray(payload.protocolos) && payload.protocolos.length) {
    return payload.protocolos;  // ← Fallback: usa esto (LISTA COMPLETA) ❌
  }
  return [];
}
```

---

## ✅ Plan de Corrección — 3 Pasos Determinísticos

### Paso 1: Frontend — Incluir `approvedProtocols` en Payload

**Archivo:** `PORCICULTURA/porcicultura_demo_1/app/main.js`  
**Ubicación:** Función `sendApprovedEmail()` línea ~1740  
**Cambio:** Construir explícitamente `approvedProtocols` antes de enviar

#### Acción 1a: Extraer productos aprobados (línea ~1770)
Después de línea 1770 donde filtra `approvedRows`, **guardar en `currentCaseData`:**
```javascript
// Extraer productos aprobados
const approvedRows = (currentCaseData.technicalApprovalRows || []).filter(
  (row) => row.aprobado && String(row.viaAprobada || "").trim()
);

// ← AGREGAR ESTO:
currentCaseData.approvedProtocols = approvedRows;  // Guardar para backend
```

#### Acción 1b: Incluir explícitamente en payload (línea ~1740)
```javascript
const backendPayload = {
  ...currentCaseData,
  // ← YA TENDRÁ approvedProtocols gracias a Acción 1a
  emailCliente: recipientClient || officialDemoMail,
  emailBioara: selectedResponsibleEmail || officialDemoMail,
  veterinaryNotes: veterinaryNotes.value || "Sin observaciones adicionales",
  consumoAlimentoRealKgDia: Number(currentCaseData.consumoAlimentoRealKgDia || 0),
  inversionTotalCop: Math.round(currentCaseData.financiero?.inversionTotal || 0),
  roiPct: Number(currentCaseData.financiero?.roi || 0)
};
```

**Verificación post-Paso 1:**
- [ ] Console log en el navegador: `console.log("approvedProtocols:", backendPayload.approvedProtocols)`
- [ ] Verificar que contiene 2-3 productos (no 40+)
- [ ] Verificar que cada producto tiene: `producto`, `viaAprobada`, `dosisAprobada`, `diasAprobados`, `costo`

---

### Paso 2: Backend — Validar y Usar `approvedProtocols`

**Archivo:** `PORCICULTURA/porcicultura_demo_1/server/server.js`  
**Ubicación:** Función `buildMailContent()` línea ~218  
**Cambio:** Priorizar `approvedProtocols` y validar que NO sea undefined

#### Acción 2a: Agregar validación de logging (línea ~218, antes de `resolveProtocolRows`)
```javascript
function buildMailContent(caseRecord) {
  const payload = caseRecord?.payload || {};
  const approval = caseRecord?.approval || {};
  const jev = payload.jev || evaluateJEV(payload);
  
  // ← AGREGAR LOGGING DIAGNÓSTICO:
  console.log(`[buildMailContent] caseRecord.id=${caseRecord.id}`);
  console.log(`[buildMailContent] payload.approvedProtocols length=${(payload.approvedProtocols || []).length}`);
  console.log(`[buildMailContent] payload.protocolos length=${(payload.protocolos || []).length}`);
  console.log(`[buildMailContent] payload.approvedProtocols:`, JSON.stringify(payload.approvedProtocols?.slice(0, 2)));
  
  const protocolos = resolveProtocolRows(payload);
  // ... resto
```

#### Acción 2b: Actualizar `resolveProtocolRows()` (línea ~211)
```javascript
function resolveProtocolRows(payload = {}) {
  // Prioridad 1: approvedProtocols (los seleccionados realmente)
  if (Array.isArray(payload.approvedProtocols) && payload.approvedProtocols.length) {
    console.log(`[resolveProtocolRows] Usando approvedProtocols (${payload.approvedProtocols.length} productos)`);
    return payload.approvedProtocols;
  }
  
  // Prioridad 2: protocolos (fallback a catálogo, pero marcar en log)
  if (Array.isArray(payload.protocolos) && payload.protocolos.length) {
    console.warn(`[resolveProtocolRows] FALLBACK a protocolos COMPLETO (${payload.protocolos.length} productos). ¿approvedProtocols está vacío?`);
    return payload.protocolos;
  }
  
  return [];
}
```

**Verificación post-Paso 2:**
- [ ] Iniciar backend: `npm start` en `server/`
- [ ] Ver logs en terminal: debe mostrar `Usando approvedProtocols (2-3 productos)`
- [ ] Si muestra "FALLBACK a protocolos COMPLETO" → frontend NO está enviando `approvedProtocols` → volver a Paso 1

---

### Paso 3: Verificación — Sincronización Email ↔ PDF

**Archivo:** Browser → `https://poultryia.com/porcicultura-demo-1/`  

#### Acción 3a: Ciclo completo local
1. Rellenar caso nuevo
2. Seleccionar 2 productos específicos
3. Hacer clic **"IMPRIMIR PDF"** → Guardar PDF locally
4. Hacer clic **"ENVIAR CORREO"** → Ver respuesta backend
5. Abrir PDF descargado e inspeccionar productos

#### Acción 3b: Verificación de contenido (PDF vs Email)

**Artefacto PDF esperado:**
```
PROPUESTA TÉCNICA BIOARA
Caso: CASO-[ID]

PROTOCOLO RECOMENDADO
1. Bio L.r. | Agua | 40,500 L | 14 días | $ 62.937
2. Bio-Protector | Agua | 1,080 kg | 3 días | $ 145.800
```

**Email esperado (HTML + Text):**
```
Protocolo recomendado

| # | Producto | Ruta | Dosis | Días | Total | Inversión |
|---|----------|------|-------|------|-------|-----------|
| 1 | Bio L.r. | Agua | 40,500 L | 14 | ... | $ 62.937 |
| 2 | Bio-Protector | Agua | 1,080 kg | 3 | ... | $ 145.800 |
```

**Checklist de coincidencia:**
- [ ] Número de productos = igual en PDF y email (2 no 40+)
- [ ] Nombres de productos = idénticos
- [ ] Inversiones = idénticas hasta el peso/moneda
- [ ] Rutas (agua/alimento) = idénticas
- [ ] NO hay descripción genérica de catálogo en email

#### Acción 3c: Verificación de logs backend
```bash
# Conectar al servidor de producción
ssh -p 5522 jleyton@72.60.171.123

# Ver logs del servicio
sudo journalctl -u poultryia-porcicultura-demo-1 -f | grep "\[buildMailContent\]\|\[resolveProtocolRows\]"

# O verificar archivo de auditoría del backend
tail -50 /path/to/server/storage/audit.json | grep -A5 "email_sent"
```

---

## 📊 Validación Determinística — Testing

### Test 1: Estructura de datos en Frontend
**Punto de validación:** Browser DevTools Console (F12)
```javascript
// En main.js:sendApprovedEmail(), agregar:
console.table({
  "approvedProtocols enviados": currentCaseData.approvedProtocols?.length || 0,
  "protocolos totales": currentCaseData.protocolos?.length || 0,
  "technicalApprovalRows": currentCaseData.technicalApprovalRows?.length || 0,
  "approvedProtocols[0]": currentCaseData.approvedProtocols?.[0]?.producto || "N/A"
});
```

**Criterio de éxito:**
- ✅ `approvedProtocols enviados` = 2-3 (no 0, no 40+)
- ✅ `approvedProtocols[0]` = nombre real del producto

### Test 2: Backend JSON Storage
**Punto de validación:** `PORCICULTURA/porcicultura_demo_1/server/storage/cases.json`

```bash
# Listar último caso creado
tail -1 server/storage/cases.json | jq '.payload.approvedProtocols | length'
```

**Criterio de éxito:**
- ✅ Retorna número 2-3 (no 0, no 40+)

### Test 3: Email Content en Production
**Punto de validación:** Inbox real (business@poultryia.com)

**Checklist visual:**
- [ ] Asunto = `Propuesta técnica BioARA AI - [CLIENTE] - Caso [ID]` ✅
- [ ] Cuerpo HTML = tabla con 2-3 filas de productos ✅
- [ ] Cada fila = `Producto | Ruta | Dosis | Días | Total | Inversión` ✅
- [ ] SIN lista genérica de 40+ productos ✅
- [ ] PDF anexo = mismo PDF de "IMPRIMIR PDF" ✅

### Test 4: Comparación PDF ↔ Email
**Punto de validación:** Lado a lado (PDF + Email)

```
PDF tabla de productos:
1. Bio L.r.       | Agua | 40,500 L | 14 | $ 62.937
2. Bio-Protector  | Agua | 1,080 kg | 3  | $ 145.800

Email tabla de productos:
1. Bio L.r.       | Agua | 40,500 L | 14 | $ 62.937
2. Bio-Protector  | Agua | 1,080 kg | 3  | $ 145.800

✅ COINCIDEN EXACTO
```

---

## 🚀 Orden de Ejecución — BLOQUEANTE

| # | Paso | Archivo | Línea | Estado | Validación |
|---|------|---------|-------|--------|------------|
| 1 | Frontend: Guardar `approvedProtocols` | `main.js` | ~1770 | TODO | DevTools console.table ✅ |
| 2 | Frontend: Incluir en payload | `main.js` | ~1740 | TODO | Network tab → JSON |
| 3 | Backend: Agregar logging | `server.js` | ~218 | TODO | `npm start` → logs terminal |
| 4 | Backend: Actualizar resolver | `server.js` | ~211 | TODO | `npm start` → logs |
| 5 | Test ciclo completo local | browser | - | TODO | Email ↔ PDF visual |
| 6 | Deploy a producción | bash script | - | TODO | SSH + systemctl restart |
| 7 | Verificar production inbox | Gmail/outlook | - | TODO | business@poultryia.com |
| 8 | Capturar lección | `tasks/lessons.md` | EOF | TODO | Documentar patrón |

---

## ⚠️ Reglas Críticas

### Regla 1: Serialización Completa
- **Frontend DEBE** incluir `approvedProtocols` EN el payload (no confiar en spread operator)
- **Backend DEBE** validar que `approvedProtocols` existe antes de caer a fallback

### Regla 2: Logging Determinístico
- Todos los logs incluyen `[nombreFuncion]` como prefijo
- Los logs muestran **números concretos** (length, count) no valores booleanos

### Regla 3: Fallback Graceful
- Backend NUNCA falla si `approvedProtocols` no existe
- Pero emite `console.warn()` indicando fallback (para diagnóstico)

### Regla 4: Paridad Email ↔ PDF
- Ambos deben usar la MISMA FUENTE de datos (`approvedProtocols`)
- Si el PDF tiene 3 productos, el email DEBE tener 3 productos

---

## 📝 Notas Post-Corrección

Al finalizar todos los pasos, crear entrada en `tasks/lessons.md`:

```markdown
## Lección #72: Serialización Frontend→Backend — Sincronización Email/PDF

### Problema
Correos contenían información genérica (catálogo completo) mientras PDFs 
mostraban datos reales. Bug de serialización de datos.

### Causa
Frontend calculaba productos seleccionados en `technicalApprovalRows` pero 
enviaba `protocolos` (catálogo completo) al backend. Backend usaba fallback 
a catálogo genérico porque no recibía `approvedProtocols`.

### Solución
1. Frontend: Guardar `currentCaseData.approvedProtocols = filteredRows`
2. Frontend: Incluir explícitamente en payload
3. Backend: Verificar y priorizar `approvedProtocols` en `resolveProtocolRows()`
4. Test: Email ↔ PDF coindicencia 100%

### Patrón Aplicable
Siempre que frontend→backend serialize datos transformados:
- Crear campo explícito para datos transformados (ej: `approvedProtocols`)
- NO confiar en spread operator + implicit resolution
- Backend DEBE validar + loguear para diagnóstico
- Test: verificar paridad en UI consumidora (email ↔ PDF)

### Código Clave
Frontend:
```javascript
currentCaseData.approvedProtocols = approvedRows;  // Guardar transformación
```

Backend:
```javascript
function resolveProtocolRows(payload) {
  if (Array.isArray(payload.approvedProtocols) && payload.approvedProtocols.length) {
    return payload.approvedProtocols;  // Usar transformación
  }
  // Fallback con LOGGING
}
```
```

---

## 📞 Requisitos de Ejecución

**Herramientas necesarias:**
- VS Code con terminal PowerShell
- WSL bash (para SSH)
- Node.js 18+ (backend)
- Browser con DevTools (F12)
- Terminal para `systemctl` (producción)

**Tiempo estimado:** 45 minutos  
- Paso 1-2 (coding): 15 min
- Paso 3 (testing): 20 min
- Paso 4-5 (deploy + verify): 10 min

