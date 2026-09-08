# Porcicultura Demo 1 — Guía de Despliegue

Demo web temporal con Google Sheets como origen de datos.  
Acceso exclusivo por URL secreta. Fácil de eliminar.

---

## Arquitectura

```
Browser → Vercel (static)
             ├── token-gate.js     ← bloquea acceso sin ?t=TOKEN
             ├── main.js           ← lógica demo_bioara_v1 (sin modificar)
             └── sheets-patch.js   ← integración Google Sheets (módulo adicional)
                    ↓ POST casos
             Google Apps Script Web App
                    ↓ appendRow
             Google Spreadsheet ("Casos" tab)

             Google Spreadsheet ("Config" tab)
                    ↑ fetch CSV (lectura precios al inicio)
             sheets-patch.js
```

**Token de acceso**: `porc2026-EvalDemo-x7K9mQz`  
**URL final de ejemplo**: `https://porcicultura-demo-1.vercel.app/?t=porc2026-EvalDemo-x7K9mQz`

---

## Paso 1 — Preparar archivos base

Ejecutar desde la carpeta `PORCICULTURA/`:

```powershell
cd PORCICULTURA
.\porcicultura_demo_1\setup.ps1
```

Este script copia de `demo_bioara_v1/` los archivos JS/CSS/datos sin sobreescribir los específicos de Demo 1.

---

## Paso 2 — Crear el Google Spreadsheet

1. Ir a [sheets.new](https://sheets.new) y crear un nuevo spreadsheet.
2. Guardar el **ID del spreadsheet** del URL:  
   `https://docs.google.com/spreadsheets/d/` **`ESTE_ES_EL_ID`** `/edit`

3. Renombrar la primera pestaña como **`Config`** y agregar estas filas:

   | A (clave)             | B (valor) | C (descripcion)               |
   |-----------------------|-----------|-------------------------------|
   | costoAlimentoCopKg    | 1623      | Costo alimento COP/kg         |
   | precioCerdoCopKg      | 6380      | Precio cerdo vivo COP/kg      |
   | origenListaPrecios    | BioARA Demo 1 | Fuente de referencia      |

4. **Publicar la pestaña Config como CSV**:  
   `Archivo → Compartir → Publicar en la web → Pestaña: Config → Formato: CSV → Publicar`

5. Anotar el **GID** de la pestaña Config (número al final del URL cuando está seleccionada):  
   `...spreadsheets/d/ID/edit#gid=` **`NUMERO_GID`**  
   Si es la primera pestaña, el GID es `0`.

---

## Paso 3 — Desplegar el Google Apps Script

1. Ir a [script.google.com](https://script.google.com) → Nuevo proyecto.
2. Nombrar el proyecto: `Porcicultura Demo 1 - BioARA`.
3. **Reemplazar** todo el contenido de `Code.gs` con el contenido de [apps-script/Code.gs](./apps-script/Code.gs).
4. Guardar (Ctrl+S).
5. Clic en **"Implementar"** → **"Nueva implementación"**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo** (tu cuenta de Google)
   - Quién tiene acceso: **Cualquier persona** (Anyone)
6. Clic en **"Implementar"** → Autorizar permisos.
7. Copiar la **URL de la aplicación web** (formato: `https://script.google.com/macros/s/XXXXX/exec`).

**Verificar el Apps Script** (prueba rápida):
```
https://script.google.com/macros/s/TU_ID/exec
```
Debe responder: `{"ok":true,"service":"Porcicultura Demo 1 - BioARA Apps Script",...}`

---

## Paso 4 — Configurar index.html

Abrir `porcicultura_demo_1/index.html` y completar el objeto `DEMO_SHEETS_CONFIG`:

```html
<script>
  window.DEMO_SHEETS_CONFIG = {
    sheetId:       "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",   // ← tu Sheet ID
    configGid:     0,                                  // ← GID de pestaña Config
    appsScriptUrl: "https://script.google.com/macros/s/XXXXX/exec"  // ← tu URL
  };
</script>
```

---

## Paso 5 — Desplegar en Vercel

### Opción A: Vercel CLI (recomendado)

```powershell
# Instalar Vercel CLI si no está instalado
npm i -g vercel

# Desplegar (ejecutar desde la raíz del repo)
cd "PORCICULTURA\porcicultura_demo_1"
vercel

# Responder las preguntas de Vercel:
#   Set up and deploy: Y
#   Which scope: tu cuenta
#   Link to existing project: N
#   Project name: porcicultura-demo-1
#   Directory: ./  (punto, directorio actual)
#   Override settings: N
```

### Opción B: Vercel Dashboard

1. Ir a [vercel.com/new](https://vercel.com/new).
2. Importar desde GitHub o subir la carpeta `porcicultura_demo_1/`.
3. Root Directory: `porcicultura_demo_1` (si importas desde el repo raíz).
4. Framework Preset: **Other** (es HTML estático puro).
5. Deploy.

---

## Paso 6 — Compartir el enlace secreto

Una vez desplegado, el enlace de acceso es:

```
https://porcicultura-demo-1.vercel.app/?t=porc2026-EvalDemo-x7K9mQz
```

> **Sin el parámetro `?t=...`** la aplicación redirige a `poultryia.com`.

Enviar **solo a evaluadores externos autorizados** mediante comunicación privada.

---

## Verificación de integración con Google Sheets

### Test 1 — Carga de precios desde Config sheet

Al abrir la URL con el token correcto, el mensaje verde debería mostrar:
> "Precios cargados desde Google Sheets: BioARA Demo 1"

Si no aparece, revisar en la consola del navegador (F12 → Console):
- `[Demo1] Sheet config load failed: ...` → verificar que la hoja esté publicada como CSV

### Test 2 — Envío de caso a la hoja "Casos"

1. Llenar el formulario y calcular un caso.
2. El caso se guarda localmente (mensaje "Caso guardado correctamente").
3. El auto-sync intenta enviarlo (ver consola: `[Demo1] Caso enviado a Google Sheets: CASO-XXXXX`).
4. Verificar en el Google Spreadsheet → pestaña **Casos** que aparece una nueva fila.

### Test 3 — Botón "Sincronizar con Sheets"

1. Calcular varios casos (con y sin red).
2. Clic en **"Sincronizar con Sheets"**.
3. El diálogo debe mostrar: `✓ Sincronización completada. Enviados: N. Fallidos: 0.`

### Test 4 — Token gate

Abrir la URL **sin** el token:
```
https://porcicultura-demo-1.vercel.app/
```
Debe redirigir a `poultryia.com` en menos de 1 segundo.

---

## Cómo eliminar la demo

### Eliminar la demo completa

```powershell
# 1. Desde Vercel Dashboard
#    → Settings → Delete Project → Confirmar

# O con CLI:
vercel rm porcicultura-demo-1 --yes
```

### Eliminar solo la carpeta local

```powershell
Remove-Item -Recurse -Force "PORCICULTURA\porcicultura_demo_1"
```

### Eliminar el Google Apps Script
Ir a [script.google.com](https://script.google.com) → Seleccionar el proyecto → ⋮ → Quitar.

### Eliminar el Google Spreadsheet
Mover a la papelera desde Google Drive.

---

## Rotar el token de acceso

Si el enlace se filtra, cambiar el token en **dos lugares**:

1. `porcicultura_demo_1/app/token-gate.js`:
   ```js
   var DEMO_ACCESS_TOKEN = "nuevo-token-2026-XXXX";
   ```

2. Re-desplegar en Vercel:
   ```powershell
   cd "PORCICULTURA\porcicultura_demo_1"
   vercel --prod
   ```

---

## Estructura de archivos

```
porcicultura_demo_1/
├── index.html                 ← Token gate + config Sheets (MODIFICADO)
├── styles.css                 ← Copiado de demo_bioara_v1/
├── sw.js                      ← Copiado de demo_bioara_v1/
├── manifest.webmanifest       ← Copiado de demo_bioara_v1/
├── vercel.json                ← Config de despliegue Vercel
├── setup.ps1                  ← Script de preparación de archivos
├── app/
│   ├── token-gate.js          ← NUEVO: protección por URL token
│   ├── sheets-sync.js         ← NUEVO: integración Google Sheets
│   ├── sheets-patch.js        ← NUEVO: parche no invasivo sobre main.js
│   ├── main.js                ← Copiado de demo_bioara_v1/ (sin modificar)
│   ├── calc.js                ← Copiado de demo_bioara_v1/
│   ├── config.js              ← Copiado de demo_bioara_v1/
│   ├── csv.js                 ← Copiado de demo_bioara_v1/
│   ├── db.js                  ← Copiado de demo_bioara_v1/
│   └── ui.js                  ← Copiado de demo_bioara_v1/
├── data/                      ← Copiado de demo_bioara_v1/
├── logos/                     ← Copiado de demo_bioara_v1/
└── apps-script/
    └── Code.gs                ← NUEVO: desplegar en script.google.com
```
