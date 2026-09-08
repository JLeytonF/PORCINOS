/**
 * Code.gs — Google Apps Script para Porcicultura Demo 1 / BioARA
 *
 * PRIMER USO (una sola vez):
 *   1. Abre tu Google Spreadsheet → copia la URL de edición.
 *   2. Pégala en la variable SPREADSHEET_EDIT_URL de la función setup() aquí abajo.
 *   3. En el editor de Apps Script: Ejecutar → setup()  (autoriza si pide permisos).
 *   4. Implementar → Nueva implementación → Tipo: "Aplicación web"
 *      Ejecutar como: "Yo"   /   Acceso: "Cualquier persona"
 *   5. Copiar la URL /exec → pegarla en index.html → appsScriptUrl.
 */

// ─── Constantes ────────────────────────────────────────────────────────────
var CASES_SHEET_NAME  = "Casos";
var CONFIG_SHEET_NAME = "Config";

/**
 * Ejecutar UNA VEZ desde el editor para registrar el ID del spreadsheet.
 * Pegar la URL de edición de la hoja en SPREADSHEET_EDIT_URL y luego
 * hacer clic en Ejecutar → setup().
 */
function setup() {
  var SPREADSHEET_EDIT_URL = "PEGAR_URL_DE_EDICION_AQUI";

  var match = SPREADSHEET_EDIT_URL.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error("URL invalida. Debe contener /d/{ID}/. URL recibida: " + SPREADSHEET_EDIT_URL);
  }
  var id = match[1];
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", id);

  var ss = SpreadsheetApp.openById(id);
  Logger.log("OK — Spreadsheet conectado: " + ss.getName() + " (" + id + ")");
}

/** Obtiene el spreadsheet: primero Script Properties, luego ID hardcoded. */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID")
           || "11VaY_H20fdjf1cOLsGXRjQlyPvGh8DXbRzyLGi3Qmsk";
  return SpreadsheetApp.openById(id);
}

// Columnas de la hoja "Casos" (en orden)
var CASE_COLUMNS = [
  "Timestamp",
  "id",
  "fechaRegistro",
  "syncStatus",
  "lineaServicio",
  "cliente",
  "granja",
  "emailCliente",
  "bioaraResponsible",
  "totalAnimalesCliente",
  "animalesTratar",
  "genetica",
  "fase",
  "pesoPromedio",
  "edadDias",
  "viaPreferida",
  "desafio",
  "areaTratadaM2",
  "costoAlimento",
  "precioCerdo",
  "mortalidad",
  "fca",
  "aguaLoteDiaL",
  "alimentoLoteDiaKg",
  "inversionTotalCop",
  "roiPct",
  "beneficioNetoCop",
  "protocoloResumen"
];


// ─── Endpoint POST: recibe un caso y lo registra ────────────────────────────
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    var ss    = getSpreadsheet_();
    var sheet = getOrCreateCasesSheet_(ss);

    /* Construir fila en el orden de CASE_COLUMNS */
    var row = [new Date().toISOString()].concat(
      CASE_COLUMNS.slice(1).map(function(col) {
        var v = data[col];
        return v !== undefined && v !== null ? v : "";
      })
    );

    sheet.appendRow(row);

    return jsonResponse_({ ok: true, id: data.id || "", timestamp: new Date().toISOString() });

  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}


// ─── Endpoint GET: health-check + lectura Config ─────────────────────────────
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};

    /* ?action=config → devuelve la pestaña Config como JSON */
    if (params.action === "config") {
      var ss     = getSpreadsheet_();
      var config = readConfigSheet_(ss);
      return jsonResponse_({ ok: true, config: config });
    }

    /* Sin parámetros → health check */
    return jsonResponse_({
      ok:      true,
      service: "Porcicultura Demo 1 - BioARA Apps Script",
      version: "1.0.0",
      time:    new Date().toISOString(),
      spreadsheetConfigured: Boolean(PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"))
    });

  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}


// ─── Helpers privados ────────────────────────────────────────────────────────

/**
 * Obtiene la pestaña "Casos", la crea con cabeceras si no existe.
 */
function getOrCreateCasesSheet_(ss) {
  var sheet = ss.getSheetByName(CASES_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CASES_SHEET_NAME);
    sheet.appendRow(CASE_COLUMNS);

    /* Formato de cabecera */
    var header = sheet.getRange(1, 1, 1, CASE_COLUMNS.length);
    header.setFontWeight("bold");
    header.setBackground("#0b5d47");
    header.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Lee la pestaña Config como objeto clave→valor.
 */
function readConfigSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) return {};

  var data   = sheet.getDataRange().getValues();
  var result = {};

  /* Fila 0 es la cabecera, empezar desde 1 */
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || "").trim();
    var val = data[i][1];
    if (key) result[key] = val;
  }

  return result;
}

/**
 * Envuelve un objeto en ContentService JSON con CORS permisivo.
 * Apps Script añade automáticamente Access-Control-Allow-Origin: *
 * cuando el web app está configurado como acceso "Anyone".
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
