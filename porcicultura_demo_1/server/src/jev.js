export function normalizeChallenge(raw = "") {
  const value = String(raw || "").trim();
  const map = {
    digestivo: "Digestivo",
    respiratorio: "Respiratorio",
    inmune: "Inmune",
    estres: "Estres",
    stress: "Estres",
    nutricional: "Nutricional_Metabolico",
    metabolico: "Nutricional_Metabolico",
    biologicos: "Biologicos",
    vacunas: "Biologicos",
    bioseguridad: "Bioseguridad",
    "nutricional/metabolico": "Nutricional_Metabolico",
    "nutricional / metabolico": "Nutricional_Metabolico"
  };

  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return map[normalized] || value || "Digestivo";
}

export function evaluateJEV(payload = {}) {
  const via = String(payload.viaPreferida || "Agua").trim();
  const challenge = normalizeChallenge(payload.desafio || "Digestivo");
  const consumoReal = Number(payload.consumoAlimentoRealKgDia || 0);
  const animalesTratar = Number(payload.animalesTratar || 0);
  const fase = String(payload.fase || "").trim();

  const justification = {
    problema: challenge,
    viaSeleccionada: via,
    razon: `Se evalúa un caso de ${challenge.toLowerCase()} con vía ${via} y con consumo real del lote como base de cálculo.`
  };

  const evidence = {
    cliente: payload.cliente || "Sin cliente",
    granja: payload.granja || "Sin granja",
    fase,
    animalesTratar,
    pesoPromedio: Number(payload.pesoPromedio || 0),
    edadDias: Number(payload.edadDias || 0),
    consumoRealKgDia: consumoReal,
    emailCliente: payload.emailCliente || "",
    emailBioara: payload.emailBioara || "business@poultryia.com"
  };

  const checks = [];

  if (via === "Agua" || via === "Alimento" || via === "Agua+Alimento") {
    checks.push({ name: "via_valida", ok: true, detail: `Vía seleccionada: ${via}` });
  } else {
    checks.push({ name: "via_valida", ok: false, detail: "Vía no reconocida" });
  }

  if (["Alimento", "Agua+Alimento"].includes(via) && consumoReal <= 0) {
    checks.push({ name: "consumo_lote", ok: false, detail: "Falta consumo real del lote total en kg/día" });
  } else {
    checks.push({ name: "consumo_lote", ok: true, detail: `Consumo del lote validado: ${consumoReal} kg/día` });
  }

  if (!payload.cliente || !payload.granja || !payload.fase) {
    checks.push({ name: "datos_obligatorios", ok: false, detail: "Faltan datos básicos del caso" });
  } else {
    checks.push({ name: "datos_obligatorios", ok: true, detail: "Datos básicos del caso completos" });
  }

  if (challenge === "Bioseguridad" && !payload.areaTratadaM2) {
    checks.push({ name: "area_tratada", ok: false, detail: "Para Bioseguridad debe definirse área tratada" });
  } else {
    checks.push({ name: "area_tratada", ok: true, detail: "Área tratada validada o no requerida" });
  }

  const passed = checks.every((item) => item.ok);
  const verification = {
    passed,
    checks,
    summary: passed ? "El caso cumple validación JEV y puede avanzar a aprobación." : "El caso requiere corrección antes de aprobación."
  };

  return {
    status: passed ? "jev_ready" : "jev_blocked",
    justification,
    evidence,
    verification
  };
}
