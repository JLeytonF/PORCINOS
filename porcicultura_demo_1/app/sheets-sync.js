/**
 * sheets-sync.js — Porcicultura Demo 1
 *
 * Módulo de integración con Google Sheets para lectura de configuración
 * y escritura de casos via Google Apps Script Web App.
 *
 * Dos canales:
 *   READ  → Hoja publicada como CSV (sin API Key, solo para hojas públicas)
 *   WRITE → Apps Script Web App (POST JSON) → columnas en pestaña "Casos"
 */

/* ═══════════════════════════════════════════════════════════════════════════
   LEER CONFIGURACIÓN DESDE GOOGLE SHEET
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Descarga CSV desde Google Sheets.
 * Acepta dos formatos de entrada:
 *   - URL completa publicada (/pub?output=csv)  ← formato del usuario
 *   - sheetId clásico + gid                     ← fallback
 *
 * @param {string} urlOrSheetId  — URL completa O Sheet ID clásico
 * @param {number} gid           — solo si urlOrSheetId es un Sheet ID
 * @returns {Promise<string>} texto CSV crudo
 */
async function fetchSheetCsv(urlOrSheetId, gid = 0) {
  const url = urlOrSheetId.startsWith("http")
    ? urlOrSheetId
    : `https://docs.google.com/spreadsheets/d/${urlOrSheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch HTTP ${res.status} — ${url.slice(0, 80)}`);
  return res.text();
}

/**
 * Parser CSV mínimo con soporte de campos entre comillas.
 * @param {string} text
 * @returns {Array<Record<string,string>>}
 */
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = parseCsvLine(line);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] ?? "").trim()]));
    });
}

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Carga la configuración de precios desde la pestaña "Config" del Sheet.
 *
 * Formato esperado de la pestaña Config:
 *   | clave                 | valor  | descripcion             |
 *   | costoAlimentoCopKg    | 1623   | Costo alimento COP/kg   |
 *   | precioCerdoCopKg      | 6380   | Precio cerdo vivo COP/kg|
 *   | origenListaPrecios    | Bioara | Fuente del precio       |
 *
 * @param {string} urlOrSheetId  — URL completa publicada O Sheet ID clásico
 * @param {number} gid            — solo si urlOrSheetId es un Sheet ID
 * @returns {Promise<Partial<{costoAlimentoCopKg:number, precioCerdoCopKg:number, origenListaPrecios:string}>>}
 */
export async function loadSheetConfig(urlOrSheetId, gid = 0) {
  const csv = await fetchSheetCsv(urlOrSheetId, gid);
  const rows = parseCsv(csv);
  const result = {};

  for (const row of rows) {
    const key = (row.clave || "").trim();
    const raw = (row.valor || "").trim();
    if (!key) continue;

    if (key === "origenListaPrecios") {
      result[key] = raw;
    } else {
      const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n)) result[key] = n;
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIAR CASOS A GOOGLE SHEETS (vía Apps Script Web App)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Serializa un registro de caso a un objeto limpio para enviar al Sheet.
 * Excluye campos binarios/JSON voluminosos que no aportan valor en la hoja.
 */
function serializeCase(record) {
  return {
    id:                   record.id ?? "",
    fechaRegistro:        record.fechaRegistro ?? "",
    syncStatus:           record.syncStatus ?? "",
    lineaServicio:        record.lineaServicio ?? "",
    cliente:              record.cliente ?? "",
    granja:               record.granja ?? "",
    emailCliente:         record.emailCliente ?? "",
    bioaraResponsible:    record.emailBioara ?? "",
    totalAnimalesCliente: record.totalAnimalesCliente ?? 0,
    animalesTratar:       record.animalesTratar ?? 0,
    genetica:             record.genetica ?? "",
    fase:                 record.fase ?? "",
    pesoPromedio:         record.pesoPromedio ?? 0,
    edadDias:             record.edadDias ?? 0,
    viaPreferida:         record.viaPreferida ?? "",
    desafio:              record.desafio ?? "",
    areaTratadaM2:        record.areaTratadaM2 ?? 0,
    costoAlimento:        record.costoAlimento ?? 0,
    precioCerdo:          record.precioCerdo ?? 0,
    mortalidad:           record.mortalidad ?? 0,
    fca:                  record.fca ?? 0,
    aguaLoteDiaL:         record.aguaLoteDiaL ?? 0,
    alimentoLoteDiaKg:    record.alimentoLoteDiaKg ?? 0,
    inversionTotalCop:    record.inversionTotalCop ?? 0,
    roiPct:               record.roiPct ?? 0,
    beneficioNetoCop:     record.beneficioNetoCop ?? 0,
    /* Resumen de protocolos como texto legible */
    protocoloResumen: (() => {
      try {
        const protos = JSON.parse(record.protocoloJson || "[]");
        return protos.map(p => p.producto).join(", ");
      } catch { return ""; }
    })(),
  };
}

/**
 * Envía un caso individual al Apps Script Web App.
 *
 * @param {object} record        — Registro de caso (de IndexedDB / saveCase)
 * @param {string} appsScriptUrl — URL del web app desplegado
 * @returns {Promise<{ok:boolean, id?:string, error?:string}>}
 */
export async function sendCaseToSheet(record, appsScriptUrl) {
  if (!appsScriptUrl) throw new Error("appsScriptUrl no configurado");

  const body = JSON.stringify(serializeCase(record));

  /* Apps Script Web App redirige POST → seguir la redirección */
  const res = await fetch(appsScriptUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain" }, /* Apps Script acepta text/plain mejor que application/json para evitar CORS preflight */
    body,
  });

  if (!res.ok) throw new Error(`Apps Script respondió HTTP ${res.status}`);

  const json = await res.json().catch(() => ({ ok: true }));
  return json;
}

/**
 * Lee todos los casos pendientes de IndexedDB y los envía al Sheet.
 * Devuelve conteo de {synced, failed}.
 *
 * @param {string} appsScriptUrl
 * @returns {Promise<{synced:number, failed:number, errors:string[]}>}
 */
export async function syncPendingCases(appsScriptUrl) {
  const { listCases } = await import("./db.js");
  const cases = await listCases();
  const pending = cases.filter(c => c.syncStatus !== "synced");

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const record of pending) {
    try {
      await sendCaseToSheet(record, appsScriptUrl);
      synced++;
    } catch (err) {
      failed++;
      errors.push(`${record.id}: ${err.message}`);
    }
  }

  return { synced, failed, errors };
}
