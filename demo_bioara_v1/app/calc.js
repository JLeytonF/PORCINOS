import { DEFAULTS, PRICE_CATALOG, PRODUCT_PRICES_COP, PROTOCOL_LIBRARY, STANDARD_PROTOCOL } from "./config.js?v=20260907r6";

function waterFactorByStage(stage) {
  if (["Pre-iniciador", "Iniciador"].includes(stage)) return 0.12;
  if (["Lactante"].includes(stage)) return 0.15;
  return 0.09;
}

function feedFactorByStage(stage) {
  if (["Pre-iniciador", "Iniciador"].includes(stage)) return 0.05;
  return 0.035;
}

function toMoney(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

function normalizeDoseUnit(unit) {
  const value = String(unit || "").toLowerCase();
  if (value.includes("ml")) return "ml";
  if (value.includes("g") && !value.includes("kg")) return "g";
  if (value.includes("kg")) return "kg";
  if (value.includes("und")) return "und";
  if (value.includes("sobres")) return "sobres";
  return value.includes("l") ? "L" : "kg";
}

function getDisplayDoseUnit(unit) {
  const value = String(unit || "").trim();
  if (!value) return "kg";
  if (value.includes("/")) return value;
  const lower = value.toLowerCase();
  if (lower.includes("ml")) return "ml";
  if (lower.includes("g")) return "g";
  if (lower.includes("kg")) return "kg";
  if (lower.includes("l")) return "L";
  if (lower.includes("und")) return "und";
  if (lower.includes("sobres")) return "sobres";
  return "kg";
}

function getAreaDoseQuantityUnit(unit) {
  const value = String(unit || "").trim().toLowerCase();
  if (value.includes("cc") || value.includes("ml")) return "ml";
  if (value.includes("kg")) return "kg";
  if (value.includes("und") || value.includes("unidad")) return "und";
  if (value.includes("l")) return "L";
  return "kg";
}

function getAreaCoverageM2PerLiter(item) {
  const explicitCoverage = Number(item?.coverageM2PerL || item?.coverageM2 || 0);
  if (Number.isFinite(explicitCoverage) && explicitCoverage > 0) {
    return explicitCoverage;
  }

  const notes = String(item?.notes || "");
  const match = notes.match(/(?:rinde|rendimiento(?: aproximado)?|cubre)?\D*(\d+(?:[.,]\d+)?)\s*m2/i) || notes.match(/(\d+(?:[.,]\d+)?)\s*m2/i);
  const parsed = match ? Number(String(match[1]).replace(",", ".")) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function getAreaScaleFactor(areaM2, unit) {
  const lowerUnit = String(unit || "").toLowerCase();
  if (lowerUnit.includes("/1000m2") || lowerUnit.includes("/area")) {
    return Number(areaM2 || 0) / 1000;
  }
  return Number(areaM2 || 0);
}

function convertAmount(amount, fromUnit, toUnit) {
  const from = normalizeDoseUnit(fromUnit);
  const to = normalizeDoseUnit(toUnit);
  const value = Number(amount || 0);

  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  if (from === "g" && to === "kg") return value / 1000;
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "ml" && to === "L") return value / 1000;
  if (from === "L" && to === "ml") return value * 1000;
  return value;
}

function getProductCatalogItem(producto) {
  return PRICE_CATALOG.find((item) => item.producto === producto) || null;
}

function getPackageSize(item) {
  const presentation = String(item?.presentacion || "").toLowerCase();
  const match = presentation.match(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|k|g|l|ml|sobres?|und|unidad)/i);
  if (!match) return 1;

  const value = Number(String(match[1]).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getBaseUnitPrice(item) {
  const packSize = getPackageSize(item);
  const price = Number(item?.precioUnitarioCop || 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return packSize > 0 ? price / packSize : price;
}

function formatNumber(value, digits = 3) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function formatRange(minValue, maxValue, unit, digits = 3) {
  const minNumber = Number(minValue ?? 0);
  const maxNumber = Number(maxValue ?? 0);
  if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) return "N/D";
  if (Math.abs(minNumber - maxNumber) < 1e-9) {
    return `${formatNumber(minNumber, digits)} ${unit}`.trim();
  }
  return `${formatNumber(minNumber, digits)} - ${formatNumber(maxNumber, digits)} ${unit}`.trim();
}

function calculateProtocolDose(item, animalCount, pesoPromedio, aguaLote, alimLote, areaTratadaM2, challenge = "") {
  const doseMode = item.doseMode || "per_1000L";
  const days = Number(item.duracionDias || 0);
  const effectiveDays = challenge === "Bioseguridad" && doseMode === "per_area" ? 1 : days;
  const doseMin = Number(item.doseMin ?? item.dosis1000L ?? item.dosisTon ?? 0);
  const doseMax = Number(item.doseMax ?? item.dosis1000L ?? item.dosisTon ?? 0);
  const product = getProductCatalogItem(item.producto);
  const productUnit = product?.unidadPresentacion || (item.doseUnit?.includes("L") ? "L" : item.doseUnit?.includes("g") ? "kg" : "kg");
  const productBaseUnitPrice = getBaseUnitPrice(product);

  let cantidadDiaMin = 0;
  let cantidadDiaMax = 0;
  let cantidadTotalMin = 0;
  let cantidadTotalMax = 0;
  let unidadCantidad = "kg";
  let unidadTotal = "kg";
  let costoMin = 0;
  let costoMax = 0;
  let requiereArea = false;
  let requiereFichaTecnica = false;
  let requiereCotizacion = Boolean(item.requiereCotizacion);
  const areaM2 = Number(areaTratadaM2 || 0);

  if (item.doseMin === null || item.doseMax === null) {
    requiereFichaTecnica = true;
  }

  if (!requiereFichaTecnica && doseMode === "per_animal") {
    cantidadDiaMin = animalCount * doseMin;
    cantidadDiaMax = animalCount * doseMax;
    cantidadTotalMin = cantidadDiaMin * effectiveDays;
    cantidadTotalMax = cantidadDiaMax * effectiveDays;
    unidadCantidad = normalizeDoseUnit(item.doseUnit || "ml/cerdo/dia");
    unidadTotal = unidadCantidad;
  } else if (!requiereFichaTecnica && doseMode === "per_bodyweight") {
    const liveWeightKg = animalCount * Number(pesoPromedio || 0);
    cantidadDiaMin = liveWeightKg * doseMin;
    cantidadDiaMax = liveWeightKg * doseMax;
    cantidadTotalMin = cantidadDiaMin * effectiveDays;
    cantidadTotalMax = cantidadDiaMax * effectiveDays;
    unidadCantidad = normalizeDoseUnit(item.doseUnit || "ml/kg pv/dia");
    unidadTotal = unidadCantidad;
  } else if (!requiereFichaTecnica && doseMode === "per_1000L") {
    cantidadDiaMin = (aguaLote / 1000) * doseMin;
    cantidadDiaMax = (aguaLote / 1000) * doseMax;
    cantidadTotalMin = cantidadDiaMin * effectiveDays;
    cantidadTotalMax = cantidadDiaMax * effectiveDays;
    unidadCantidad = normalizeDoseUnit(item.doseUnit || "g/1000L");
    unidadTotal = unidadCantidad;
  } else if (!requiereFichaTecnica && doseMode === "per_ton") {
    cantidadDiaMin = (alimLote / 1000) * doseMin;
    cantidadDiaMax = (alimLote / 1000) * doseMax;
    cantidadTotalMin = cantidadDiaMin * effectiveDays;
    cantidadTotalMax = cantidadDiaMax * effectiveDays;
    unidadCantidad = normalizeDoseUnit(item.doseUnit || "kg/ton");
    unidadTotal = unidadCantidad;
  } else if (!requiereFichaTecnica && doseMode === "per_area") {
    requiereArea = true;
    unidadCantidad = getAreaDoseQuantityUnit(item.doseUnit || item.dosisUnidad || "area");
    unidadTotal = unidadCantidad;

    if (areaM2 > 0) {
      const lowerUnit = String(item.doseUnit || item.dosisUnidad || "").toLowerCase();
      if (lowerUnit.includes("/1000m2") || lowerUnit.includes("/area")) {
        const areaFactor = getAreaScaleFactor(areaM2, lowerUnit);
        cantidadDiaMin = areaFactor * doseMin;
        cantidadDiaMax = areaFactor * doseMax;
      } else {
        const coverageM2PerLiter = getAreaCoverageM2PerLiter(item);
        const solutionLiters = areaM2 / coverageM2PerLiter;
        cantidadDiaMin = solutionLiters * doseMin;
        cantidadDiaMax = solutionLiters * doseMax;
      }

      cantidadTotalMin = cantidadDiaMin * effectiveDays;
      cantidadTotalMax = cantidadDiaMax * effectiveDays;

      if (unidadCantidad === "und") {
        cantidadDiaMin = Math.ceil(cantidadDiaMin);
        cantidadDiaMax = Math.ceil(cantidadDiaMax);
        cantidadTotalMin = Math.ceil(cantidadTotalMin);
        cantidadTotalMax = Math.ceil(cantidadTotalMax);
      }
    }
  }

  const cantidadDiaMinBase = convertAmount(cantidadDiaMin, unidadCantidad, productUnit);
  const cantidadDiaMaxBase = convertAmount(cantidadDiaMax, unidadCantidad, productUnit);
  const cantidadTotalMinBase = convertAmount(cantidadTotalMin, unidadTotal, productUnit);
  const cantidadTotalMaxBase = convertAmount(cantidadTotalMax, unidadTotal, productUnit);

  if (!requiereFichaTecnica && (!requiereArea || areaM2 > 0)) {
    costoMin = cantidadTotalMinBase * productBaseUnitPrice;
    costoMax = cantidadTotalMaxBase * productBaseUnitPrice;
  }

  if (requiereCotizacion || !productBaseUnitPrice) {
    requiereCotizacion = true;
    costoMin = null;
    costoMax = null;
  }

  return {
    cantidadDiaMin,
    cantidadDiaMax,
    cantidadTotalMin,
    cantidadTotalMax,
    unidadCantidad,
    unidadTotal,
    costoMin,
    costoMax,
    costoTexto: requiereCotizacion ? "Cotizar" : toMoney(costoMax),
    requiereArea,
    requiereFichaTecnica,
    requiereCotizacion,
    liveWeightKg: doseMode === "per_bodyweight" ? animalCount * Number(pesoPromedio || 0) : null,
    cantidadDiaTexto: requiereArea && areaM2 <= 0 ? "Requiere área tratada" : requiereFichaTecnica ? "Requiere ficha técnica" : formatRange(cantidadDiaMin, cantidadDiaMax, `${getAreaDoseQuantityUnit(item.doseUnit || item.dosisUnidad || "kg")} por aplicación`, 3),
    cantidadTotalTexto: requiereArea && areaM2 <= 0 ? "Requiere área tratada" : requiereFichaTecnica ? "Requiere ficha técnica" : formatRange(cantidadTotalMin, cantidadTotalMax, `${getAreaDoseQuantityUnit(item.doseUnit || item.dosisUnidad || "kg")} total`, 3),
    notes: item.notes || "",
    doseMode,
    doseUnit: item.doseUnit || item.dosisUnidad || "",
    duracionDias: effectiveDays,
    areaTratadaM2: areaM2
  };
}

function normalizeChallenge(raw) {
  const value = String(raw || "Bioseguridad").trim();
  const canonical = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const map = {
    digestivo: "Digestivo",
    respiratorio: "Respiratorio",
    inmune: "Inmune",
    inmune_estres: "Inmune",
    "inmune estres": "Inmune",
    estres: "Estres",
    stress: "Estres",
    nutricional: "Nutricional_Metabolico",
    metabolico: "Nutricional_Metabolico",
    "nutricional/metabolico": "Nutricional_Metabolico",
    "nutricional / metabolico": "Nutricional_Metabolico",
    nutricional_metabolico: "Nutricional_Metabolico",
    biologicos: "Biologicos",
    vacunas: "Biologicos",
    bacterinas: "Biologicos",
    bioseguridad: "Bioseguridad"
  };

  return map[canonical] || value;
}

function buildProtocolSteps(payload, aguaLote, areaTratadaM2) {
  const dosatronVol = aguaLote * 0.01;
  const via = payload.viaPreferida;
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  const steps = [
    "Preparar y calibrar equipos de dosificacion antes de iniciar el tratamiento.",
    `Con Dosatron al 1%, preparar solucion madre diaria en ${dosatronVol.toFixed(2)} L.`,
    "Mantener registro diario de consumo real de agua y alimento para ajustar dosis si cambia el lote.",
    "No mezclar productos incompatibles en el mismo tanque sin validacion tecnica previa.",
    "Evaluar respuesta clinica cada 48 horas con foco en heces, consumo, tos y uniformidad del lote."
  ];

  if (challenge === "Bioseguridad") {
    if (Number(areaTratadaM2 || 0) > 0) {
      steps.push(`Cubrir un área tratada de ${Number(areaTratadaM2).toFixed(2)} m² y verificar la mezcla necesaria según el rendimiento de cada producto.`);
    }
    steps.push("Priorizar limpieza, desinfeccion de áreas, control de vectores y validacion de tiempos de contacto antes de pensar en soporte farmacologico.");
    steps.push("Revisar flujo limpio/sucio, estercoleras, bebederos, comederos y zonas de tránsito para reducir recontaminacion del lote.");
    return steps;
  }

  if (via === "Agua") {
    steps.push("Administrar por linea de agua limpia; idealmente purgar lineas antes de iniciar.");
  }

  if (via === "Alimento") {
    steps.push("Realizar premezcla del producto en pequeno volumen de alimento y luego homogenizar en el total diario.");
  }

  if (via === "Agua+Alimento") {
    steps.push("Priorizar productos solubles por agua en la manana y mantener aditivos de alimento en mezcla homogena durante el dia.");
  }

  steps.push("Bio L.r. incluye neutralizador de cloro/yodo, por lo cual no es necesario detener el tratamiento habitual del agua.");

  return steps;
}

function buildBioAraRecommendations(payload) {
  const via = payload.viaPreferida || "Agua";
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");

  const byChallenge = {
    Digestivo: [
      { producto: "BUTYRIBIOL 2", categoria: "Probiótico, prebiotico y postbiotico", razon: "Es la base del soporte intestinal para reforzar la barrera, la fermentación y la estabilidad digestiva en lechones con diarrea, tránsito o pérdida de consumo.", prioridad: 1 },
      { producto: "Bio L.r.", categoria: "Probiótico soluble", razon: "Aporta soporte microbiano por agua en casos con pérdida de consumo o inestabilidad del tracto digestivo y es compatible con la vía de administración elegida.", prioridad: 1 },
      { producto: "HI-2", categoria: "Probio + electrolitos + energía", razon: "Útil cuando hay baja ingesta, deshidratación leve o mayor esfuerzo metabólico asociado al desafío digestivo.", prioridad: 1 },
      { producto: "BIO LPS", categoria: "Inmunomodulador", razon: "Refuerza la respuesta inmune y la modulación intestinal en animales con presión digestiva o estrés sanitario.", prioridad: 1 },
      { producto: "Triple AAA", categoria: "Farmacéutico de apoyo", razon: "Soporte complementar cuando el lote requiere reforzar el estado general y la respuesta frente a la presión digestiva.", prioridad: 2 },
      { producto: "Bio-Protector", categoria: "Farmacéutico de apoyo", razon: "Apoyo funcional y de recuperación cuando el desafío digestivo exige reforzar el estado general del animal.", prioridad: 2 }
    ],
    Respiratorio: [
      { producto: "Broncobiol", categoria: "Farmacéutico respiratorio", razon: "El principal soporte cuando hay irritación respiratoria, moco o carga ambiental elevada.", prioridad: 1 },
      { producto: "Neutrobiol", categoria: "Farmacéutico de apoyo", razon: "Aporta apoyo inmunológico y metabólico cuando existe presión respiratoria o bajada de consumo con estrés asociado.", prioridad: 2 },
      { producto: "BIO LPS", categoria: "Inmunomodulador", razon: "Apoya la respuesta inmune cuando existe desafío respiratorio y esfuerzo inmunológico en el lote.", prioridad: 2 },
      { producto: "BIOPOL D-49", categoria: "Desinfectante biocida", razon: "Se recomienda como apoyo ambiental cuando la presión ambiental está apoyando la irritación respiratoria.", prioridad: 2 },
      { producto: "HI-2", categoria: "Soporte vital y electrolítico", razon: "Útil como apoyo general si hay bajada de consumo o estrés asociado al desafío respiratorio.", prioridad: 2 }
    ],
    Inmune: [
      { producto: "BIOASIS", categoria: "Simbiótico", razon: "Útil para sostener productividad y estabilidad funcional en lotes con transición, manejo, transporte o presión sanitaria.", prioridad: 1 },
      { producto: "BIO LPS", categoria: "Inmunomodulador", razon: "Soporte directo para fortalecer la respuesta inmune y modular la presión sanitaria.", prioridad: 1 },
      { producto: "Bio-Protector", categoria: "Farmacéutico de apoyo", razon: "Aporta apoyo funcional cuando el lote requiere reforzar defensas y estado general bajo presión inmune.", prioridad: 2 },
      { producto: "Bioenergetic", categoria: "Farmacéutico de apoyo", razon: "Útil como refuerzo energético y de recuperación cuando la presión inmune afecta consumo y confort.", prioridad: 2 },
      { producto: "BUTYRIBIOL 2", categoria: "Probiótico prebiotico postbiotico", razon: "Ayuda a sostener la barrera intestinal y el equilibrio microbiano durante presión inmune o sanitaria.", prioridad: 2 }
    ],
    Estres: [
      { producto: "HI-2", categoria: "Probio + electrolitos + energía", razon: "Es prioritario cuando el estrés genera baja ingesta, deshidratación y mayor esfuerzo metabólico.", prioridad: 1 },
      { producto: "Bioenergetic", categoria: "Farmacéutico de apoyo", razon: "Apoyo de recuperación funcional cuando el lote sufre estrés y requiere apoyo energético inmediato.", prioridad: 1 },
      { producto: "Bio L.r.", categoria: "Probiótico soluble", razon: "Aporta soporte microbiano durante periodos de estrés y manejo y ayuda a estabilizar el consumo de agua.", prioridad: 2 },
      { producto: "BUTYRIBIOL 2", categoria: "Probiótico prebiotico postbiotico", razon: "Ayuda a mantener la barrera intestinal durante eventos de estrés sanitario o de manejo.", prioridad: 2 },
      { producto: "BIO LPS", categoria: "Inmunomodulador", razon: "Soporte de respuesta inmune cuando el estrés aumenta la presión sanitaria del lote.", prioridad: 2 }
    ],
    Nutricional_Metabolico: [
      { producto: "HI-2", categoria: "Probio + electrolitos + energía", razon: "Es la base del soporte metabólico cuando hay menor consumo, debilidad y necesidad de energía disponible.", prioridad: 1 },
      { producto: "Bioenergetic", categoria: "Farmacéutico de apoyo", razon: "Útil como soporte energético y de recuperación cuando el foco es nutricional o metabólico.", prioridad: 1 },
      { producto: "BUTYRIBIOL 2", categoria: "Probiótico prebiotico postbiotico", razon: "Aporta estabilidad intestinal y mejor aprovechamiento funcional cuando el problema es de energía y digestión.", prioridad: 2 },
      { producto: "BIO LPS", categoria: "Inmunomodulador", razon: "Es un complemento útil si la presión metabólica y sanitaria acompaña el desequilibrio del lote.", prioridad: 2 },
      { producto: "Bio-Protector", categoria: "Farmacéutico de apoyo", razon: "Apoyo general durante recuperación nutricional o metabólica con desafío funcional.", prioridad: 2 }
    ],
    Biologicos: [
      { producto: "ADITIVO INACTIVADO PRRSv (reemplazos y gestación)", categoria: "Vacuna reproductiva", razon: "Prioridad alta en reposición y gestación cuando se quiere proteger la aclimatación y reducir presión reproductiva por PRRS.", prioridad: 1 },
      { producto: "BACTERINA TOXOIDE ESCHERICHIA COLI", categoria: "Vacuna preparto", razon: "La base para proteger la camada vía calostro cuando el reto principal es colibacilosis neonatal.", prioridad: 1 },
      { producto: "BACTERINA MYCOSUIS PH (reemplazos y gestación)", categoria: "Bacterina respiratoria", razon: "Útil para robustecer la inmunidad de reemplazos y gestantes frente al complejo respiratorio bacteriano.", prioridad: 1 },
      { producto: "BACTERINA PLEUROSUIS", categoria: "Bacterina respiratoria", razon: "Recomendada cuando la presión de APP o la historia sanitaria del sitio justifican protección temprana.", prioridad: 1 },
      { producto: "BACTERINA MYCOSUIS PH (lechones)", categoria: "Bacterina respiratoria", razon: "Refuerzo temprano en lechones cuando el reto respiratorio aparece en las primeras semanas de vida.", prioridad: 2 },
      { producto: "BACTERINA PLEUROSUIS (lechones)", categoria: "Bacterina respiratoria", razon: "Complementa la inmunización temprana de lechones con riesgo respiratorio en crecimiento inicial.", prioridad: 2 },
      { producto: "BACTERINA AUTÓGENA E. coli ORAL", categoria: "Biológico oral", razon: "Útil en lechones al destete y poscalostrado cuando el reto entérico es dominante.", prioridad: 2 },
      { producto: "ADITIVO INACTIVADO PRRSv (lechones)", categoria: "Vacuna reproductiva", razon: "Se contempla cuando el esquema de la granja incluye inmunización temprana por presión PRRS.", prioridad: 2 }
    ],
    Bioseguridad: [
      { producto: "BIOPOL D-49", categoria: "Desinfectante y detergente biocida", razon: "Base de limpieza y desinfección por áreas, equipos y vehículos.", prioridad: 1 },
      { producto: "POLYBIOCIDEX NF", categoria: "Desinfectante y detergente biocida", razon: "Recomendado para limpieza profunda de áreas y superficies con alta exigencia sanitaria.", prioridad: 1 },
      { producto: "JELLKEM", categoria: "Desinfectante y detergente biocida", razon: "Útil en corrales, estercoleras y zonas de tránsito con alta contaminación ambiental.", prioridad: 1 },
      { producto: "CLEANEX F48", categoria: "Desinfectante y detergente biocida", razon: "Muy útil para flujo limpio/sucio y desinfección de equipos y superficies.", prioridad: 1 },
      { producto: "PYAM", categoria: "Detergente biocida", razon: "Da soporte en limpieza fuerte de superficies y alta presión ambiental.", prioridad: 1 },
      { producto: "Bio Fly", categoria: "Control biológico de moscas", razon: "Recomendado cuando existe presión ambiental por moscas y riesgo de contaminación fecal y mecánica.", prioridad: 1 },
      { producto: "Trampa Atrapamoscas", categoria: "Control físico de moscas", razon: "Complementa el programa y reduce la carga vectorial del lote.", prioridad: 1 },
      { producto: "Brodifacoum pellets", categoria: "Rodenticida", razon: "Recomendado cuando hay presencia de roedores que comprometen la bioseguridad y la limpieza del sitio.", prioridad: 1 },
      { producto: "Deltaforce 2,5% EC", categoria: "Insecticida", razon: "Útil para controlar insectos y vectores en zonas de alta presión ambiental.", prioridad: 2 },
      { producto: "ANALOGUE EC 10%", categoria: "Insecticida", razon: "Se incluye como control de insectos en el programa sanitario del sitio.", prioridad: 2 },
      { producto: "Diclorvos EC 50%", categoria: "Insecticida", razon: "Debe usarse sólo bajo protocolo y control de seguridad del operador, no como solución general sin análisis.", prioridad: 2 }
    ]
  };

  const candidates = [...(byChallenge[challenge] || [])].map((item) => ({
    ...item,
    prioridad: item.prioridad || 2
  }));

  if (challenge === "Bioseguridad") {
    return candidates.filter((item) => {
      const text = `${item.categoria} ${item.producto}`.toLowerCase();
      return text.includes("desinfectante") ||
        text.includes("detergente") ||
        text.includes("biocida") ||
        text.includes("mosca") ||
        text.includes("rodentic") ||
        text.includes("insectic") ||
        text.includes("bioseguridad") ||
        text.includes("control") ||
        item.producto === "BIOPOL D-49";
    }).sort((a, b) => (a.prioridad - b.prioridad) || a.producto.localeCompare(b.producto));
  }

  if (challenge === "Biologicos") {
    return candidates.sort((a, b) => (a.prioridad - b.prioridad) || a.producto.localeCompare(b.producto));
  }

  if (["Digestivo", "Inmune", "Estres", "Nutricional_Metabolico"].includes(challenge)) {
    const allowed = {
      Digestivo: ["BUTYRIBIOL 2", "Bio L.r.", "HI-2", "BIO LPS", "Triple AAA", "Bio-Protector"],
      Inmune: ["BIOASIS", "BIO LPS", "Bio-Protector", "Bioenergetic", "BUTYRIBIOL 2"],
      Estres: ["HI-2", "Bioenergetic", "Bio L.r.", "BUTYRIBIOL 2", "BIO LPS"],
      Nutricional_Metabolico: ["HI-2", "Bioenergetic", "BUTYRIBIOL 2", "BIO LPS", "Bio-Protector"]
    };

    return candidates
      .filter((item) => allowed[challenge].includes(item.producto))
      .sort((a, b) => (a.prioridad - b.prioridad) || a.producto.localeCompare(b.producto));
  }

  if (via === "Agua") {
    return candidates.filter((item) => !["BUTYRIBIOL 2", "BIOASIS", "BIO LPS"].includes(item.producto) || item.categoria.includes("Probiótico") || item.categoria.includes("Inmunomodulador") || item.categoria.includes("Simbiótico") || item.producto === "Bio L.r." || item.producto === "BIO LPS");
  }

  if (via === "Alimento") {
    return candidates.filter((item) => !["BRONCOBIOL", "Bio L.r.", "POLYBIOCIDEX NF", "JELLKEM", "CLEANEX F48", "PYAM", "Bio Fly", "Trampa Atrapamoscas", "Brodifacoum pellets", "Deltaforce 2,5% EC", "ANALOGUE EC 10%", "Diclorvos EC 50%"].includes(item.producto) || item.categoria.includes("Probiótico") || item.categoria.includes("Inmunomodulador") || item.categoria.includes("Simbiótico") || item.producto === "BUTYRIBIOL 2" || item.producto === "BIOASIS");
  }

  return candidates.sort((a, b) => (a.prioridad - b.prioridad) || a.producto.localeCompare(b.producto));
}

function buildRecommendations(payload) {
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  const base = [
    "Aplicar manejo todo dentro/todo fuera por sala y reforzar vacio sanitario cuando aplique.",
    "Auditar semanalmente mortalidad, ganancia diaria y FCA para confirmar que el ROI proyectado se cumple.",
    "Mantener trazabilidad por lote: fecha, responsable, dosis y observaciones clinicas.",
    "La recomendación debe estar basada en la señal clínica y la presión ambiental; no se usa la vía de administración como criterio único."
  ];

  const byChallenge = {
    Digestivo: [
      "Reforzar transicion alimentaria gradual por 3-5 dias para reducir disbiosis postdestete.",
      "Corregir calidad fisica del alimento (tamano de particula y polvo) para mejorar consumo efectivo.",
      "Priorizar soporte intestinal con probioticos y simbióticos; no usar farmacéuticos digestivos de rutina sin diagnóstico o evidencia de señal específica."
    ],
    Respiratorio: [
      "Monitorear ventilacion, gases y polvo ambiental; mantener amoniaco bajo para proteger mucosa respiratoria.",
      "En cuadros con tos y moco, priorizar soporte en agua y seguimiento de temperatura rectal por submuestra.",
      "No recomendar farmacéuticos respiratorios de rutina en cuadros leves sin diagnóstico; la prioridad es bioseguridad, limpieza ambiental y soporte mucolítico cuando aplica."
    ],
    Inmune: [
      "Programar ventanas de menor estres para vacunacion, mezclas y traslados.",
      "Asegurar hidratacion y consumo en las primeras 24-48 h postevento con presión inmune.",
      "Usar inmunomoduladores y probioticos como soporte, no como sustituto del manejo de densidad, ventilacion y sanidad ambiental."
    ],
    Estres: [
      "Reducir cambios bruscos de temperatura, flujo y manejo durante las primeras 48 h del evento de estrés.",
      "Asegurar consumo de agua y estabilidad del lote para disminuir el impacto del estrés sobre producción.",
      "Usar electrolitos, energía y soporte gastrointestinal como puente mientras se corrige la causa del estrés."
    ],
    Nutricional_Metabolico: [
      "Revisar consumo, palatabilidad y uniformidad de la ración para asegurar energía disponible.",
      "Monitorear peso, consumo y heces para distinguir un problema nutricional del sanitario.",
      "Usar soporte metabólico y gastrointestinal cuando el problema se centra en energía, recuperación y aprovechamiento del alimento."
    ],
    Biologicos: [
      "Validar diagnóstico del agente dominante y no vacunar a ciegas: la selección debe seguir la historia sanitaria y la fase del lote.",
      "Respetar cadena de frío entre 4 y 7 °C, agitar antes de usar y aplicar asépticamente según cada ficha técnica.",
      "Programar el esquema por fase: gestación/reemplazos para biológicos reproductivos y pre-iniciador/iniciador para biológicos tempranos en lechones.",
      "No mezclar vacunas con desinfectantes, biocidas o medicamentos en la misma jeringa o línea de aplicación."
    ],
    Bioseguridad: [
      "Implementar protocolo estricto de limpieza y desinfeccion por area con tiempos de contacto definidos.",
      "Separar flujos limpio/sucio y validar cumplimiento con lista de chequeo diaria.",
      "Reforzar control de moscas, insectos y roedores; la reducción de la carga vectorial es parte central del plan sanitario del lote.",
      "Si la señal es ambiental, la prioridad es infraestructura sanitaria y no solo farmacología."
    ]
  };

  return base.concat(byChallenge[challenge] || []);
}

function buildNotRecommendedByChallenge(payload) {
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  const byChallenge = {
    Digestivo: [
      { categoria: "Farmacéuticos digestivos sin diagnóstico", razon: "No se recomienda usar terapias digestivas de rutina en ausencia de diagnóstico etiológico o evidencia clínica clara; primero debe confirmarse la señal del problema." },
      { categoria: "Bioseguridad sin limpieza", razon: "Si el caso es digestivo, no se recomienda reemplazar el soporte intestinal por una estrategia de bioseguridad aislada sin corregir consumo, alimento y manejo del lote." },
      { categoria: "Desinfectantes sin protocolo de contacto", razon: "No se recomienda cualquier desinfectante si no hay dilución correcta, tiempo de contacto validado y limpieza previa del área." }
    ],
    Respiratorio: [
      { categoria: "Farmacéuticos respiratorios sin diagnóstico", razon: "No se recomienda farmacoterapia respiratoria de rutina en cuadros leves o irritativos sin examen clínico, diagnóstico diferencial y evidencia de necesidad terapéutica." },
      { categoria: "Uso repetido de antibióticos sin indicación", razon: "No se recomienda antibióticos de forma repetitiva si no existe evidencia de enfermedad bacteriana, porque aumenta presión selectiva y no corrige la causa ambiental." },
      { categoria: "Desinfectantes sin protocolo", razon: "No se recomienda la aplicación indiscriminada de desinfectantes sin dilución, tiempo de contacto y secado adecuados; esto puede irritar la mucosa y no mejorar la condición respiratoria." }
    ],
    Inmune: [
      { categoria: "Farmacéuticos como sustituto del manejo", razon: "No se recomienda usar medicamentos como reemplazo del manejo de densidad, ventilación, temperatura y consumo; estas variables son prioritarias." },
      { categoria: "Desinfección sin control ambiental", razon: "No se recomienda tratar la inmunidad sin corregir la presión ambiental, porque el polvo, gases y la incomodidad comprometen la respuesta del lote." },
      { categoria: "Productos digestivos de uso indiscriminado", razon: "No se recomienda incorporar terapias digestivas sin señal clínica clara cuando el problema central es inmune o de respuesta sanitaria." }
    ],
    Estres: [
      { categoria: "Soporte farmacológico sin corregir el estrés", razon: "No se recomienda usar terapias como reemplazo del manejo del estrés, la temperatura, el flujo y la adaptación del lote." },
      { categoria: "Cambios bruscos de manejo", razon: "No se recomienda mantener modificaciones severas de manejo sin controlar la respuesta del animal; esto agrava la presión del estrés." },
      { categoria: "Desbalance nutricional persistente", razon: "No se recomienda continuar con estrategia nutricional inestable cuando el lote está sufriendo estrés y baja ingesta." }
    ],
    Nutricional_Metabolico: [
      { categoria: "Ajustes nutricionales sin diagnóstico", razon: "No se recomienda cambiar la formulación sin revisar consumo, peso y uniformidad del lote; puede ocultar una causa real de baja ganancia." },
      { categoria: "Soporte sanitario como sustituto de energía", razon: "No se recomienda tratar solo la respuesta inmune si el problema principal es la energía, la palatabilidad o el desempeño metabólico." },
      { categoria: "Estrés prolongado sin corrección", razon: "No se recomienda seguir con manejo estresante si no se corrige la base nutricional y metabólica del lote." }
    ],
    Biologicos: [
      { categoria: "Vacunar sin diagnóstico ni fase definida", razon: "No se recomienda aplicar biológicos sin validar primero el agente predominante, la fase del lote y el objetivo inmunológico." },
      { categoria: "Romper la cadena de frío", razon: "No se recomienda usar vacunas fuera del rango de conservación porque compromete la respuesta inmune y la eficacia del esquema." },
      { categoria: "Mezclar vacunas con biocidas o desinfectantes", razon: "No se recomienda mezclar biológicos con productos de limpieza o desinfección; reduce la viabilidad del esquema y puede anular el efecto." }
    ],
    Bioseguridad: [
      { categoria: "Farmacología como estrategia principal", razon: "No se recomienda usar inmunomoduladores o probióticos como solución central en un problema de bioseguridad; la prioridad es reducir la carga ambiental y la reinfección." },
      { categoria: "Desinfección sin limpieza previa", razon: "No se recomienda la desinfección sin tiempo de contacto, dilución y limpieza previa; la acción superficial no controla la carga ambiental." },
      { categoria: "Control no estructurado de vectores", razon: "No se recomienda dejar el control de moscas, insectos y roedores sin programa definido, porque aumenta la contaminación ambiental y la reinfección del lote." }
    ]
  };

  return byChallenge[challenge] || [
    { categoria: "General", razon: "No se recomienda reemplazar la evaluación clínica con protocolos fijos; la indicación debe basarse en diagnóstico, señal del caso y condiciones del lote." }
  ];
}

function getPhaseRules() {
  return {
    "Pre-iniciador": {
      mortalidadMax: 4.0,
      fcaMax: 1.70,
      recomendaciones: [
        "Mantener temperatura y confort termico estables para proteger consumo en destete.",
        "Sostener soporte probiotico continuo en agua/alimento durante los primeros 14 dias.",
        "Monitorear consistencia de heces 2 veces al dia para deteccion temprana de disbiosis."
      ]
    },
    "Iniciador": {
      mortalidadMax: 3.0,
      fcaMax: 1.65,
      recomendaciones: [
        "Ajustar curva de alimentacion por peso real y no solo por edad.",
        "Validar espacio de comedero y bebedero para evitar competencia excesiva.",
        "Mantener transiciones de dieta sin cambios bruscos de formula."
      ]
    },
    "Levante": {
      mortalidadMax: 2.0,
      fcaMax: 1.90,
      recomendaciones: [
        "Revisar densidad por corral para reducir estres y variabilidad de crecimiento.",
        "Programar controles semanales de GMD y uniformidad del lote.",
        "Corregir ventilacion para mantener baja carga de gases y polvo."
      ]
    },
    "Engorde": {
      mortalidadMax: 1.5,
      fcaMax: 2.60,
      recomendaciones: [
        "Evaluar peso objetivo de salida por mercado para optimizar margen por cerdo.",
        "Ajustar granulometria y disponibilidad de agua para sostener eficiencia.",
        "Reforzar bioseguridad interna y control de mezclas de lotes."
      ]
    },
    "Gestante": {
      mortalidadMax: 1.0,
      fcaMax: 3.00,
      recomendaciones: [
        "Priorizar condicion corporal homogenea y control de sobrepeso.",
        "Mantener plan de vacunacion y bioseguridad reproductiva estricto.",
        "Monitorear consumo diario y respuesta al estres termico."
      ]
    },
    "Lactante": {
      mortalidadMax: 1.0,
      fcaMax: 3.50,
      recomendaciones: [
        "Asegurar alto consumo de agua en cerdas para sostener produccion de leche.",
        "Monitorear estado de ubre y condicion corporal postparto.",
        "Reducir estres de camada con manejo de temperatura y uniformidad de succion."
      ]
    }
  };
}

function buildPhaseGuidance(payload) {
  const rules = getPhaseRules();
  const selected = rules[payload.fase] || null;

  if (!selected) {
    return {
      fase: payload.fase,
      mortalidadMax: null,
      fcaMax: null,
      recomendacionesFase: ["Sin matriz definida para esta fase en la demo."],
      alertas: []
    };
  }

  const mortalidadActual = Number(payload.mortalidad);
  const fcaActual = Number(payload.fca);
  const alertas = [];

  if (mortalidadActual > selected.mortalidadMax) {
    alertas.push({
      tipo: "critica",
      mensaje: `Mortalidad fuera de rango para ${payload.fase}: ${mortalidadActual.toFixed(2)}% > ${selected.mortalidadMax.toFixed(2)}%.`
    });
  } else {
    alertas.push({
      tipo: "ok",
      mensaje: `Mortalidad en rango para ${payload.fase}: ${mortalidadActual.toFixed(2)}% <= ${selected.mortalidadMax.toFixed(2)}%.`
    });
  }

  if (fcaActual > selected.fcaMax) {
    alertas.push({
      tipo: "critica",
      mensaje: `FCA fuera de rango para ${payload.fase}: ${fcaActual.toFixed(2)} > ${selected.fcaMax.toFixed(2)}.`
    });
  } else {
    alertas.push({
      tipo: "ok",
      mensaje: `FCA en rango para ${payload.fase}: ${fcaActual.toFixed(2)} <= ${selected.fcaMax.toFixed(2)}.`
    });
  }

  return {
    fase: payload.fase,
    mortalidadMax: selected.mortalidadMax,
    fcaMax: selected.fcaMax,
    recomendacionesFase: selected.recomendaciones,
    alertas
  };
}

function selectChallengeProtocol(payload) {
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  const phase = String(payload.fase || "").trim();
  const library = PROTOCOL_LIBRARY[challenge] || STANDARD_PROTOCOL;

  if (!Array.isArray(library)) return STANDARD_PROTOCOL;

  const phaseAware = library.filter((item) => {
    const phaseTags = Array.isArray(item.phaseTags) ? item.phaseTags : null;
    return !phaseTags || !phase || phaseTags.includes(phase);
  });

  return phaseAware.length ? phaseAware : library;
}

function normalizeProtocolRuleSet(protocolRuleSet) {
  if (!protocolRuleSet) return [];
  if (Array.isArray(protocolRuleSet)) return protocolRuleSet;
  if (Array.isArray(protocolRuleSet.protocols)) return protocolRuleSet.protocols;
  return [];
}

function buildUnifiedPriorityOne(payload, autoRecommendations, manualSelectedProducts, protocolRuleSet) {
  const challenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  const phase = String(payload.fase || "").trim();
  const manualSet = new Set((manualSelectedProducts || []).map((p) => String(p || "").trim()).filter(Boolean));
  const rules = normalizeProtocolRuleSet(protocolRuleSet);
  const matchedRules = rules.filter((rule) => {
    const tags = Array.isArray(rule.challengeTags) ? rule.challengeTags : [];
    return tags.includes(challenge) || tags.includes("General");
  });

  const bucket = new Map();
  const ensureProduct = (product) => {
    const name = String(product || "").trim();
    if (!name) return null;
    if (!bucket.has(name)) {
      const catalog = getProductCatalogItem(name);
      bucket.set(name, {
        producto: name,
        categoria: catalog?.categoria || "Catálogo base",
        prioridad: 2,
        razones: [],
        fuentes: []
      });
    }
    return bucket.get(name);
  };

  (autoRecommendations || []).forEach((item) => {
    const entry = ensureProduct(item.producto);
    if (!entry) return;
    entry.prioridad = Math.min(entry.prioridad, Number(item.prioridad || 2));
    entry.razones.push(item.razon || "Recomendación automática por desafío.");
    entry.fuentes.push(item.prioridad === 1 ? "Automático P1" : "Automático P2");
  });

  manualSet.forEach((product) => {
    const entry = ensureProduct(product);
    if (!entry) return;
    entry.prioridad = 1;
    entry.razones.push("Selección manual del médico veterinario a cargo.");
    entry.fuentes.push("Manual veterinario");
  });

  matchedRules.forEach((rule) => {
    const required = Array.isArray(rule.requiredProducts) ? rule.requiredProducts : [];
    const suggested = Array.isArray(rule.suggestedProducts) ? rule.suggestedProducts : [];

    required.forEach((product) => {
      const entry = ensureProduct(product);
      if (!entry) return;
      entry.prioridad = 1;
      entry.razones.push("Requerido por la lectura integrada de protocolos locales.");
      entry.fuentes.push(`Protocolo requerido (${rule.fileName})`);
    });

    suggested.forEach((product) => {
      const entry = ensureProduct(product);
      if (!entry) return;
      entry.prioridad = Math.min(entry.prioridad, 2);
      entry.razones.push("Complemento sugerido por la lectura integrada de protocolos locales.");
      entry.fuentes.push(`Protocolo sugerido (${rule.fileName})`);
    });
  });

  const unifiedPriorityOne = Array.from(bucket.values()).map((item) => ({
    producto: item.producto,
    categoria: item.categoria,
    prioridad: item.prioridad,
    razon: Array.from(new Set(item.razones)).join(" "),
    fuentes: Array.from(new Set(item.fuentes))
  })).sort((a, b) => (a.prioridad - b.prioridad) || a.producto.localeCompare(b.producto));

  const priorityOneMatrix = unifiedPriorityOne.map((item) => {
    const fuentes = item.fuentes.join(" + ");
    const esManual = item.fuentes.some((f) => f.includes("Manual"));
    const esAutomatico = item.fuentes.some((f) => f.includes("Automático"));
    const esProtocolo = item.fuentes.some((f) => f.includes("Protocolo"));

    let resolucion = "Recomendación técnica consolidada";
    if (esManual && (esAutomatico || esProtocolo)) {
      resolucion = "Consenso veterinario + reglas automáticas complementarias";
    } else if (!esManual && (esAutomatico || esProtocolo)) {
      resolucion = "Complemento automático al criterio veterinario";
    } else if (esManual) {
      resolucion = "Priorización clínica manual";
    }

    return {
      producto: item.producto,
      prioridad: item.prioridad,
      fuentes,
      resolucion,
      razon: item.razon
    };
  });

  const appliedProtocolRules = matchedRules.map((rule) => ({
    id: rule.id,
    fileName: rule.fileName,
    notes: rule.notes || ""
  }));

  const commercialCandidates = rules
    .map((rule) => {
      const phaseTags = Array.isArray(rule.phaseTags) ? rule.phaseTags : [];
      const challengeTags = Array.isArray(rule.challengeTags) ? rule.challengeTags : [];
      const matchesPhase = phaseTags.includes(phase);
      const matchesChallenge = challengeTags.includes(challenge) || challengeTags.includes("General");
      const score = (matchesPhase ? 2 : 0) + (matchesChallenge ? 1 : 0) + (matchesPhase && matchesChallenge ? 1 : 0);

      return {
        id: rule.id,
        commercialTitle: rule.commercialTitle || rule.fileName,
        commercialBenefit: rule.commercialBenefit || rule.notes || "",
        phaseMatch: matchesPhase,
        challengeMatch: matchesChallenge,
        score,
        phaseTags,
        challengeTags,
        fileName: rule.fileName
      };
    })
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score || a.commercialTitle.localeCompare(b.commercialTitle));

  const commercialPrimary = commercialCandidates[0] || null;
  const commercialSecondary = commercialCandidates.find((item) => item.id !== commercialPrimary?.id && (item.phaseMatch || item.challengeMatch)) || null;

  const commercialSuggestion = commercialPrimary ? {
    title: commercialPrimary.phaseMatch && commercialPrimary.challengeMatch
      ? "Sugerencia técnica integrada"
      : commercialPrimary.phaseMatch
        ? "Sugerencia técnica por fase"
        : "Sugerencia técnica por desafío",
    headline: commercialPrimary.commercialTitle,
    benefit: commercialPrimary.commercialBenefit,
    reason: commercialPrimary.phaseMatch && commercialPrimary.challengeMatch
      ? "Este programa cubre simultáneamente la fase y el desafío principal del caso."
      : commercialPrimary.phaseMatch
        ? `Alineado primero con la fase ${phase}.`
        : `Alineado principalmente con el desafío ${challenge}.`,
    badges: [
      commercialPrimary.phaseMatch ? `Fase: ${phase}` : null,
      commercialPrimary.challengeMatch ? `Desafío: ${challenge}` : null
    ].filter(Boolean),
    secondary: commercialSecondary ? {
      headline: commercialSecondary.commercialTitle,
      benefit: commercialSecondary.commercialBenefit,
      reason: commercialSecondary.phaseMatch && commercialSecondary.challengeMatch
        ? "Complementa el caso en fase y desafío al mismo tiempo."
        : commercialSecondary.phaseMatch
          ? `Complementa la misma fase ${phase}.`
          : `Complementa el desafío ${challenge}.`
    } : null,
    callToAction: commercialPrimary.phaseMatch && commercialPrimary.challengeMatch
      ? "Recomendado como paquete principal para presentar al cliente."
      : "Recomendado como punto de partida comercial y clínico."
  } : null;

  const challengeTheme = (() => {
    if (challenge === "Bioseguridad") return "bioseguridad y control ambiental";
    if (challenge === "Respiratorio") return "soporte respiratorio y control sanitario";
    if (challenge === "Inmune") return "refuerzo inmune y resiliencia fisiológica";
    if (challenge === "Estres") return "reducción de estrés y recuperación funcional";
    if (challenge === "Nutricional_Metabolico") return "balance energético y desempeño metabólico";
    return "estabilidad digestiva y arranque temprano";
  })();

  const digestPoints = [];
  if (matchedRules.some((rule) => /lechon/i.test(rule.fileName) || /lechon/i.test(rule.notes))) {
    digestPoints.push("Refuerzo temprano en nacimiento y destete para sostener inmunidad, energía y colonización intestinal.");
  }
  if (matchedRules.some((rule) => /higiene|desinfeccion|manual/i.test(rule.fileName + " " + rule.notes))) {
    digestPoints.push("Bioseguridad operativa con detergencia, desinfección y rotación técnica por lote.");
  }
  if (matchedRules.some((rule) => /madres|lactante|parto/i.test(rule.fileName + " " + rule.notes))) {
    digestPoints.push("Soporte a condición corporal y consumo en etapas reproductivas/lactantes para proteger la curva productiva.");
  }
  if (matchedRules.some((rule) => /prrs|respir/i.test(rule.fileName + " " + rule.notes))) {
    digestPoints.push("Programa de contención sanitaria y económica para desafío respiratorio con intervención preventiva.");
  }
  if (digestPoints.length === 0) {
    digestPoints.push(`El portafolio local converge en ${challengeTheme} con priorización clínica y control operativo.`);
  }

  const protocolDigest = {
    title: "Extracto operativo de protocolos locales",
    summary: digestPoints.join(" "),
    actionLine: challenge === "Bioseguridad"
      ? "Aplicar limpieza, secado, desinfección y rotación de biocidas antes del siguiente lote."
      : challenge === "Respiratorio"
        ? "Priorizar control del entorno, soporte respiratorio y respuesta inmune sin saturar el plan con productos redundantes."
        : challenge === "Inmune"
          ? "Escalonar soporte inmune de arranque con energía y colonización intestinal como base."
          : challenge === "Nutricional_Metabolico"
            ? "Sostener energía disponible y condición corporal para estabilizar rendimiento."
            : "Sostener la barrera intestinal y la respuesta fisiológica con intervención temprana y medible."
  };

  const innovativeProposal = {
    name: "BioARA Start + Shield + Sustain",
    position: `Propuesta integrada para ${challengeTheme}`,
    summary: "Un paquete de decisión clínica y productividad que une arranque temprano, bioseguridad de galpón y sostén productivo, con una lectura simple para el veterinario y una narrativa de valor para el cliente.",
    pillars: [
      "Start: intervención temprana en lechón o en el punto crítico del lote para proteger supervivencia, consumo y adaptación.",
      "Shield: higiene, desinfección y control ambiental como capa técnica obligatoria, no opcional.",
      "Sustain: soporte metabólico y de condición para sostener desempeño, reducir recaídas y proteger el ROI."
    ],
    marketingAngle: "Vender el programa como un sistema de protección y desempeño, no como productos sueltos: menos fricción de compra, más claridad de valor y mejor adherencia del cliente.",
    uxAngle: "La interfaz debe guiar de una decisión clínica simple a un reporte ejecutivo medible, evitando listas largas y mostrando solo extractos accionables y costos al final.",
    industrialAngle: "En porcicultura industrial, esto alinea bioseguridad, arranque, crecimiento y trazabilidad en un solo flujo operativo por lote."
  };

  return {
    unifiedPriorityOne,
    priorityOneMatrix,
    appliedProtocolRules,
    commercialSuggestion,
    protocolDigest,
    innovativeProposal,
    internalSyncReport: {
      conflictMatrix: priorityOneMatrix,
      appliedProtocolRules,
      commercialSuggestion,
      protocolDigest,
      innovativeProposal
    }
  };
}

export function calculateCase(payload, options = {}) {
  const normalizedChallenge = normalizeChallenge(payload.desafio || "Bioseguridad");
  payload.desafio = normalizedChallenge;
  const manualSelectedProducts = Array.isArray(options.manualSelectedProducts) ? options.manualSelectedProducts : [];
  const protocolRuleSet = options.protocolRuleSet || [];
  const areaTratadaM2 = Number(payload.areaTratadaM2 || 0);

  const n = Number(payload.animalesTratar);
  const peso = Number(payload.pesoPromedio);

  const aguaCerdo = peso * waterFactorByStage(payload.fase);
  const aguaLote = aguaCerdo * n;

  const alimCerdo = peso * feedFactorByStage(payload.fase);
  const alimLote = alimCerdo * n;

  const challengeProtocol = selectChallengeProtocol(payload);

  const protocolos = challengeProtocol.map((item) => {
    const dose = calculateProtocolDose(item, n, peso, aguaLote, alimLote, areaTratadaM2, normalizedChallenge);
    const costo = Number.isFinite(dose.costoMax) ? Math.max(dose.costoMax, 0) : 0;

    return {
      ...item,
      ...dose,
      cantidadDia: dose.cantidadDiaMax,
      unidadDia: `${dose.unidadCantidad}/dia`,
      total: dose.cantidadTotalMax,
      totalKg: dose.cantidadTotalMax,
      costo
    };
  });

  const inversionTotal = protocolos.reduce((sum, p) => sum + p.costo, 0);

  const ahorroMortalidad = n * (DEFAULTS.reduccionMortalidadPctEscenario / 100) * peso * Number(payload.precioCerdo);
  const ahorroFca = n * DEFAULTS.mejoraFcaEscenario * DEFAULTS.kgGanadosEtapaEscenario * Number(payload.costoAlimento);
  const bet = ahorroMortalidad + ahorroFca + DEFAULTS.ahorroAntibioticosCopEscenario;

  const beneficioNeto = bet - inversionTotal;
  const roi = inversionTotal > 0 ? ((beneficioNeto / inversionTotal) * 100) : 0;
  const ratio = inversionTotal > 0 ? (bet / inversionTotal) : 0;
  const protocoloUso = buildProtocolSteps(payload, aguaLote, areaTratadaM2);
  const recomendaciones = buildRecommendations(payload);
  const bioAraRecommendations = buildBioAraRecommendations(payload);
  const noRecomendados = buildNotRecommendedByChallenge(payload);
  const matrizFase = buildPhaseGuidance(payload);
  const priorityOneData = buildUnifiedPriorityOne(payload, bioAraRecommendations, manualSelectedProducts, protocolRuleSet);

  return {
    consumo: {
      aguaCerdo,
      aguaLote,
      alimCerdo,
      alimLote
    },
    areaTratadaM2: normalizedChallenge === "Bioseguridad" ? areaTratadaM2 : null,
    protocolos,
    financiero: {
      ahorroMortalidad,
      ahorroFca,
      ahorroAntibioticos: DEFAULTS.ahorroAntibioticosCopEscenario,
      bet,
      inversionTotal,
      beneficioNeto,
      roi,
      ratio,
      inversionPorCerdo: inversionTotal / n
    },
    protocoloUso,
    recomendaciones,
    bioAraRecommendations,
    noRecomendados,
    matrizFase,
    unifiedPriorityOne: priorityOneData.unifiedPriorityOne,
    priorityOneMatrix: priorityOneData.priorityOneMatrix,
    appliedProtocolRules: priorityOneData.appliedProtocolRules,
    commercialSuggestion: priorityOneData.commercialSuggestion,
    protocolDigest: priorityOneData.protocolDigest,
    innovativeProposal: priorityOneData.innovativeProposal,
    internalSyncReport: priorityOneData.internalSyncReport,
    manualSelectedProducts,
    fmt: {
      toMoney
    }
  };
}
