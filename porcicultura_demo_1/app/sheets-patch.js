/**
 * sheets-patch.js — Porcicultura Demo 1
 *
 * Módulo de enriquecimiento NO INVASIVO sobre demo_bioara_v1/app/main.js.
 * NO modifica main.js — se carga como segundo módulo ES en index.html.
 *
 * Funciones:
 *  1. Reemplaza el botón "Simular sincronización" por "Sincronizar con Sheets"
 *  2. Carga precios iniciales desde la pestaña Config del Google Sheet
 *  3. Observa el mensaje de guardado para auto-sincronizar cada caso nuevo
 */

import { sendCaseToSheet, syncPendingCases, loadSheetConfig } from "./sheets-sync.js";
import { listCases, markAllSynced } from "./db.js";

/* Configuración inyectada desde index.html vía window.DEMO_SHEETS_CONFIG */
const cfg = window.DEMO_SHEETS_CONFIG ?? {};
const APPS_SCRIPT_URL = cfg.appsScriptUrl ?? "";
/* configCsvUrl tiene precedencia sobre sheetId + configGid */
const CONFIG_CSV_SRC  = cfg.configCsvUrl || cfg.sheetId || "";
const CONFIG_GID      = cfg.configGid ?? 0;

/* ── 1. Reemplazar botón Sync ──────────────────────────────────────────── */
function patchSyncButton() {
  const btn = document.getElementById("syncBtn");
  if (!btn) return;

  btn.textContent = "Sincronizar con Sheets";

  /* Clonar para eliminar los listeners existentes de main.js */
  const newBtn = btn.cloneNode(true);
  btn.replaceWith(newBtn);

  newBtn.addEventListener("click", async () => {
    if (!APPS_SCRIPT_URL) {
      alert(
        "Google Sheets no está configurado.\n" +
        "Agrega la URL del Apps Script en index.html → DEMO_SHEETS_CONFIG.appsScriptUrl\n" +
        "Ver README_DEPLOY.md para instrucciones."
      );
      return;
    }

    newBtn.disabled = true;
    newBtn.textContent = "Enviando a Sheets…";

    try {
      const { synced, failed, errors } = await syncPendingCases(APPS_SCRIPT_URL);
      if (synced > 0) await markAllSynced();

      const msg = [
        `✓ Sincronización completada`,
        `  Enviados: ${synced}`,
        `  Fallidos: ${failed}`,
        errors.length ? `  Errores:\n  ${errors.join("\n  ")}` : "",
      ].filter(Boolean).join("\n");

      alert(msg);
    } catch (err) {
      alert(`Error al sincronizar con Google Sheets:\n${err.message}`);
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = "Sincronizar con Sheets";
    }
  });
}

/* ── 2. Cargar precios desde agente JEV (primero) o Sheet (fallback) ─── */
async function applySheetConfig() {
  const form = document.getElementById("caseForm");
  if (!form) return;

  // Intento 1: agente JEV — fuente de autoridad
  try {
    const resp = await fetch("/api/mercado/agentes/precios-porcicultura", {
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && (data.precioCerdoCopKg || data.costoAlimentoCopKg)) {
        if (data.costoAlimentoCopKg && form.elements.costoAlimento) {
          form.elements.costoAlimento.value = String(Math.round(data.costoAlimentoCopKg));
        }
        if (data.precioCerdoCopKg && form.elements.precioCerdo) {
          form.elements.precioCerdo.value = String(Math.round(data.precioCerdoCopKg));
        }
        const banner = document.getElementById("saveMessage");
        if (banner) {
          const origen = data.origenListaPrecios || "BioARA JEV";
          const fecha = data.vigente_al ? ` · vigente ${data.vigente_al}` : "";
          banner.hidden = false;
          banner.textContent = `Precios cargados desde ${origen}${fecha}`;
        }
        console.info("[Demo1] Precios cargados desde agente JEV:", data);
        return; // éxito — no necesitamos Google Sheets
      }
    }
  } catch (jevError) {
    console.warn("[Demo1] Agente JEV no disponible, intentando Google Sheets:", jevError.message);
  }

  // Intento 2: Google Sheets (fallback)
  if (!CONFIG_CSV_SRC) return;

  const defaults = await loadSheetConfig(CONFIG_CSV_SRC, CONFIG_GID).catch(err => {
    console.warn("[Demo1] No se pudo cargar config desde Sheet:", err.message);
    return null;
  });

  if (!defaults) return;

  if (defaults.costoAlimentoCopKg && form.elements.costoAlimento) {
    form.elements.costoAlimento.value = String(defaults.costoAlimentoCopKg);
  }
  if (defaults.precioCerdoCopKg && form.elements.precioCerdo) {
    form.elements.precioCerdo.value = String(defaults.precioCerdoCopKg);
  }

  const banner = document.getElementById("saveMessage");
  if (banner && defaults.origenListaPrecios) {
    banner.hidden = false;
    banner.textContent = `Precios cargados desde Google Sheets: ${defaults.origenListaPrecios}`;
  }

  console.info("[Demo1] Precios cargados desde Google Sheet (fallback):", defaults);
}

/* ── 3. Auto-sync por MutationObserver en el mensaje de guardado ─────── */
function watchForCaseSaves() {
  if (!APPS_SCRIPT_URL) return;

  const saveMsg = document.getElementById("saveMessage");
  if (!saveMsg) return;

  /* Guardamos el último texto procesado para evitar envíos duplicados */
  let lastProcessed = "";

  const observer = new MutationObserver(async () => {
    const text = saveMsg.textContent ?? "";

    /* main.js usa el prefijo exacto "Caso guardado correctamente:" */
    if (!text.startsWith("Caso guardado correctamente:")) return;
    if (text === lastProcessed) return;

    lastProcessed = text;

    /* Obtener el caso recién guardado (listCases() devuelve desc por fecha) */
    const cases = await listCases().catch(() => []);
    const latest = cases[0];
    if (!latest) return;

    sendCaseToSheet(latest, APPS_SCRIPT_URL)
      .then(res => {
        console.info("[Demo1] Caso enviado a Google Sheets:", latest.id, res);
      })
      .catch(err => {
        console.warn("[Demo1] Auto-sync falló (sin red o config incorrecta):", err.message);
      });
  });

  observer.observe(saveMsg, {
    childList:     true,
    subtree:       true,
    characterData: true,
    attributes:    false,
  });
}

/* ── Inicialización ───────────────────────────────────────────────────── */
if (!window.__DEMO1_AUTHORIZED) {
  console.warn("[Demo1] Módulo cargado sin autorización de token. Abortando.");
} else {
  patchSyncButton();
  watchForCaseSaves();

  // Carga JEV exactamente cuando main.js termina refreshMarketDefaults().
  // El evento bioara:benchmark-ready elimina la carrera: no hay timeout ni polling.
  window.addEventListener("bioara:benchmark-ready", applySheetConfig, { once: true });

  // Llamada inmediata de respaldo por si el evento ya pasó antes de registrarse.
  applySheetConfig();

  console.info(
    "[Demo1] sheets-patch activo.",
    CONFIG_CSV_SRC ? `Config CSV: ${CONFIG_CSV_SRC.slice(0, 50)}…` : "⚠ configCsvUrl no configurada",
    APPS_SCRIPT_URL ? "Apps Script URL: ✓" : "⚠ Apps Script URL no configurada"
  );
}
