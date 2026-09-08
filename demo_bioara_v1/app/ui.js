export function renderResult(container, data) {
  const {
    consumo,
    protocolos,
    financiero,
    protocoloUso,
    recomendaciones,
    bioAraRecommendations,
    noRecomendados,
    matrizFase,
    unifiedPriorityOne,
    priorityOneMatrix,
    technicalApprovalRows = [],
    approvedProtocols = [],
    approvedPriorityOne = [],
    approvedFinancial = null,
    appliedProtocolRules,
    commercialSuggestion,
    veterinaryApprovalConfirmed,
    fmt
  } = data;
  const rows = protocolos.map((p) => `
    <tr>
      <td>${p.producto}</td>
      <td>${p.ruta}</td>
      <td>${p.doseUnit || p.dosisUnidad}</td>
      <td>${p.cantidadDiaTexto || `${p.cantidadDia.toFixed(3)} ${p.unidadDia}`}</td>
      <td>${p.duracionDias}</td>
      <td>${p.cantidadTotalTexto || `${p.totalKg.toFixed(3)} ${p.unidadDia.replace(/\/dia$/i, "")}`}</td>
      <td>${p.costoTexto || fmt.toMoney(p.costo)}</td>
    </tr>
  `).join("");

  const protocolItems = protocoloUso.map((item) => `<li>${item}</li>`).join("");
  const recommendationItems = recomendaciones.map((item) => `<li>${item}</li>`).join("");

  const prioritySource = (unifiedPriorityOne || bioAraRecommendations || []);
  const technicalApprovalComplete = technicalApprovalRows.filter((row) => row.aprobado && String(row.dosisAprobada || "").trim() && Number(row.diasAprobados) > 0);
  const approvalReady = technicalApprovalComplete.length > 0 && Boolean(veterinaryApprovalConfirmed);
  const finalPrioritySource = approvalReady && approvedPriorityOne.length ? approvedPriorityOne : prioritySource.filter((item) => item.prioridad === 1);
  const finalProtocols = approvalReady && approvedProtocols.length ? approvedProtocols : protocolos;
  const finalFinancial = approvalReady && approvedFinancial ? approvedFinancial : financiero;

  const priority1Items = finalPrioritySource.map((item) => `
    <li>
      <strong>${item.producto}</strong> (${item.categoria})<br>
      <small>${item.razon}</small>
    </li>
  `).join("");

  const supportItems = prioritySource.filter((item) => item.prioridad === 2).map((item) => `
    <li>
      <strong>${item.producto}</strong> (${item.categoria})<br>
      <small>${item.razon}</small>
    </li>
  `).join("");

  const commercialSuggestionHtml = commercialSuggestion
    ? `
      <div class="summary-section commercial-suggestion">
        <h4>${commercialSuggestion.title}</h4>
        <p class="commercial-headline">${commercialSuggestion.headline}</p>
        <p>${commercialSuggestion.benefit}</p>
        <p><strong>Por qué aplica:</strong> ${commercialSuggestion.reason}</p>
        <div class="commercial-badges">
          ${(commercialSuggestion.badges || []).map((badge) => `<span class="commercial-badge">${badge}</span>`).join("")}
        </div>
        <p><strong>Acción sugerida:</strong> ${commercialSuggestion.callToAction}</p>
        ${commercialSuggestion.secondary ? `
          <div class="commercial-secondary">
            <h5>Complemento recomendado</h5>
            <p><strong>${commercialSuggestion.secondary.headline}</strong></p>
            <p>${commercialSuggestion.secondary.benefit}</p>
            <p>${commercialSuggestion.secondary.reason}</p>
          </div>
        ` : ""}
        <p class="commercial-closing">Acompañe esta recomendación con su asesor de BioARA para convertirla en un plan de acción rentable y asegurar el mejor resultado para el lote.</p>
      </div>
    `
    : `<div class="summary-section commercial-suggestion"><h4>Sugerencia técnica</h4><p>No hay sugerencia disponible para este caso.</p></div>`;

  const supportMarkup = supportItems
    ? `<details class="support-panel"><summary>Soporte adicional</summary><ul>${supportItems}</ul></details>`
    : `<details class="support-panel"><summary>Soporte adicional</summary><ul><li>No requiere soporte adicional en esta recomendación.</li></ul></details>`;

  const noRecommendedItems = (noRecomendados || []).map((item) => `
    <li>
      <strong>${item.categoria}</strong><br>
      <small>${item.razon}</small>
    </li>
  `).join("");
  const faseItems = matrizFase.recomendacionesFase.map((item) => `<li>${item}</li>`).join("");
  const alertRows = matrizFase.alertas.map((a) => {
    const icon = a.tipo === "critica" ? "[ALERTA]" : "[OK]";
    return `<li><strong>${icon}</strong> ${a.mensaje}</li>`;
  }).join("");

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const technicalApprovalTableRows = technicalApprovalRows.map((row) => {
    const rowReady = row.aprobado && String(row.dosisAprobada || "").trim() && Number(row.diasAprobados) > 0;
    return `
      <tr class="${rowReady ? "is-approved" : row.aprobado ? "is-partial" : "is-pending"}">
        <td class="approval-checkbox-cell">
          <input type="checkbox" data-tech-approval-product="${escapeHtml(row.producto)}" data-tech-approval-field="approved" ${row.aprobado ? "checked" : ""} aria-label="Aprobar ${escapeHtml(row.producto)}" />
        </td>
        <td>
          <strong>${row.producto}</strong>
          <div class="approval-cell-note">${row.razon || "Revisión clínica prioritaria"}</div>
        </td>
        <td>
          <div class="approval-reference">${row.tieneReferencia ? `${row.dosisSugerida} · ${row.diasSugeridos || "ND"} días` : row.sugerido}</div>
          <input type="text" class="approval-input" data-tech-approval-product="${escapeHtml(row.producto)}" data-tech-approval-field="dose" value="${escapeHtml(row.dosisAprobada || "")}" placeholder="Dosis aprobada" />
        </td>
        <td>
          <input type="number" class="approval-input approval-days-input" data-tech-approval-product="${escapeHtml(row.producto)}" data-tech-approval-field="days" value="${escapeHtml(row.diasAprobados || "")}" min="1" step="1" placeholder="Días" />
        </td>
        <td>
          <span class="approval-row-status ${rowReady ? "status-approved" : row.aprobado ? "status-partial" : "status-pending"}">
            ${rowReady ? "Aprobado" : row.aprobado ? "Completar" : "Pendiente"}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  const technicalApprovalSummary = technicalApprovalComplete.length
    ? `
      <div class="approval-summary-strip">
        <strong>Validaciones activas:</strong>
        ${technicalApprovalComplete.map((row) => `<span class="approval-summary-chip">${row.producto} · ${escapeHtml(row.dosisAprobada)} · ${row.diasAprobados} días</span>`).join("")}
      </div>
    `
    : `<p class="helper approval-hint">La grilla queda lista para que el técnico apruebe producto, dosis y días. Cuando al menos una fila quede validada, se despliega el detalle completo.</p>`;
  const areaTratadaM2 = Number(data.areaTratadaM2 || 0);
  const showAreaSummary = data.desafio === "Bioseguridad" && areaTratadaM2 > 0;

  const executiveSummary = document.createElement("div");
  executiveSummary.className = "executive-summary";
  executiveSummary.innerHTML = `
    <div class="summary-header">
      <div>
        <span class="summary-kicker">Recomendación prioritaria</span>
        <h3>Prioridad 1</h3>
      </div>
    </div>
    <div class="technical-approval-card">
      <div class="technical-approval-card-header">
        <h4>Verificación y aceptación técnica</h4>
        <p>El técnico valida el producto, la dosis aprobada y los días antes de desplegar el detalle completo del cálculo.</p>
      </div>
      <div class="technical-approval-table-wrap">
        <table class="technical-approval-table">
          <thead>
            <tr>
              <th>Aprobar</th>
              <th>Producto y sustento</th>
              <th>Dosis</th>
              <th>Días</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${technicalApprovalTableRows || "<tr><td colspan='5'>Sin productos de prioridad 1 para aprobar.</td></tr>"}</tbody>
        </table>
      </div>
      ${technicalApprovalSummary}
    </div>
    <div id="approvalMount"></div>
    <ul class="summary-main-list">${priority1Items || "<li>Sin productos de prioridad principal para este caso.</li>"}</ul>
    <div class="summary-section">
      <h4>Resumen técnico</h4>
      <ul>
        <li><strong>Agua lote/día:</strong> ${consumo.aguaLote.toFixed(2)} L</li>
        ${showAreaSummary ? `<li><strong>Área tratada:</strong> ${areaTratadaM2.toFixed(2)} m²</li>` : ""}
        <li><strong>Alimento lote/día:</strong> ${consumo.alimLote.toFixed(2)} kg</li>
        <li><strong>Inversión total:</strong> ${fmt.toMoney(financiero.inversionTotal)}</li>
        <li><strong>ROI:</strong> ${financiero.roi.toFixed(2)}%</li>
        <li><strong>Fase:</strong> ${matrizFase.fase}</li>
      </ul>
    </div>
    <div class="summary-section">
      <h4>No recomendado</h4>
      <ul>${noRecommendedItems || "<li>No hay restricciones de prioridad claramente indicadas para este caso.</li>"}</ul>
    </div>
    <details class="support-panel" ${approvalReady ? "open" : ""}>
      <summary>Detalle expandible</summary>
      <div class="detail-depth">
        <h3>Detalle completo</h3>
        ${technicalApprovalComplete.length ? `
          <div class="detail-approval-strip">
            <strong>Aprobado por el técnico:</strong>
            ${technicalApprovalComplete.map((row) => `<span class="approval-summary-chip">${row.producto} · ${escapeHtml(row.dosisAprobada)} · ${row.diasAprobados} días</span>`).join("")}
          </div>
        ` : ""}
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Ruta</th>
              <th>Dosis</th>
              <th>Cantidad diaria</th>
              <th>Dias</th>
              <th>Total tratamiento</th>
              <th>Inversión</th>
            </tr>
          </thead>
          <tbody>${approvalReady && finalProtocols.length ? finalProtocols.map((p) => `
            <tr>
              <td>${escapeHtml(p.producto)}</td>
              <td>${escapeHtml(p.ruta)}</td>
              <td>${escapeHtml(p.doseUnit || p.dosisUnidad)}</td>
              <td>${escapeHtml(p.cantidadDiaTexto || `${Number(p.cantidadDia || 0).toFixed(3)} ${p.unidadDia || ""}`)}</td>
              <td>${escapeHtml(p.duracionDias)}</td>
              <td>${escapeHtml(p.cantidadTotalTexto || `${Number(p.totalKg || 0).toFixed(3)} ${String(p.unidadDia || "").replace(/\/dia$/i, "")}`)}</td>
              <td>${escapeHtml(p.costoTexto || fmt.toMoney(p.costo || 0))}</td>
            </tr>
          `).join("") : rows}</tbody>
        </table>
        <p><strong>Inversión por cerdo:</strong> ${fmt.toMoney(finalFinancial.inversionPorCerdo)} | <strong>BET:</strong> ${fmt.toMoney(finalFinancial.bet)} | <strong>Beneficio neto:</strong> ${fmt.toMoney(finalFinancial.beneficioNeto)}</p>
        <p><strong>Relación B/C:</strong> ${finalFinancial.ratio.toFixed(2)} : 1</p>
        <h3>Matriz por fase y alertas automáticas</h3>
        <p><strong>Umbral mortalidad:</strong> ${matrizFase.mortalidadMax ?? "N/D"}% | <strong>Umbral FCA:</strong> ${matrizFase.fcaMax ?? "N/D"}</p>
        <ul>${alertRows}</ul>
        <h4>Recomendaciones específicas por fase</h4>
        <ul>${faseItems}</ul>
        ${commercialSuggestionHtml}
        ${supportMarkup}
        <h3>Protocolo de uso de productos</h3>
        <ol>${protocolItems}</ol>
        <h3>Recomendaciones técnicas</h3>
        <ul>${recommendationItems}</ul>
      </div>
    </details>
  `;

  container.innerHTML = "";
  container.appendChild(executiveSummary);
}

export function renderHistory(container, rows) {
  if (!rows.length) {
    container.innerHTML = "<p>No hay casos guardados.</p>";
    return;
  }

  const tableRows = rows.map((r) => `
    <tr>
      <td>${r.id}</td>
      <td>${r.fechaRegistro.slice(0, 10)}</td>
      <td>${r.cliente}</td>
      <td>${r.granja}</td>
      <td>${r.fase}</td>
      <td>${r.animalesTratar}</td>
      <td>${r.syncStatus}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID Caso</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Granja</th>
          <th>Fase</th>
          <th>Animales a tratar</th>
          <th>Sync</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}
