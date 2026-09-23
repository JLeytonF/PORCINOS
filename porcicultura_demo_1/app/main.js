import { DEFAULTS, PRICE_CATALOG, refreshMarketDefaults } from "./config.js?v=20260907r7";
import { calculateCase } from "./calc.js?v=20260813r10";
import { downloadCsv } from "./csv.js?v=20260813r4";
import { listCases, markAllSynced, saveCase } from "./db.js?v=20260813r4";
import { renderHistory, renderResult } from "./ui.js?v=20260907r8";
import { PROTOCOLOS_PORCICULTURA_RULES } from "../data/protocolos_porcicultura_rules.js?v=20260813r1";

const form = document.getElementById("caseForm");
const resultBox = document.getElementById("result");
const historyBox = document.getElementById("history");
const catalogBox = document.getElementById("priceCatalog");
const networkBadge = document.getElementById("networkBadge");
const syncBtn = document.getElementById("syncBtn");
const exportBtn = document.getElementById("exportBtn");
const installBtn = document.getElementById("installBtn");
const newCaseBtn = document.getElementById("newCaseBtn");
const refreshBenchmarkBtn = document.getElementById("refreshBenchmarkBtn");
const saveMessage = document.getElementById("saveMessage");
const approvalPanel = document.getElementById("approvalPanel");
const veterinaryApproval = document.getElementById("veterinaryApproval");
const veterinaryNotes = document.getElementById("veterinaryNotes");
const approvalStatus = document.getElementById("approvalStatus");
const approveDetailBtn = document.getElementById("approveDetailBtn");
const printPdfBtn = document.getElementById("printPdfBtn");
const sendEmailBtn = document.getElementById("sendEmailBtn");
const serviceLineSelector = document.getElementById("serviceLineSelector");
const serviceLineInput = document.getElementById("serviceLineInput");
const priceCatalogSection = document.getElementById("priceCatalogSection");
const prioritySelectorPanel = document.getElementById("prioritySelectorPanel");
const priorityProductList = document.getElementById("priorityProductList");
const priorityProductSearch = document.getElementById("priorityProductSearch");
const bioaraResponsibleSelect = document.getElementById("bioaraResponsibleSelect");
const biosecurityAreaField = document.getElementById("biosecurityAreaField");
const biosecurityAreaInput = form.elements.areaTratadaM2;
let currentCaseData = null;
let protocolRuleSet = Array.isArray(PROTOCOLOS_PORCICULTURA_RULES?.protocols) ? PROTOCOLOS_PORCICULTURA_RULES.protocols : [];
let selectedManualProducts = new Set();
let bioaraResponsibleRoster = [];
let technicalApprovalRows = [];
let veterinaryApprovalConfirmed = false;

const FALLBACK_BIOARA_RESPONSIBLES = [
  { nombre: "Dr. Alejandro Rodriguez", email: "gerencia@bioarasa.com" },
  { nombre: "Dra. Juliana Florez", email: "asistentedeventas@bioarasa.com" },
  { nombre: "Dra. Andrea Cadavid", email: "medellinavicultura@bioarasa.com" },
  { nombre: "Dra. Lina Santa", email: "bucaramanga@bioarasa.com" },
  { nombre: "Dra. Amanda Rodriguez", email: "dvacuicultura@bioarasa.com" },
  { nombre: "Dr. Jorge Moreno", email: "gerenciadeventas@bioarasa.com" },
  { nombre: "Dr. Jesus Diaz", email: "costabioara@bioarasa.com" },
  { nombre: "Dr. Luis Cardona", email: "gerenciamedellin@bioarasa.com" },
  { nombre: "Dra. Marianela Munera", email: "distribuidoresmedellin@bioarasa.com" },
  { nombre: "Dr. Juan Pablo Baron", email: "ponedoras@bioarasa.com" },
  { nombre: "Dra. Olga Sanchez", email: "porcivalle@bioarasa.com" },
  { nombre: "Dr. Daniel Velasquez", email: "medellinporcicultura@bioarasa.com" },
  { nombre: "Dr. Ciro Carvajal", email: "valle@bioarasa.com" },
  { nombre: "Dr. Claudio Garcia", email: "zonacentro@bioarasa.com" }
];

const OFFICIAL_BIOARA_NAMES_BY_EMAIL = Object.fromEntries(
  FALLBACK_BIOARA_RESPONSIBLES.map((person) => [String(person.email || "").toLowerCase(), person.nombre])
);

const ACTIVE_SERVICE_LINE = "porcicultura";
const SERVICE_STORAGE_KEY = "bioara.service.line";
const SERVICE_LINE_LABELS = {
  avicultura: "Avicultura",
  acuicultura: "Acuicultura",
  porcicultura: "Porcicultura",
  laboratorio: "Laboratorio"
};

let deferredPrompt = null;

function updateNetworkBadge() {
  const online = navigator.onLine;
  networkBadge.textContent = online ? "Con red" : "Sin red";
  networkBadge.classList.toggle("online", online);
  networkBadge.classList.toggle("offline", !online);
}

function formatCatalogCategory(rawCategory = "") {
  const text = String(rawCategory || "").trim();
  if (!text) return "General";

  const known = {
    Biologico_Con_Ficha: "Biológico con ficha técnica",
    Biologico_Pendiente: "Biológico pendiente",
    Probiotico_con_electrolitos: "Probiótico con electrolitos",
    Farmacéutico_Apoyo: "Farmacéutico de apoyo",
    Farmacéutico_Respiratorio: "Farmacéutico respiratorio",
    Control_Biologico_Moscas: "Control biológico de moscas",
    Control_Moscas: "Control de moscas",
    Desinfectante_Detergente_Biocida: "Desinfectante / detergente biocida",
    Detergente_Biocida: "Detergente biocida"
  };

  if (known[text]) return known[text];
  return text.replace(/_/g, " ");
}

function buildProductMeta(item) {
  if (item.presentacion === "Según ficha técnica") {
    return "Ficha técnica validada · Precio: Cotizar";
  }

  return `${formatCatalogCategory(item.categoria)} · ${item.presentacion}`;
}

function renderPriceCatalog() {
  const sortedCatalog = [...PRICE_CATALOG].sort((a, b) =>
    a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
  );

  const rows = sortedCatalog.map((item) => `
    <tr>
      <td>${item.producto}</td>
      <td>${formatCatalogCategory(item.categoria)}</td>
      <td>${item.presentacion}</td>
      <td>${item.estado === "pendiente por confirmar" || item.precioUnitarioCop <= 0 ? "Cotizar" : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
      }).format(item.precioUnitarioCop)}</td>
      <td>${item.estado}</td>
    </tr>
  `).join("");

  catalogBox.innerHTML = `
    <details class="support-panel catalog-panel">
      <summary>Precio base del catálogo</summary>
      <p class="helper">Fuente: ${DEFAULTS.origenListaPrecios}</p>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Presentación</th>
            <th>Precio unitario</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="helper">Los productos marcados como "pendiente por confirmar" se muestran para trazabilidad comercial, pero no se habilitan para recomendación automática.</p>
    </details>
  `;
}

function getProductByName(name) {
  return PRICE_CATALOG.find((item) => item.producto === name);
}

function getManualSelectedProducts() {
  return Array.from(selectedManualProducts.values());
}

function renderPriorityProductList(searchText = "") {
  if (!priorityProductList) return;

  const term = String(searchText || "").trim().toLowerCase();
  const filtered = PRICE_CATALOG.filter((item) => {
    if (!term) return true;
    const haystack = `${item.producto} ${item.categoria} ${item.presentacion}`.toLowerCase();
    return haystack.includes(term);
  }).sort((a, b) => a.producto.localeCompare(b.producto, "es", { sensitivity: "base" }));

  const selectedCount = selectedManualProducts.size;
  const selectedItems = Array.from(selectedManualProducts.values()).map((product) => {
    const catalogItem = getProductByName(product);
    return `
      <span class="selected-product-chip">
        <strong>${product}</strong>
        <small>${catalogItem ? catalogItem.categoria : "Catálogo"}</small>
      </span>
    `;
  }).join("");

  const rows = filtered.map((item) => {
    const checked = selectedManualProducts.has(item.producto) ? "checked" : "";
    const meta = buildProductMeta(item);
    const category = formatCatalogCategory(item.categoria);

    return `
      <label class="priority-product-item">
        <input type="checkbox" data-manual-product="${item.producto}" ${checked} />
        <span>
          <strong>${item.producto}</strong>
          <small class="product-meta">${meta}</small>
          <small class="product-category-badge">${category}</small>
        </span>
      </label>
    `;
  }).join("");

  priorityProductList.innerHTML = `
    <div class="priority-product-grid">
      ${rows || "<p class='helper'>No hay coincidencias para la búsqueda actual.</p>"}
    </div>
    <div class="selected-product-strip ${selectedCount ? "has-selection" : "empty"}">
      <div class="selected-product-strip-header">
        <span class="approval-kicker">Productos elegidos</span>
        <strong>${selectedCount ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}` : "Todavía no has elegido productos"}</strong>
      </div>
      <div class="selected-product-chip-row">
        ${selectedItems || "<p class='helper'>La selección aparecerá aquí, en la parte inferior, cuando marques productos.</p>"}
      </div>
    </div>
  `;
}

function setSelectedManualProducts(products) {
  selectedManualProducts = new Set((products || []).map((p) => String(p || "").trim()).filter(Boolean));
  renderPriorityProductList(priorityProductSearch?.value || "");
}

function buildTechnicalApprovalRows(caseData = {}) {
  const protocolMap = new Map((caseData.protocolos || []).map((item) => [String(item.producto || "").trim(), item]));
  const savedRows = new Map((caseData.technicalApprovalRows || []).map((row) => [String(row.producto || "").trim(), row]));

  return (caseData.priorityOneMatrix || [])
    .filter((item) => Number(item.prioridad || 0) === 1)
    .map((item) => {
      const protocol = protocolMap.get(String(item.producto || "").trim()) || null;
      const saved = savedRows.get(String(item.producto || "").trim()) || {};

      const suggestedVia = String(caseData.viaPreferida || "Agua").trim() || "Agua";
      const suggestedDose = protocol?.cantidadDiaTexto || protocol?.doseUnit || "Según ficha técnica";
      const suggestedDays = protocol?.duracionDias ? String(protocol.duracionDias) : "";
      const approvedVia = String(saved.viaAprobada || suggestedVia || "Agua").trim() || "Agua";
      const approvedDose = saved.doseText ?? saved.dosisAprobada ?? suggestedDose;
      const approvedDays = saved.daysText ?? saved.diasAprobados ?? suggestedDays;

      return {
        producto: item.producto,
        categoria: item.categoria,
        razon: item.razon,
        fuente: Array.isArray(item.fuentes) ? item.fuentes.join(" + ") : "",
        sugerido: protocol ? "Sí" : "Completar según ficha técnica",
        viaAprobada: approvedVia,
        dosisSugerida: suggestedDose,
        diasSugeridos: suggestedDays,
        dosisAprobada: approvedDose,
        diasAprobados: approvedDays,
        aprobado: Boolean(saved.aprobado),
        tieneReferencia: Boolean(protocol)
      };
    });
}

function getApprovedTechnicalProductNames() {
  return technicalApprovalRows
    .filter((row) => row.aprobado && String(row.viaAprobada || "").trim() && String(row.dosisAprobada || "").trim() && Number(row.diasAprobados) > 0)
    .map((row) => String(row.producto || "").trim())
    .filter(Boolean);
}

function hasCompleteTechnicalApproval(row) {
  return Boolean(
    row &&
    String(row.viaAprobada || "").trim() &&
    row.aprobado &&
    String(row.dosisAprobada || "").trim() &&
    Number(row.diasAprobados) > 0
  );
}

function buildFinancialSnapshot(protocolRows = [], payload = {}) {
  const investmentTotal = protocolRows.reduce((sum, protocol) => sum + Number(protocol?.costo || 0), 0);
  const animalesTratar = Number(payload.animalesTratar || 0);
  const pesoPromedio = Number(payload.pesoPromedio || 0);
  const costoAlimento = Number(payload.costoAlimento || 0);
  const precioCerdo = Number(payload.precioCerdo || 0);
  const ahorroMortalidad = animalesTratar * (DEFAULTS.reduccionMortalidadPctEscenario / 100) * pesoPromedio * precioCerdo;
  const ahorroFca = animalesTratar * DEFAULTS.mejoraFcaEscenario * DEFAULTS.kgGanadosEtapaEscenario * costoAlimento;
  const bet = ahorroMortalidad + ahorroFca + DEFAULTS.ahorroAntibioticosCopEscenario;
  const beneficioNeto = bet - investmentTotal;
  const roi = investmentTotal > 0 ? ((beneficioNeto / investmentTotal) * 100) : 0;
  const ratio = investmentTotal > 0 ? (bet / investmentTotal) : 0;

  return {
    ahorroMortalidad,
    ahorroFca,
    ahorroAntibioticos: DEFAULTS.ahorroAntibioticosCopEscenario,
    bet,
    inversionTotal: investmentTotal,
    beneficioNeto,
    roi,
    ratio,
    inversionPorCerdo: animalesTratar > 0 ? (investmentTotal / animalesTratar) : 0
  };
}

function rebuildApprovedCaseView() {
  if (!currentCaseData) return;

  const approvedRows = technicalApprovalRows.filter((row) => hasCompleteTechnicalApproval(row));
  const approvedNames = new Set(approvedRows.map((row) => String(row.producto || "").trim()).filter(Boolean));
  const approvalActive = Boolean(veterinaryApprovalConfirmed) && approvedNames.size > 0;
  const originalProtocols = Array.isArray(currentCaseData.protocolos) ? currentCaseData.protocolos : [];
  const originalPriorityOne = Array.isArray(currentCaseData.unifiedPriorityOne) ? currentCaseData.unifiedPriorityOne : [];
  const originalPriorityMatrix = Array.isArray(currentCaseData.priorityOneMatrix) ? currentCaseData.priorityOneMatrix : [];
  const approvedProtocols = approvalActive
    ? originalProtocols.filter((protocol) => approvedNames.has(String(protocol.producto || "").trim())).map((protocol) => {
        const row = approvedRows.find((item) => String(item.producto || "").trim() === String(protocol.producto || "").trim());
        if (!row) return protocol;

        const approvedDoseValue = Number.parseFloat(String(row.dosisAprobada || "0").replace(/[^0-9,.-]/g, "").replace(",", ".")) || Number(protocol.cantidadDia || 0);
        const approvedDays = Number(row.diasAprobados || protocol.duracionDias || 1);
        const route = String(row.viaAprobada || protocol.ruta || "").trim();

        return {
          ...protocol,
          ruta: route,
          duracionDias: approvedDays,
          cantidadDia: approvedDoseValue,
          cantidadDiaTexto: String(row.dosisAprobada || protocol.cantidadDiaTexto || ""),
          totalKg: approvedDoseValue * approvedDays,
          cantidadTotalTexto: `${approvedDoseValue * approvedDays} ${protocol.unidadDia || ""}`.trim(),
          costo: Math.max(Number(protocol.costo || 0) * (approvedDoseValue / Math.max(Number(protocol.cantidadDia || approvedDoseValue || 1), 1)) * (approvedDays / Math.max(Number(protocol.duracionDias || approvedDays || 1), 1)), 0),
          costoTexto: "Cotizar"
        };
      })
    : originalProtocols;

  const approvedPriorityOne = approvalActive
    ? originalPriorityOne.filter((item) => approvedNames.has(String(item.producto || "").trim()))
    : originalPriorityOne;

  const approvedPriorityMatrix = approvalActive
    ? originalPriorityMatrix.filter((item) => approvedNames.has(String(item.producto || "").trim()))
    : originalPriorityMatrix;

  currentCaseData.approvedTechnicalProducts = Array.from(approvedNames);
  currentCaseData.approvedProtocols = approvedProtocols;
  currentCaseData.approvedPriorityOne = approvedPriorityOne;
  currentCaseData.approvedPriorityOneMatrix = approvedPriorityMatrix;
  currentCaseData.approvedFinancial = approvalActive
    ? buildFinancialSnapshot(approvedProtocols, currentCaseData)
    : currentCaseData.financiero;
  currentCaseData.approvalResolved = approvalActive;
}

function isTechnicalApprovalComplete(row) {
  return Boolean(
    row &&
    String(row.viaAprobada || "").trim() &&
    row.aprobado &&
    String(row.dosisAprobada || "").trim() &&
    Number(row.diasAprobados) > 0
  );
}

function syncTechnicalApprovalRows(nextRows) {
  technicalApprovalRows = Array.isArray(nextRows) ? nextRows : [];
  if (currentCaseData) {
    currentCaseData.technicalApprovalRows = technicalApprovalRows;
  }
}

function rerenderCaseResult() {
  if (!currentCaseData) return;
  currentCaseData.technicalApprovalRows = technicalApprovalRows;
  renderResult(resultBox, currentCaseData);
}

function updateTechnicalApprovalRow(producto, patch = {}) {
  const productName = String(producto || "").trim();
  if (!productName) return;

  const rowIndex = technicalApprovalRows.findIndex((row) => String(row.producto || "").trim() === productName);
  if (rowIndex < 0) return;

  const nextRows = technicalApprovalRows.map((row) => ({ ...row }));
  nextRows[rowIndex] = { ...nextRows[rowIndex], ...patch };

  if (patch.aprobado && !isTechnicalApprovalComplete(nextRows[rowIndex])) {
    nextRows[rowIndex].aprobado = false;
    saveMessage.hidden = false;
    saveMessage.textContent = `Completa vía, dosis y días antes de aprobar ${productName}.`;
  }

  if (patch.viaAprobada && String(patch.viaAprobada).trim()) {
    nextRows[rowIndex].viaAprobada = String(patch.viaAprobada).trim();
  }

  syncTechnicalApprovalRows(nextRows);
  rerenderCaseResult();
}

function initializeTechnicalApprovalRows(caseData) {
  syncTechnicalApprovalRows(buildTechnicalApprovalRows(caseData));
}

function mountApprovalPanel() {
  if (!approvalPanel) return;
  const mountPoint = resultBox?.querySelector("#approvalMount");
  if (mountPoint && approvalPanel.parentElement !== mountPoint) {
    mountPoint.appendChild(approvalPanel);
  }
}

function resetApprovalState() {
  currentCaseData = null;
  technicalApprovalRows = [];
  veterinaryApprovalConfirmed = false;
  approvalPanel.classList.add("hidden");
  veterinaryApproval.checked = false;
  veterinaryNotes.value = "";
  approvalStatus.textContent = "Pendiente";
  approvalStatus.className = "status-badge status-pending";
}

function resetFormForNewCase() {
  form.reset();
  resultBox.innerHTML = "Sin cálculo todavía.";
  resultBox.classList.add("empty");
  newCaseBtn.hidden = true;
  saveMessage.hidden = true;
  saveMessage.textContent = "";
  resetApprovalState();

  const costoField = form.elements.costoAlimento;
  const precioField = form.elements.precioCerdo;
  if (costoField) costoField.value = String(DEFAULTS.costoAlimentoCopKg);
  if (precioField) precioField.value = String(DEFAULTS.precioCerdoCopKg);

  if (serviceLineInput?.value) {
    form.elements.lineaServicio.value = serviceLineInput.value;
  }

  setSelectedManualProducts([]);
  if (priorityProductSearch) priorityProductSearch.value = "";
  if (prioritySelectorPanel) prioritySelectorPanel.classList.remove("hidden");
  if (priceCatalogSection) priceCatalogSection.hidden = true;

  form.querySelector('input[name="cliente"]').focus();
}

function renderBioaraResponsibleList() {
  if (!bioaraResponsibleSelect) return;
  const team = bioaraResponsibleRoster.length ? bioaraResponsibleRoster : FALLBACK_BIOARA_RESPONSIBLES;
  const currentValue = bioaraResponsibleSelect.value;

  bioaraResponsibleSelect.innerHTML = `
    <option value="">Selecciona tu especialista BioARA</option>
    ${team.map((person) => `
      <option value="${person.email || ""}">${person.nombre || "Especialista BioARA"}</option>
    `).join("")}
  `;

  if (team.some((person) => (person.email || "") === currentValue)) {
    bioaraResponsibleSelect.value = currentValue;
  }
}

function parseCsvRow(rawLine) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < rawLine.length; i += 1) {
    const char = rawLine[i];
    if (char === '"') {
      if (insideQuotes && rawLine[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeSpanishText(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return "";

  const repaired = text
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/\s+/g, " ")
    .trim();

  return repaired;
}

async function loadBioaraResponsibleList() {
  const csvUrl = "./data/lista_correos_zonas.csv";

  try {
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el CSV");

    const csvText = await response.text();
    const rows = csvText.split(/\r?\n/).filter((line) => line.trim());
    const roster = rows.slice(1).map((line) => {
      const values = parseCsvRow(line);
      const email = (values[0] || "").replace(/^"|"$/g, "").trim();
      const rawName = (values[1] || "").replace(/^"|"$/g, "").trim();
      const normalizedEmail = email.toLowerCase();
      const officialName = OFFICIAL_BIOARA_NAMES_BY_EMAIL[normalizedEmail];
      const nombre = officialName || normalizeSpanishText(rawName) || "Responsable BioARA";
      return { nombre, email: email || "" };
    }).filter((person) => person.email && /@/.test(person.email));

    bioaraResponsibleRoster = [...new Map(roster.map((person) => [person.email.toLowerCase(), person])).values()];
  } catch (error) {
    console.warn("No se pudo cargar la nómina BioARA desde el CSV; se usó la lista local de respaldo.", error);
    bioaraResponsibleRoster = [...FALLBACK_BIOARA_RESPONSIBLES];
  }

  renderBioaraResponsibleList();
}

function getServiceLineLabel(line) {
  return SERVICE_LINE_LABELS[line] || "Porcicultura";
}

function isServiceAvailable(line) {
  return line === ACTIVE_SERVICE_LINE;
}

function updateServiceSelectorUi(activeLine) {
  if (!serviceLineSelector) return;

  const tiles = serviceLineSelector.querySelectorAll(".service-tile");
  tiles.forEach((tile) => {
    const tileLine = tile.dataset.serviceLine;
    const available = tile.dataset.available === "true";
    const selected = tileLine === activeLine;

    tile.classList.toggle("is-active", selected);
    tile.classList.toggle("is-coming", !available);
    tile.setAttribute("aria-pressed", selected ? "true" : "false");
    tile.setAttribute("aria-label", available ? `${getServiceLineLabel(tileLine)}, disponible` : `${getServiceLineLabel(tileLine)}, próxima disponibilidad`);

    const stateNode = tile.querySelector(".service-state");
    if (stateNode) {
      stateNode.textContent = selected ? "Activo" : available ? "Disponible" : "Próximamente";
    }
  });
}

function setServiceLine(nextLine, { persist = true, notifyUnavailable = false } = {}) {
  const normalized = String(nextLine || ACTIVE_SERVICE_LINE).trim().toLowerCase();
  const resolvedLine = isServiceAvailable(normalized) ? normalized : ACTIVE_SERVICE_LINE;

  if (serviceLineInput) {
    serviceLineInput.value = resolvedLine;
  }
  if (form?.elements?.lineaServicio) {
    form.elements.lineaServicio.value = resolvedLine;
  }

  updateServiceSelectorUi(resolvedLine);

  if (persist) {
    try {
      localStorage.setItem(SERVICE_STORAGE_KEY, resolvedLine);
    } catch (_) {
      // No bloquea en modo offline restringido.
    }
  }

  if (notifyUnavailable && !isServiceAvailable(normalized)) {
    saveMessage.hidden = false;
    saveMessage.textContent = `${getServiceLineLabel(normalized)} estará disponible en una próxima versión. Continuamos en Porcicultura.`;
  }
}

function initServiceLineSelector() {
  if (!serviceLineSelector || !serviceLineInput) return;

  let preferredLine = ACTIVE_SERVICE_LINE;
  try {
    preferredLine = localStorage.getItem(SERVICE_STORAGE_KEY) || ACTIVE_SERVICE_LINE;
  } catch (_) {
    preferredLine = ACTIVE_SERVICE_LINE;
  }

  setServiceLine(preferredLine, { persist: false, notifyUnavailable: false });

  serviceLineSelector.querySelectorAll(".service-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const requested = tile.dataset.serviceLine || ACTIVE_SERVICE_LINE;
      setServiceLine(requested, { persist: true, notifyUnavailable: true });
    });
  });
}

function toggleBiosecurityAreaField(challenge) {
  const normalized = String(challenge || form.elements.desafio?.value || "").trim().toLowerCase();
  const isBiosecurity = normalized === "bioseguridad";

  if (biosecurityAreaField) {
    biosecurityAreaField.hidden = !isBiosecurity;
  }

  if (biosecurityAreaInput) {
    biosecurityAreaInput.required = isBiosecurity;
    if (!isBiosecurity) {
      biosecurityAreaInput.value = "";
    }
  }
}

function payloadFromForm(fd) {
  return {
    lineaServicio: String(fd.get("lineaServicio") || ACTIVE_SERVICE_LINE).toLowerCase(),
    cliente: fd.get("cliente"),
    granja: fd.get("granja"),
    totalAnimalesCliente: Number(fd.get("totalAnimalesCliente")),
    animalesTratar: Number(fd.get("animalesTratar")),
    fase: fd.get("fase"),
    pesoPromedio: Number(fd.get("pesoPromedio")),
    edadDias: Number(fd.get("edadDias")),
    genetica: fd.get("genetica"),
    viaPreferida: fd.get("viaPreferida"),
    consumoAlimentoRealKgDia: Number(fd.get("consumoAlimentoRealKgDia") || 0),
    desafio: fd.get("desafio"),
    areaTratadaM2: Number(fd.get("areaTratadaM2") || 0),
    costoAlimento: Number(fd.get("costoAlimento")),
    precioCerdo: Number(fd.get("precioCerdo")),
    mortalidad: Number(fd.get("mortalidad")),
    fca: Number(fd.get("fca"))
  };
}

async function applyMarketDefaultsToForm() {
  const defaults = await refreshMarketDefaults();
  const costoField = form.elements.costoAlimento;
  const precioField = form.elements.precioCerdo;

  if (costoField) costoField.value = String(defaults.costoAlimentoCopKg);
  if (precioField) precioField.value = String(defaults.precioCerdoCopKg);
  renderPriceCatalog();
  // Permite que sheets-patch.js aplique precios JEV encima sin race condition
  window.dispatchEvent(new CustomEvent("bioara:benchmark-ready", { detail: defaults }));
}

async function refreshBenchmarkFromWeb() {
  if (!refreshBenchmarkBtn) return;

  refreshBenchmarkBtn.disabled = true;
  refreshBenchmarkBtn.textContent = "Actualizando...";

  try {
    const defaults = await refreshMarketDefaults();
    const costoField = form.elements.costoAlimento;
    const precioField = form.elements.precioCerdo;

    if (costoField) costoField.value = String(defaults.costoAlimentoCopKg);
    if (precioField) precioField.value = String(defaults.precioCerdoCopKg);

    renderPriceCatalog();
    saveMessage.textContent = `Benchmark actualizado: ${defaults.precioCerdoCopKg} COP/kg (${defaults.origenListaPrecios})`;
    saveMessage.hidden = false;
  } catch (error) {
    saveMessage.textContent = "No fue posible actualizar el benchmark; se conserva el último valor local.";
    saveMessage.hidden = false;
    console.error("refresh benchmark failed", error);
  } finally {
    refreshBenchmarkBtn.disabled = false;
    refreshBenchmarkBtn.textContent = "Actualizar benchmark";
  }
}

async function refreshHistory() {
  const rows = await listCases();
  renderHistory(historyBox, rows);
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const fd = new FormData(form);
  const payload = payloadFromForm(fd);

  if (!isServiceAvailable(payload.lineaServicio)) {
    saveMessage.hidden = false;
    saveMessage.textContent = `${getServiceLineLabel(payload.lineaServicio)} aún no está habilitada. Usa Porcicultura para continuar.`;
    setServiceLine(payload.lineaServicio, { persist: true, notifyUnavailable: true });
    return;
  }

  if (payload.desafio === "Bioseguridad") {
    if (!Number.isFinite(payload.areaTratadaM2) || payload.areaTratadaM2 <= 0) {
      saveMessage.hidden = false;
      saveMessage.textContent = "Para Bioseguridad debes indicar el área tratada en m² antes de calcular.";
      biosecurityAreaInput?.focus();
      return;
    }
  }

  const viaIncluyeAlimento = ["Alimento", "Agua+Alimento"].includes(String(payload.viaPreferida || "").trim());
  if (viaIncluyeAlimento && (!Number.isFinite(payload.consumoAlimentoRealKgDia) || payload.consumoAlimentoRealKgDia <= 0)) {
    saveMessage.hidden = false;
    saveMessage.textContent = "Cuando la vía incluye alimento, debes indicar el consumo real diario total del lote (kg/día) para todos los animales a tratar, no por animal.";
    form.elements.consumoAlimentoRealKgDia?.focus();
    return;
  }

  const calc = calculateCase(payload, {
    manualSelectedProducts: getManualSelectedProducts(),
    protocolRuleSet
  });
  const caseDate = new Date().toISOString();
  currentCaseData = { ...payload, ...calc, caseDate, reportGeneratedAt: caseDate };
  initializeTechnicalApprovalRows(currentCaseData);
  rebuildApprovedCaseView();
  renderResult(resultBox, currentCaseData);
  mountApprovalPanel();
  resultBox.classList.remove("empty");
  if (prioritySelectorPanel) prioritySelectorPanel.classList.remove("hidden");
  if (priceCatalogSection) priceCatalogSection.hidden = false;
  approvalPanel.classList.remove("hidden");
  approvalStatus.textContent = "Pendiente";
  approvalStatus.className = "status-badge status-pending";

  const now = caseDate;
  const id = `CASO-${Date.now()}`;

  const record = {
    id,
    fechaRegistro: now,
    syncStatus: navigator.onLine ? "pending" : "offline_pending",
    syncedAt: "",
    ...payload,
    aguaLoteDiaL: Number(calc.consumo.aguaLote.toFixed(2)),
    alimentoLoteDiaKg: Number(calc.consumo.alimLote.toFixed(2)),
    inversionTotalCop: Math.round(calc.financiero.inversionTotal),
    roiPct: Number(calc.financiero.roi.toFixed(2)),
    beneficioNetoCop: Math.round(calc.financiero.beneficioNeto),
    protocoloJson: JSON.stringify(calc.protocolos),
    prioridadUnoMatrixJson: JSON.stringify(calc.priorityOneMatrix || []),
    aprobacionTecnicaJson: JSON.stringify(technicalApprovalRows || []),
    reporteInternoJson: JSON.stringify(calc.internalSyncReport || {}),
    selectedCatalogProductsJson: JSON.stringify(getManualSelectedProducts())
  };

  await saveCase(record);
  await refreshHistory();
  newCaseBtn.hidden = false;
  saveMessage.textContent = `Caso guardado correctamente: ${record.id}`;
  saveMessage.hidden = false;
});

if (priorityProductSearch) {
  priorityProductSearch.addEventListener("input", (ev) => {
    renderPriorityProductList(ev.target.value || "");
  });
}

const challengeSelect = form.elements.desafio;
if (challengeSelect) {
  challengeSelect.addEventListener("change", (ev) => {
    toggleBiosecurityAreaField(ev.target.value);
  });
}

const viaPreferidaSelect = form.elements.viaPreferida;
const consumoAlimentoRealField = document.getElementById("consumoAlimentoRealField");
const consumoAlimentoRealInput = form.elements.consumoAlimentoRealKgDia;

function toggleFoodConsumptionField() {
  const selectedVia = String(viaPreferidaSelect?.value || "").trim();
  const shouldShow = ["Alimento", "Agua+Alimento"].includes(selectedVia);
  if (consumoAlimentoRealField) {
    consumoAlimentoRealField.hidden = !shouldShow;
  }
  if (consumoAlimentoRealInput) {
    consumoAlimentoRealInput.required = shouldShow;
    if (!shouldShow) {
      consumoAlimentoRealInput.value = "";
    }
  }
}

if (viaPreferidaSelect) {
  viaPreferidaSelect.addEventListener("change", toggleFoodConsumptionField);
  toggleFoodConsumptionField();
}

if (priorityProductList) {
  priorityProductList.addEventListener("change", (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.manualProduct == null) return;

    const productName = String(input.dataset.manualProduct || "").trim();
    if (!productName || !getProductByName(productName)) return;

    if (input.checked) {
      selectedManualProducts.add(productName);
    } else {
      selectedManualProducts.delete(productName);
    }

    renderPriorityProductList(priorityProductSearch?.value || "");
  });
}

if (resultBox) {
  resultBox.addEventListener("change", (ev) => {
    const input = ev.target;
    const isFieldInput = input instanceof HTMLInputElement || input instanceof HTMLSelectElement;
    if (!isFieldInput) return;
    const product = String(input.dataset.techApprovalProduct || "").trim();
    const field = String(input.dataset.techApprovalField || "").trim();
    if (!product || !field || !currentCaseData) return;

    const row = technicalApprovalRows.find((item) => String(item.producto || "").trim() === product);
    if (!row) return;

    const rowElement = input.closest("tr");
    const domVia = rowElement?.querySelector('[data-tech-approval-field="via"]')?.value ?? row.viaAprobada ?? "";
    const domDose = rowElement?.querySelector('[data-tech-approval-field="dose"]')?.value ?? row.dosisAprobada ?? "";
    const domDays = rowElement?.querySelector('[data-tech-approval-field="days"]')?.value ?? row.diasAprobados ?? "";

    if (field === "approved") {
      const nextApprovalState = {
        aprobado: input.checked,
        viaAprobada: String(domVia || "").trim(),
        dosisAprobada: String(domDose || "").trim(),
        diasAprobados: String(domDays || "").trim()
      };

      if (input.checked && !isTechnicalApprovalComplete({ ...row, ...nextApprovalState })) {
        input.checked = false;
        saveMessage.hidden = false;
        saveMessage.textContent = "El veterinario debe elegir vía, dosis y días antes de aprobar esta fila.";
        return;
      }

      updateTechnicalApprovalRow(product, nextApprovalState);
      refreshDetailGate();
      return;
    }

    if (field === "via") {
      updateTechnicalApprovalRow(product, { viaAprobada: input.value, aprobado: Boolean(row.aprobado) });
      refreshDetailGate();
      return;
    }

    if (field === "dose") {
      updateTechnicalApprovalRow(product, { dosisAprobada: input.value, aprobado: Boolean(row.aprobado) });
      refreshDetailGate();
      return;
    }

    if (field === "days") {
      updateTechnicalApprovalRow(product, { diasAprobados: input.value, aprobado: Boolean(row.aprobado) });
      refreshDetailGate();
    }
  });
}

veterinaryApproval.addEventListener("change", () => {
  if (!currentCaseData) return;
  veterinaryApprovalConfirmed = veterinaryApproval.checked;
  currentCaseData.veterinaryApprovalConfirmed = veterinaryApprovalConfirmed;
  approvalStatus.textContent = veterinaryApproval.checked ? "Aprobado" : "Pendiente";
  approvalStatus.className = veterinaryApproval.checked ? "status-badge status-approved" : "status-badge status-pending";
  renderResult(resultBox, currentCaseData);
  mountApprovalPanel();
});

function refreshDetailGate() {
  if (!currentCaseData) return;
  rebuildApprovedCaseView();
  const hasTechnicalValidation = Boolean(currentCaseData.approvalResolved);
  currentCaseData.veterinaryApprovalConfirmed = veterinaryApprovalConfirmed;
  currentCaseData.technicalApprovalRows = technicalApprovalRows;
  renderResult(resultBox, currentCaseData);
  mountApprovalPanel();

  const detailPanel = resultBox.querySelector("details.support-panel");
  if (detailPanel) {
    detailPanel.open = Boolean(veterinaryApprovalConfirmed && hasTechnicalValidation);
  }
}

if (approveDetailBtn) {
  approveDetailBtn.addEventListener("click", () => {
    if (!currentCaseData) return;
    const hasTechnicalValidation = technicalApprovalRows.some((row) => hasCompleteTechnicalApproval(row));
    if (!hasTechnicalValidation) {
      saveMessage.hidden = false;
      saveMessage.textContent = "Primero aprueba al menos una fila con vía, dosis y días válidos.";
      return;
    }

    veterinaryApproval.checked = true;
    veterinaryApprovalConfirmed = true;
    currentCaseData.veterinaryApprovalConfirmed = true;
    approvalStatus.textContent = "Aprobado";
    approvalStatus.className = "status-badge status-approved";
    refreshDetailGate();
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveAppAssetPath(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

async function getBrandLogosDataUrl() {
  try {
    const bioaraResponse = await fetch(resolveAppAssetPath("../logos/bioara.webp"));
    const bioaraBlob = await bioaraResponse.blob();
    const bioara = await readBlobAsDataUrl(bioaraBlob);
    return { bioara };
  } catch (error) {
    console.warn("No se pudieron cargar los logos para la propuesta, se usará texto plano.", error);
    return { bioara: "" };
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildApprovedSummaryHtml() {
  if (!currentCaseData) return "";

  const unified = currentCaseData.approvedPriorityOne || currentCaseData.unifiedPriorityOne || [];
  const p1 = unified.filter((item) => item.prioridad === 1);
  const p2 = unified.filter((item) => item.prioridad === 2);
  const noRec = currentCaseData.noRecomendados || [];
  const protocolos = currentCaseData.approvedProtocols || currentCaseData.protocolos || [];
  const commercialSuggestion = currentCaseData.commercialSuggestion || null;
  const client = currentCaseData.cliente || "Cliente";
  const granja = currentCaseData.granja || "Granja";
  const challenge = currentCaseData.desafio || "General";
  const caseDate = new Date(currentCaseData.caseDate || Date.now());
  const serviceLine = getServiceLineLabel(currentCaseData.lineaServicio || ACTIVE_SERVICE_LINE);
  const reportDate = new Date(currentCaseData.reportGeneratedAt || Date.now());
  const caseDateText = caseDate.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  const reportDateText = reportDate.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

  const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));

  const p1Html = p1.map((item) => `
    <li>
      <strong>${escapeHtml(item.producto)}</strong> — ${escapeHtml(item.categoria)}<br>
      <span>${escapeHtml(item.razon)}</span>
    </li>
  `).join("") || "<li>Sin recomendación prioritaria definida.</li>";

  const p2Html = p2.map((item) => `
    <li>
      <strong>${escapeHtml(item.producto)}</strong> — ${escapeHtml(item.categoria)}<br>
      <span>${escapeHtml(item.razon)}</span>
    </li>
  `).join("") || "<li>No requiere soporte adicional.</li>";

  const commercialSuggestionHtml = commercialSuggestion
    ? `
      <div class="section-box commercial-suggestion">
        <h3>${escapeHtml(commercialSuggestion.title)}</h3>
        <p class="commercial-headline">${escapeHtml(commercialSuggestion.headline)}</p>
        <p>${escapeHtml(commercialSuggestion.benefit)}</p>
        <p><strong>Por qué aplica:</strong> ${escapeHtml(commercialSuggestion.reason)}</p>
        <p><strong>Acción sugerida:</strong> ${escapeHtml(commercialSuggestion.callToAction)}</p>
        <div class="commercial-badges">
          ${(commercialSuggestion.badges || []).map((badge) => `<span class="commercial-badge">${escapeHtml(badge)}</span>`).join("")}
        </div>
        ${commercialSuggestion.secondary ? `
          <div class="commercial-secondary">
            <h4>Complemento recomendado</h4>
            <p><strong>${escapeHtml(commercialSuggestion.secondary.headline)}</strong></p>
            <p>${escapeHtml(commercialSuggestion.secondary.benefit)}</p>
            <p>${escapeHtml(commercialSuggestion.secondary.reason)}</p>
          </div>
        ` : ""}
        <p class="commercial-closing">Acompañe esta recomendación con su asesor de BioARA para convertirla en un plan de acción rentable y asegurar el mejor resultado para el lote.</p>
      </div>
    `
    : `<div class="section-box commercial-suggestion"><h3>Sugerencia técnica</h3><p>No disponible para este caso.</p></div>`;

  const noRecHtml = noRec.map((item) => `
    <li>
      <strong>${escapeHtml(item.categoria)}</strong><br>
      <span>${escapeHtml(item.razon)}</span>
    </li>
  `).join("") || "<li>No aplica.</li>";

  const protocolRows = protocolos.map((item) => `
    <tr>
      <td>${escapeHtml(item.producto)}</td>
      <td>${escapeHtml(item.ruta)}</td>
      <td>${escapeHtml(item.doseUnit || item.dosisUnidad)}</td>
      <td>${escapeHtml(item.cantidadDiaTexto || `${Number(item.cantidadDia || 0).toFixed(3)} ${item.unidadDia || ""}`)}</td>
      <td>${escapeHtml(item.duracionDias)}</td>
      <td>${escapeHtml(item.cantidadTotalTexto || `${Number(item.totalKg || 0).toFixed(3)} ${String(item.unidadDia || "").replace(/\/dia$/i, "")}`)}</td>
      <td>${escapeHtml(item.costoTexto || money(item.costo || 0))}</td>
    </tr>
  `).join("") || "<tr><td colspan='7'>Sin protocolo disponible para este caso.</td></tr>";

  const financial = currentCaseData.approvedFinancial || currentCaseData.financiero || {};

  const summaryCards = `
    <div class="summary-grid">
      <div class="summary-card">
        <span>Animales a tratar</span>
        <strong>${Number(currentCaseData.animalesTratar || 0).toLocaleString("es-CO")}</strong>
      </div>
      ${challenge === "Bioseguridad" && areaTratadaM2 > 0 ? `
      <div class="summary-card">
        <span>Área tratada</span>
        <strong>${areaTratadaM2.toFixed(2)} m²</strong>
      </div>
      ` : ""}
      <div class="summary-card">
        <span>Agua lote/día</span>
        <strong>${Number(currentCaseData.consumo.aguaLote || 0).toFixed(2)} L</strong>
      </div>
      <div class="summary-card">
        <span>Alimento lote/día</span>
        <strong>${Number(currentCaseData.consumo.alimLote || 0).toFixed(2)} kg</strong>
      </div>
      <div class="summary-card">
        <span>Inversión total</span>
        <strong>${money(financial.inversionTotal)}</strong>
      </div>
      <div class="summary-card">
        <span>ROI</span>
        <strong>${Number(financial.roi || 0).toFixed(2)}%</strong>
      </div>
      <div class="summary-card">
        <span>Relación B/C</span>
        <strong>${Number(financial.ratio || 0).toFixed(2)} : 1</strong>
      </div>
    </div>
  `;

  const bioaraLogoMarkup = currentCaseData.logoDataUrl
    ? `<img src="${currentCaseData.logoDataUrl}" alt="BioARA" style="width: 125px; height: auto; border-radius: 12px; background: #f3faf7; padding: 8px; border: 1px solid #dbeae4;" />`
    : `<div style="width: 125px; height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: #f3faf7; border: 1px solid #dbeae4; color: #0b5d47; font-weight: 700;">BioARA</div>`;

  const veterinaryNote = escapeHtml(veterinaryNotes.value || "Sin observaciones adicionales.");

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Propuesta BioARA AI</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            background: #edf6f2;
            color: #16352f;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            max-width: 980px;
            margin: 0 auto;
            background: linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%);
            padding: 26px 30px 24px;
            box-shadow: 0 16px 32px rgba(12, 64, 51, 0.08);
          }
          .brand-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            border-bottom: 3px solid #0b5d47;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .brand-left {
            display: grid;
            grid-template-columns: 210px minmax(0, 1fr);
            align-items: center;
            gap: 20px;
            flex: 1;
            min-width: 0;
          }
          .brand-badges {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 210px;
            min-width: 210px;
            flex: 0 0 210px;
          }
          .brand-badges img,
          .brand-badges div {
            display: block;
            flex: 0 0 auto;
          }
          .brand-title {
            min-width: 0;
          }
          .brand-title h1 {
            max-width: 100%;
          }
          .brand-kicker {
            font-size: 12px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            font-weight: 700;
            color: #497067;
          }
          h1 {
            margin: 4px 0 0;
            font-size: 27px;
            line-height: 1.1;
            color: #0b5d47;
            font-weight: 800;
          }
          .status-pill {
            background: linear-gradient(135deg, #dff5ea, #cfece0);
            color: #0d5e47;
            border: 1px solid #b9ddca;
            border-radius: 999px;
            padding: 8px 16px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            white-space: nowrap;
            align-self: flex-start;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(220px, 1fr));
            gap: 10px 18px;
            font-size: 13px;
            line-height: 1.45;
            margin: 18px 0 20px;
            color: #20463d;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(150px, 1fr));
            gap: 12px;
            margin: 18px 0 20px;
          }
          .summary-card {
            background: linear-gradient(135deg, #f4faf7, #ebf5ef);
            border: 1px solid #dfece7;
            border-radius: 12px;
            padding: 12px 14px;
            min-height: 78px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .summary-card span {
            display: block;
            font-size: 9px;
            letter-spacing: 0.13em;
            text-transform: uppercase;
            color: #5a7b72;
            margin-bottom: 6px;
          }
          .summary-card strong {
            font-size: 17px;
            line-height: 1.2;
            color: #18362d;
          }
          h2 {
            margin: 20px 0 10px;
            font-size: 21px;
            color: #0b5d47;
            font-weight: 800;
          }
          .section-box {
            background: linear-gradient(180deg, #f8fbf9 0%, #f2f9f5 100%);
            border: 1px solid #dfece7;
            border-radius: 10px;
            padding: 14px 16px;
            margin-top: 6px;
          }
          ul {
            margin: 0;
            padding-left: 18px;
          }
          li {
            margin-bottom: 9px;
            line-height: 1.45;
            color: #1a352f;
          }
          .note {
            margin-top: 20px;
            background: linear-gradient(135deg, #eef8f3, #edf6f1);
            border-left: 5px solid #0b5d47;
            border-radius: 0 12px 12px 0;
            padding: 14px 16px;
            line-height: 1.5;
            color: #16352f;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #d9e6e0;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #edf7f2;
            color: #0b5d47;
            font-weight: 700;
          }
          .footer {
            margin-top: 20px;
            border-top: 1px solid #dfece7;
            padding-top: 12px;
            color: #496760;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          @media print {
            body { background: #fff; }
            .page { box-shadow: none; padding: 12px; }
            .brand-left {
              grid-template-columns: 194px minmax(0, 1fr);
              gap: 16px;
            }
            .brand-badges {
              width: 194px;
              min-width: 194px;
              gap: 10px;
            }
            .brand-badges img,
            .brand-badges div {
              transform-origin: left center;
            }
            h1 {
              font-size: 25px;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="brand-header">
            <div class="brand-left">
              <div class="brand-badges">
                ${bioaraLogoMarkup}
              </div>
              <div class="brand-title">
                <div class="brand-kicker">BioARA AI</div>
                <h1>Propuesta técnica veterinaria</h1>
              </div>
            </div>
            <div class="status-pill">Caso aprobado</div>
          </div>

          <div class="meta">
            <div><strong>Línea de servicio:</strong> ${escapeHtml(serviceLine)}</div>
            <div><strong>Cliente:</strong> ${escapeHtml(client)}</div>
            <div><strong>Granja:</strong> ${escapeHtml(granja)}</div>
            <div><strong>Desafío principal:</strong> ${escapeHtml(challenge)}</div>
            ${challenge === "Bioseguridad" && areaTratadaM2 > 0 ? `<div><strong>Área tratada:</strong> ${escapeHtml(areaTratadaM2.toFixed(2))} m²</div>` : ""}
            <div><strong>Fase:</strong> ${escapeHtml(currentCaseData.fase || "General")}</div>
            <div><strong>Fecha del caso:</strong> ${escapeHtml(caseDateText)}</div>
            <div><strong>Fecha de generación:</strong> ${escapeHtml(reportDateText)}</div>
            <div><strong>Correo de contacto:</strong> business@poultryia.com</div>
            <div><strong>Vía de referencia del caso:</strong> ${escapeHtml(currentCaseData.viaPreferida || "Definir por criterio veterinario")}</div>
          </div>

          ${summaryCards}

          <h2>Prioridad 1 - Base de acción</h2>
          <div class="section-box">
            <ul>${p1Html}</ul>
          </div>

          <h2>Soporte adicional</h2>
          <div class="section-box">
            <ul>${p2Html}</ul>
          </div>

          <h2>Sugerencia técnica</h2>
          ${commercialSuggestionHtml}

          <h2>Resumen técnico del caso</h2>
          <div class="section-box">
            <ul>
              <li><strong>Peso promedio:</strong> ${Number(currentCaseData.pesoPromedio || 0).toFixed(1)} kg</li>
              <li><strong>Edad:</strong> ${Number(currentCaseData.edadDias || 0).toFixed(0)} días</li>
              <li><strong>Agua lote/día:</strong> ${Number(currentCaseData.consumo.aguaLote || 0).toFixed(2)} L</li>
              <li><strong>Alimento lote/día:</strong> ${Number(currentCaseData.consumo.alimLote || 0).toFixed(2)} kg</li>
              <li><strong>Inversión total:</strong> ${money(financial.inversionTotal)}</li>
              <li><strong>Beneficio neto:</strong> ${money(financial.beneficioNeto)}</li>
              <li><strong>ROI:</strong> ${Number(financial.roi || 0).toFixed(2)}%</li>
              <li><strong>Relación beneficio/costo:</strong> ${Number(financial.ratio || 0).toFixed(2)} : 1</li>
            </ul>
          </div>

          <h2>Protocolo recomendado</h2>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Ruta</th>
                <th>Dosis</th>
                <th>Cantidad diaria</th>
                <th>Días</th>
                <th>Total tratamiento</th>
                <th>Inversión</th>
              </tr>
            </thead>
            <tbody>${protocolRows}</tbody>
          </table>

          <h2>Elementos a evitar / no recomendados</h2>
          <div class="section-box">
            <ul>${noRecHtml}</ul>
          </div>

          <div class="note">
            <strong>Observaciones del veterinario:</strong><br />
            ${veterinaryNote}
          </div>

          <div class="footer">
            <div><strong>BioARA</strong> — Soluciones para salud, nutrición y productividad porcina</div>
            <div>business@poultryia.com</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function printApprovedPdf() {
  if (!currentCaseData) return;

  saveMessage.hidden = false;
  saveMessage.textContent = "Generando propuesta PDF con contexto y branding...";

  const { bioara } = await getBrandLogosDataUrl();
  currentCaseData.logoDataUrl = bioara;

  const html = buildApprovedSummaryHtml();
  const iframe = document.createElement("iframe");
  iframe.id = "bioaraPrintFrame";
  iframe.setAttribute("title", "BioARA PDF preview");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-9999px";
  iframe.style.top = "-9999px";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  requestAnimationFrame(() => {
    try {
      iframe.focus();
      iframe.contentWindow?.print();
      saveMessage.textContent = "PDF listo para imprimir o guardar desde la vista previa del navegador.";
    } catch (error) {
      console.warn("La impresión con iframe falló; intentamos fallback con ventana emergente.", error);
      const printWindow = window.open('', '_blank', 'width=1200,height=900');
      if (!printWindow) {
        saveMessage.textContent = "El navegador bloqueó la impresión. Permite pop-ups o usa la opción de guardar PDF desde el menú del navegador.";
        alert("El navegador bloqueó la impresión. Permite pop-ups o usa la opción de guardar PDF desde el menú del navegador.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      saveMessage.textContent = "PDF listo para imprimir. Acepta la impresión en la ventana emergente si el navegador la solicita.";
    }
  });
}

async function sendApprovedEmail() {
  if (!currentCaseData) return;

  const recipientClient = String(form.elements.emailCliente?.value || "").trim();
  const officialDemoMail = "business@poultryia.com";
  const selectedResponsibleEmail = String(bioaraResponsibleSelect?.value || officialDemoMail).trim();

  saveMessage.hidden = false;
  saveMessage.textContent = "Enviando propuesta por correo...";
  sendEmailBtn.disabled = true;

  // --- Intento 1: backend real vía API ---
  try {
    const backendPayload = {
      ...currentCaseData,
      emailCliente: recipientClient || officialDemoMail,
      emailBioara: selectedResponsibleEmail || officialDemoMail,
      veterinaryNotes: veterinaryNotes.value || "Sin observaciones adicionales",
      consumoAlimentoRealKgDia: Number(currentCaseData.consumoAlimentoRealKgDia || 0),
      inversionTotalCop: Math.round(currentCaseData.financiero?.inversionTotal || 0),
      roiPct: Number(currentCaseData.financiero?.roi || 0)
    };

    const caseResp = await fetch("/api/porc/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendPayload),
      signal: AbortSignal.timeout(8000)
    });

    if (caseResp.ok) {
      const caseResult = await caseResp.json();
      const caseId = caseResult.case?.id;

      if (caseId) {
        const approvedRows = (currentCaseData.technicalApprovalRows || []).filter(
          (row) => row.aprobado && String(row.viaAprobada || "").trim()
        );
        const mainApproval = approvedRows[0] || {};

        await fetch(`/api/porc/cases/${caseId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            veterinarianName: "Médico Veterinario BioARA",
            viaAprobada: String(mainApproval.viaAprobada || currentCaseData.viaPreferida || "Agua"),
            dosisAprobada: String(mainApproval.dosisAprobada || "Según protocolo"),
            diasAprobados: Number(mainApproval.diasAprobados || 7),
            observaciones: veterinaryNotes.value || "Sin observaciones adicionales"
          }),
          signal: AbortSignal.timeout(5000)
        });

        const pdfResp = await fetch(`/api/porc/cases/${caseId}/render-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000)
        });

        if (pdfResp.ok) {
          const emailResp = await fetch(`/api/porc/cases/${caseId}/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000)
          });

          if (emailResp.ok) {
            const emailResult = await emailResp.json();
            const isDryRun = emailResult.email?.provider === "dry_run";
            saveMessage.textContent = isDryRun
              ? `Correo registrado (modo demo sin SMTP activo). Caso: ${caseId}`
              : `Correo enviado correctamente a ${recipientClient || officialDemoMail} desde business@poultryia.com. Caso: ${caseId}`;
            sendEmailBtn.disabled = false;
            return;
          }
        }
      }
    }
  } catch (backendError) {
    console.warn("Backend no disponible; usando fallback mailto.", backendError);
  }

  // --- Fallback: descarga HTML + mailto ---
  const recipientBioara = String(form.elements.emailBioara?.value || officialDemoMail).trim();
  const toRecipients = Array.from(new Set(
    [recipientClient, officialDemoMail].filter((e) => Boolean(e) && /@/.test(e))
  ));
  const ccRecipients = Array.from(new Set(
    [selectedResponsibleEmail, recipientBioara, officialDemoMail].filter((e) => Boolean(e) && /@/.test(e))
  ));

  const caseDate = new Date(currentCaseData.caseDate || Date.now()).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  const reportDate = new Date(currentCaseData.reportGeneratedAt || Date.now()).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  const subject = encodeURIComponent(`Propuesta técnica BioARA AI - ${currentCaseData.cliente || "Cliente"}`);
  const pdfFileName = `propuesta_${String(currentCaseData.cliente || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "_") || "bioara"}.pdf`;

  const reportHtml = buildApprovedSummaryHtml();
  const pdfBlob = new Blob([reportHtml], { type: "text/html" });
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  anchor.href = pdfUrl;
  anchor.download = pdfFileName;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => { URL.revokeObjectURL(pdfUrl); anchor.remove(); }, 1500);

  const body = encodeURIComponent(
    `Estimado/a:\n\nAdjunto la propuesta técnica del caso de ${currentCaseData.cliente || "Cliente"} en la granja ${currentCaseData.granja || "Granja"}.\n` +
    `Fecha del caso: ${caseDate}\nFecha de generación: ${reportDate}\n\n` +
    `Prioridad 1:\n${(currentCaseData.unifiedPriorityOne || []).filter((i) => i.prioridad === 1).map((i) => `- ${i.producto} (${i.categoria})`).join("\n")}\n\n` +
    `Inversión total: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(currentCaseData.financiero?.inversionTotal || 0)}\n` +
    `ROI: ${Number(currentCaseData.financiero?.roi || 0).toFixed(2)}%\n\n` +
    `Observaciones: ${veterinaryNotes.value || "Sin observaciones adicionales."}\n\nSaludos,\nEquipo BioARA AI`
  );

  const mailtoUrl = `mailto:${toRecipients.join(",")}?cc=${encodeURIComponent(ccRecipients.join(","))}&subject=${subject}&body=${body}`;
  const fallbackText = `Para: ${toRecipients.join(", ")}\nCC: ${ccRecipients.join(", ")}\nAsunto: ${decodeURIComponent(subject)}\n\n${decodeURIComponent(body)}`;

  saveMessage.textContent = "Abriendo cliente de correo del dispositivo...";

  try {
    const popup = window.open(mailtoUrl, "_blank", "noopener,noreferrer");
    if (popup) {
      saveMessage.textContent = "Se abrió el cliente de correo. El HTML de la propuesta quedó descargado para adjuntarlo.";
      setTimeout(() => popup.close(), 1500);
      sendEmailBtn.disabled = false;
      return;
    }
  } catch (_) { /* ignorado */ }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(fallbackText);
      saveMessage.textContent = "No hubo cliente de correo disponible. El texto fue copiado al portapapeles.";
      alert("No hay cliente de correo disponible. El mensaje se copió al portapapeles.");
      sendEmailBtn.disabled = false;
      return;
    }
  } catch (_) { /* ignorado */ }

  saveMessage.textContent = "No hubo cliente de correo disponible. Copia el mensaje manualmente.";
  alert("No hay cliente de correo disponible en este dispositivo.\nCopiar a: " + recipientBioara + "\n\n" + fallbackText);
  sendEmailBtn.disabled = false;
}

newCaseBtn.addEventListener("click", () => {
  resetFormForNewCase();
  saveMessage.textContent = "Nuevo caso listo para ingresar datos.";
  saveMessage.hidden = false;
});

printPdfBtn.addEventListener("click", printApprovedPdf);
sendEmailBtn.addEventListener("click", sendApprovedEmail);

refreshBenchmarkBtn.addEventListener("click", async () => {
  await refreshBenchmarkFromWeb();
});

syncBtn.addEventListener("click", async () => {
  const count = await markAllSynced();
  await refreshHistory();
  alert(`Sincronizacion demo completada. Registros sincronizados: ${count}`);
});

exportBtn.addEventListener("click", async () => {
  const rows = await listCases();
  downloadCsv("bioara_casos_v1.csv", rows);
});

window.addEventListener("online", updateNetworkBadge);
window.addEventListener("offline", updateNetworkBadge);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((registration) => registration.unregister()));
  }).then(() => {
    return navigator.serviceWorker.register("./sw.js?v=20260812r2");
  }).catch(() => {
    // En demo no bloquea la app si falla el registro.
  });
}

updateNetworkBadge();
initServiceLineSelector();
renderPriorityProductList();
loadBioaraResponsibleList();
applyMarketDefaultsToForm();
refreshHistory();
resetFormForNewCase();
toggleBiosecurityAreaField(form.elements.desafio?.value);
if (prioritySelectorPanel) prioritySelectorPanel.classList.remove("hidden");
