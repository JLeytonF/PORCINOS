export let DEFAULTS = {
  costoAlimentoCopKg: 1623,
  precioCerdoCopKg: 6380,
  mejoraFcaEscenario: 0.08,
  reduccionMortalidadPctEscenario: 1.2,
  kgGanadosEtapaEscenario: 18,
  ahorroAntibioticosCopEscenario: 450000,
  origenListaPrecios: "Porkcolombia / Ronda de precios #16 (31 jul 2026)"
};

const MARKET_SOURCE_URLS = [
  "https://r.jina.ai/http://https://porkcolombia.co/ronda_de_precios/boletin-quincenal-16-julio-2026/",
  "https://r.jina.ai/http://https://porkcolombia.co/ronda-de-precios/"
];

function parseNumericValue(raw) {
  if (raw === undefined || raw === null || raw === "") return null;

  const text = String(raw).trim();
  if (!text) return null;

  const normalized = text
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBenchmarkFromText(text) {
  if (!text) return null;

  // IMPORTANT: el boletín de Porkcolombia reporta el precio del cerdo vivo en COP/kg.
  // No debe convertirse con TRM porque la referencia ya viene en pesos colombianos.
  const cerdoMatch = text.match(/Promedio nacional\s+([0-9]{1,2}\.[0-9]{3})/i);
  const cerdoCop = parseNumericValue(cerdoMatch ? cerdoMatch[1] : null);

  if (cerdoCop !== null) {
    return {
      costoAlimentoCopKg: DEFAULTS.costoAlimentoCopKg,
      precioCerdoCopKg: Math.round(cerdoCop),
      origenListaPrecios: "Porkcolombia / Ronda de precios (COP/kg, valor directo del boletín)"
    };
  }

  return null;
}

export async function refreshMarketDefaults() {
  for (const url of MARKET_SOURCE_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const text = await response.text();
      const parsed = extractBenchmarkFromText(text);
      if (parsed) {
        DEFAULTS = {
          ...DEFAULTS,
          costoAlimentoCopKg: parsed.costoAlimentoCopKg,
          precioCerdoCopKg: parsed.precioCerdoCopKg,
          origenListaPrecios: parsed.origenListaPrecios
        };
        return DEFAULTS;
      }
    } catch (error) {
      console.warn(`No se pudo consultar Porkcolombia en ${url}:`, error);
    }
  }

  console.warn("Usando valores locales por defecto porque no fue posible leer Porkcolombia.");
  return DEFAULTS;
}

function normalizeDisplayText(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").replace(/\s*\|\s*/g, " | ");
}

function normalizeCatalogItem(item) {
  const observaciones = normalizeDisplayText(item.observaciones, "Extraído del PDF BioARA");
  const estadoRaw = normalizeDisplayText(item.estado, "").toLowerCase();
  const isPending = estadoRaw === "pendiente por confirmar" || /pendiente por confirmar/i.test(observaciones);

  return {
    ...item,
    producto: normalizeDisplayText(item.producto, "Producto"),
    categoria: normalizeDisplayText(item.categoria, "General"),
    presentacion: normalizeDisplayText(item.presentacion, "1 unidad"),
    unidadPresentacion: normalizeDisplayText(item.unidadPresentacion, item.unidadPresentacion || "und"),
    precioUnitarioCop: Number(item.precioUnitarioCop) || 0,
    costoReferenciaCop: Number(item.costoReferenciaCop) || Number(item.precioUnitarioCop) || 0,
    observaciones,
    estado: isPending ? "pendiente por confirmar" : "activo"
  };
}

const FALLBACK_PRICE_CATALOG = [
  {
    producto: "BIOASIS",
    categoria: "Simbiotico",
    presentacion: "1 kg",
    unidadPresentacion: "kg",
    precioUnitarioCop: 178000,
    costoReferenciaCop: 178000,
    observaciones: "Extraído del PDF BioARA - 500 g / 178.000 COP"
  },
  {
    producto: "BUTYRIBIOL 2",
    categoria: "Probiotico_Prebiotico_Postbiotico",
    presentacion: "1 kg",
    unidadPresentacion: "kg",
    precioUnitarioCop: 180000,
    costoReferenciaCop: 180000,
    observaciones: "Extraído del PDF BioARA - 5 K a 900.000 COP"
  },
  {
    producto: "Bio L.r.",
    categoria: "Probiotico_Soluble",
    presentacion: "1 kg",
    unidadPresentacion: "kg",
    precioUnitarioCop: 111000,
    costoReferenciaCop: 111000,
    observaciones: "Extraído del PDF BioARA - 5 K a 555.000 COP"
  },
  {
    producto: "BIO LPS",
    categoria: "Inmunomodulador",
    presentacion: "1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 247000,
    costoReferenciaCop: 247000,
    observaciones: "Extraído del PDF BioARA - Frasco x 1 L"
  },
  {
    producto: "HI-2",
    categoria: "Probio_Electrolitos_Energia",
    presentacion: "1 kg",
    unidadPresentacion: "kg",
    precioUnitarioCop: 178000,
    costoReferenciaCop: 178000,
    observaciones: "Extraído del PDF BioARA - 1 K a 178.000 COP"
  },
  {
    producto: "BRONCOBIOL",
    categoria: "Mucolitico_Expectorante",
    presentacion: "1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 37500,
    costoReferenciaCop: 37500,
    observaciones: "Extraído del PDF BioARA - Garrafa x 4 L a 150.000 COP"
  },
  {
    producto: "BIOPOL D-49",
    categoria: "Desinfectante",
    presentacion: "1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 75750,
    costoReferenciaCop: 75750,
    observaciones: "Extraído del PDF BioARA - Garrafa x 4 L a 303.000 COP"
  },
  {
    producto: "Bio-Protector",
    categoria: "Farmacéutico_Apoyo",
    presentacion: "Sobre x 1 K",
    unidadPresentacion: "kg",
    precioUnitarioCop: 45000,
    costoReferenciaCop: 45000,
    observaciones: "Aditivo farmacéutico de apoyo; sobre x 1 kg - 45.000 COP"
  },
  {
    producto: "Bioenergetic",
    categoria: "Farmacéutico_Apoyo",
    presentacion: "Jeringa x 20 ml",
    unidadPresentacion: "ml",
    precioUnitarioCop: 43000,
    costoReferenciaCop: 43000,
    observaciones: "Bioenergetic, jeringa x 20 ml - 43.000 COP"
  },
  {
    producto: "Triple AAA",
    categoria: "Farmacéutico_Apoyo",
    presentacion: "Sobre x 500 g",
    unidadPresentacion: "g",
    precioUnitarioCop: 84000,
    costoReferenciaCop: 84000,
    observaciones: "Triple AAA para aves y cerdos; sobre x 500 g - 84.000 COP"
  },
  {
    producto: "Neutrobiol",
    categoria: "Farmacéutico_Apoyo",
    presentacion: "Caja por 100 sobres",
    unidadPresentacion: "sobres",
    precioUnitarioCop: 606000,
    costoReferenciaCop: 606000,
    observaciones: "Neutrobiol; caja por 100 sobres - 606.000 COP"
  },
  {
    producto: "Broncobiol",
    categoria: "Farmacéutico_Respiratorio",
    presentacion: "Garrafa x 4 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 150000,
    costoReferenciaCop: 150000,
    observaciones: "Broncobiol; garrafa x 4 L - 150.000 COP"
  },
  {
    producto: "Broncobiol 20 L",
    categoria: "Farmacéutico_Respiratorio",
    presentacion: "Garrafa x 20 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 694000,
    costoReferenciaCop: 694000,
    observaciones: "Broncobiol; garrafa x 20 L - 694.000 COP"
  },
  {
    producto: "POLYBIOCIDEX NF",
    categoria: "Desinfectante_Detergente_Biocida",
    presentacion: "4 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 50000,
    costoReferenciaCop: 50000,
    observaciones: "BioARA - Garrafa x 4 L a 200.000 COP; referencia de 20 L a 819.000 COP"
  },
  {
    producto: "PYAM",
    categoria: "Detergente_Biocida",
    presentacion: "Tablet x 1,67 g",
    unidadPresentacion: "tab",
    precioUnitarioCop: 2340,
    costoReferenciaCop: 2340,
    observaciones: "BioARA - Tarro x 200 tabletas x 1,67 g a 468.000 COP"
  },
  {
    producto: "JELLKEM",
    categoria: "Desinfectante_Detergente_Biocida",
    presentacion: "4 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 30000,
    costoReferenciaCop: 30000,
    observaciones: "BioARA - Garrafa x 4 L a 120.000 COP + IVA; referencia 20 L a 518.000 COP + IVA"
  },
  {
    producto: "CLEANEX F48",
    categoria: "Desinfectante_Detergente_Biocida",
    presentacion: "4 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 31950,
    costoReferenciaCop: 31950,
    observaciones: "BioARA - Garrafa x 4 L a 127.800 COP + IVA; referencia 20 L a 570.000 COP + IVA"
  },
  {
    producto: "Bio Fly",
    categoria: "Control_Biologico_Moscas",
    presentacion: "Bolsa x 500 g",
    unidadPresentacion: "g",
    precioUnitarioCop: 30000,
    costoReferenciaCop: 30000,
    observaciones: "Control biológico de moscas; bolsa x 500 g - precio de referencia 30.000 COP"
  },
  {
    producto: "Trampa Atrapamoscas",
    categoria: "Control_Moscas",
    presentacion: "1 unidad",
    unidadPresentacion: "und",
    precioUnitarioCop: 60000,
    costoReferenciaCop: 60000,
    observaciones: "Trampa para control físico de moscas - precio de referencia 60.000 COP"
  },
  {
    producto: "Brodifacoum pellets",
    categoria: "Rodenticida",
    presentacion: "Balde 2.5 K",
    unidadPresentacion: "kg",
    precioUnitarioCop: 414700,
    costoReferenciaCop: 414700,
    observaciones: "Rodenticida granular para control de roedores; balde 2.5 K - 414.700 COP"
  },
  {
    producto: "Deltaforce 2,5% EC",
    categoria: "Insecticida",
    presentacion: "Frasco x 1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 504900,
    costoReferenciaCop: 504900,
    observaciones: "Insecticida para control de insectos y vectores; frasco x 1 L - 504.900 COP"
  },
  {
    producto: "ANALOGUE EC 10%",
    categoria: "Insecticida",
    presentacion: "Frasco x 1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 298000,
    costoReferenciaCop: 298000,
    observaciones: "Insecticida de contacto; frasco x 1 L - 298.000 COP"
  },
  {
    producto: "Diclorvos EC 50%",
    categoria: "Insecticida",
    presentacion: "Frasco x 1 L",
    unidadPresentacion: "L",
    precioUnitarioCop: 313000,
    costoReferenciaCop: 313000,
    observaciones: "Insecticida para control de insectos; frasco x 1 L - 313.000 COP"
  },
  {
    producto: "EUBIOL",
    categoria: "Biologico",
    presentacion: "Bolsa x 1 kg y 10 kg",
    unidadPresentacion: "kg",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "BACTERINA HS F",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "BACTERINA PLEUROSUIS",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "BACTERINA MYCOSUIS HP",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "BACTERINA TOXOIDE E. COLI",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "E. COLI ORAL",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "CEPA F",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  },
  {
    producto: "ADITIVO PRRSv",
    categoria: "Biologico",
    presentacion: "Según ficha técnica",
    unidadPresentacion: "und",
    precioUnitarioCop: 0,
    costoReferenciaCop: 0,
    observaciones: "Ficha técnica validada; precio comercial: Cotizar",
    estado: "activo"
  }
];

function parseCsvPriceCatalog(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return FALLBACK_PRICE_CATALOG;

  const headers = lines[0].split(",").map((header) => header.trim());
  const records = lines.slice(1).map((line) => {
    const rawValues = line.match(/("[^"]*"|[^,]+)(?=,|$)/g) ?? [];
    const values = rawValues.map((value) => value.replace(/^"|"$/g, "").trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });

  return records
    .filter((row) => row.producto)
    .map((row) => normalizeCatalogItem({
      producto: row.producto,
      categoria: row.categoria || "Extraido_PDF",
      presentacion: row.presentacion || "1 kg",
      unidadPresentacion: row.unidad_presentacion || "kg",
      precioUnitarioCop: Number(row.precio_unitario_cop) || 0,
      costoReferenciaCop: Number(row.costo_referencia_por_kg_o_litro_cop) || Number(row.precio_unitario_cop) || 0,
      observaciones: row.observaciones || "Extraído del PDF BioARA",
      estado: row.estado || ""
    }));
}

async function loadPriceCatalog() {
  const csvPath = new URL("../../V1_app_data/01_precios_supuestos_bioara.csv", import.meta.url);

  try {
    const response = await fetch(csvPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("CSV no disponible");
    }
    const csvText = await response.text();
    const parsed = parseCsvPriceCatalog(csvText);
    if (parsed.length) return parsed;
  } catch (error) {
    console.warn("No se pudo cargar la CSV, usando fallback PDF:", error);
  }

  return FALLBACK_PRICE_CATALOG;
}

export const PRICE_CATALOG = (await loadPriceCatalog()).map(normalizeCatalogItem);
export const PRODUCT_PRICES_COP = Object.fromEntries(
  PRICE_CATALOG.map((item) => [item.producto, Number(item.precioUnitarioCop)])
);

export const PROTOCOL_LIBRARY = {
  Digestivo: [
    {
      producto: "Bio L.r.",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 150,
      doseMax: 150,
      doseUnit: "g/1000L",
      duracionDias: 14,
      notes: "150 g por 1000 L de agua al día"
    },
    {
      producto: "HI-2",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 1.5,
      doseMax: 1.5,
      doseUnit: "kg/1000L",
      duracionDias: 7,
      notes: "1.5 kg por 1000 L de agua al día"
    },
    {
      producto: "BUTYRIBIOL 2",
      ruta: "alimento",
      doseMode: "per_ton",
      doseMin: 0.75,
      doseMax: 0.75,
      doseUnit: "kg/ton",
      duracionDias: 14,
      notes: "0.75 kg por tonelada de alimento al día"
    },
    {
      producto: "BIO LPS",
      ruta: "animal",
      doseMode: "per_bodyweight",
      doseMin: 0.1,
      doseMax: 0.1,
      doseUnit: "ml/kg pv",
      duracionDias: 14,
      notes: "Cerdos adultos: 1 ml por cada 10 kg de peso vivo; lechones: 0.5 ml al nacimiento y 1 ml al destete"
    }
  ],
  Respiratorio: [
    {
      producto: "Broncobiol",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 5,
      doseUnit: "ml/lechón/día",
      duracionDias: 5,
      notes: "2 a 5 ml por lechón al día, máximo 5 días"
    }
  ],
  Inmune: [
    {
      producto: "BIO LPS",
      ruta: "animal",
      doseMode: "per_bodyweight",
      doseMin: 0.1,
      doseMax: 0.1,
      doseUnit: "ml/kg pv",
      duracionDias: 14,
      notes: "Cerdos adultos: 1 ml por cada 10 kg de peso vivo; lechones: 0.5 ml al nacimiento y 1 ml al destete"
    },
    {
      producto: "Bio-Protector",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 4,
      doseMax: 4,
      doseUnit: "kg/1000L",
      duracionDias: 1,
      notes: "Disolver 1 kg en 250 L de agua, equivalente a 4 kg por 1000 L"
    },
    {
      producto: "Bioenergetic",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 1,
      doseMax: 1,
      doseUnit: "ml/lechón",
      duracionDias: 1,
      notes: "Lechones: 1 ml al nacimiento y repetir a las 6-12 horas; cerdas: 10 ml durante el parto y repetir a la media hora"
    },
    {
      producto: "BUTYRIBIOL 2",
      ruta: "alimento",
      doseMode: "per_ton",
      doseMin: 0.75,
      doseMax: 0.75,
      doseUnit: "kg/ton",
      duracionDias: 14,
      notes: "Soporte intestinal complementario"
    }
  ],
  Estres: [
    {
      producto: "HI-2",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 1.5,
      doseMax: 1.5,
      doseUnit: "kg/1000L",
      duracionDias: 7,
      notes: "Soporte electrolítico y energético"
    },
    {
      producto: "Bioenergetic",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 1,
      doseMax: 1,
      doseUnit: "ml/lechón",
      duracionDias: 1,
      notes: "Lechones: 1 ml al nacimiento y repetir a las 6-12 horas; cerdas: 10 ml durante el parto y repetir a la media hora"
    },
    {
      producto: "Bio L.r.",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 150,
      doseMax: 150,
      doseUnit: "g/1000L",
      duracionDias: 14,
      notes: "Estabilidad digestiva durante estrés"
    },
    {
      producto: "BUTYRIBIOL 2",
      ruta: "alimento",
      doseMode: "per_ton",
      doseMin: 0.75,
      doseMax: 0.75,
      doseUnit: "kg/ton",
      duracionDias: 14,
      notes: "Soporte intestinal"
    },
    {
      producto: "BIO LPS",
      ruta: "animal",
      doseMode: "per_bodyweight",
      doseMin: 0.1,
      doseMax: 0.1,
      doseUnit: "ml/kg pv",
      duracionDias: 14,
      notes: "Cerdos adultos: 1 ml por cada 10 kg de peso vivo; lechones: 0.5 ml al nacimiento y 1 ml al destete"
    }
  ],
  Nutricional_Metabolico: [
    {
      producto: "HI-2",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 1.5,
      doseMax: 1.5,
      doseUnit: "kg/1000L",
      duracionDias: 7,
      notes: "Soporte metabólico"
    },
    {
      producto: "Bioenergetic",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 1,
      doseMax: 1,
      doseUnit: "ml/lechón",
      duracionDias: 1,
      notes: "Lechones: 1 ml al nacimiento y repetir a las 6-12 horas; cerdas: 10 ml durante el parto y repetir a la media hora"
    },
    {
      producto: "BUTYRIBIOL 2",
      ruta: "alimento",
      doseMode: "per_ton",
      doseMin: 0.75,
      doseMax: 0.75,
      doseUnit: "kg/ton",
      duracionDias: 14,
      notes: "Soporte intestinal para mejor aprovechamiento"
    },
    {
      producto: "BIO LPS",
      ruta: "animal",
      doseMode: "per_bodyweight",
      doseMin: 0.1,
      doseMax: 0.1,
      doseUnit: "ml/kg pv",
      duracionDias: 14,
      notes: "Cerdos adultos: 1 ml por cada 10 kg de peso vivo; lechones: 0.5 ml al nacimiento y 1 ml al destete"
    },
    {
      producto: "Bio-Protector",
      ruta: "agua",
      doseMode: "per_1000L",
      doseMin: 4,
      doseMax: 4,
      doseUnit: "kg/1000L",
      duracionDias: 1,
      notes: "Disolver 1 kg en 250 L de agua, equivalente a 4 kg por 1000 L"
    }
  ],
  Biologicos: [
    {
      producto: "BACTERINA MYCOSUIS PH (reemplazos y gestación)",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/cerda",
      duracionDias: 1,
      phaseTags: ["Gestante"],
      requiereCotizacion: true,
      notes: "Cerdas de reemplazo: 2 ml en aclimatación. Cerdas en gestación: 2 ml entre el día 90 y 100. Vacuna inactivada; usar a 4-7 °C y aplicar asépticamente."
    },
    {
      producto: "BACTERINA MYCOSUIS PH (lechones)",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/lechón",
      duracionDias: 2,
      phaseTags: ["Pre-iniciador", "Iniciador"],
      requiereCotizacion: true,
      notes: "Lechones: 2 ml entre 7 y 14 días de edad y repetir dos semanas después. Vacuna inactivada y segura para edades tempranas."
    },
    {
      producto: "BACTERINA AUTÓGENA E. coli ORAL",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 3,
      doseUnit: "ml/lechón",
      duracionDias: 2,
      phaseTags: ["Pre-iniciador", "Iniciador"],
      requiereCotizacion: true,
      notes: "Primera dosis 2 ml después del calostrado; segunda dosis 3 ml al destete. Administrar vía oral en lechones."
    },
    {
      producto: "ADITIVO INACTIVADO PRRSv (reemplazos y gestación)",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/cerda",
      duracionDias: 1,
      phaseTags: ["Gestante"],
      requiereCotizacion: true,
      notes: "Cerdas de reemplazo: 2 ml en aclimatación. Cerdas en gestación: 2 ml entre el día 90 y 100. Inactivado y sin riesgo de diseminación."
    },
    {
      producto: "ADITIVO INACTIVADO PRRSv (lechones)",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 1,
      doseMax: 1,
      doseUnit: "ml/lechón",
      duracionDias: 2,
      phaseTags: ["Pre-iniciador", "Iniciador"],
      requiereCotizacion: true,
      notes: "Lechones: 1 ml IM entre los 7 y 9 días de edad y repetir dos semanas después."
    },
    {
      producto: "BACTERINA TOXOIDE ESCHERICHIA COLI",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/cerda",
      duracionDias: 2,
      phaseTags: ["Gestante"],
      requiereCotizacion: true,
      notes: "Cerdas de cría: 2 ml IM. Reemplazos: dos dosis en aclimatación. Primerizas: 5 y 2 semanas antes del parto; refuerzo en gestaciones siguientes 2-3 semanas previas al parto."
    },
    {
      producto: "BACTERINA PLEUROSUIS",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/cerdo",
      duracionDias: 1,
      phaseTags: ["Gestante"],
      requiereCotizacion: true,
      notes: "Cerdas de reemplazo: 2 ml en aclimatación. Cerdas en gestación: 2 ml entre el día 90 y 100. Inactivada, segura y usable a edades tempranas."
    },
    {
      producto: "BACTERINA PLEUROSUIS (lechones)",
      ruta: "animal",
      doseMode: "per_animal",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "ml/lechón",
      duracionDias: 2,
      phaseTags: ["Pre-iniciador", "Iniciador"],
      requiereCotizacion: true,
      notes: "Lechones: 2 ml IM entre la 5 y 6 semana de edad y repetir dos semanas después."
    }
  ],
  Bioseguridad: [
    {
      producto: "BIOPOL D-49",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 2,
      doseMax: 2,
      doseUnit: "cc/L",
      duracionDias: 1,
      notes: "Lavado y desinfección de granjas, equipo y vehículos: 2 cc por litro de agua; cada litro de solución rinde para 4 m2 de superficie"
    },
    {
      producto: "POLYBIOCIDEX NF",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 3,
      doseMax: 6,
      doseUnit: "ml/L",
      duracionDias: 1,
      notes: "6 ml/L para plantas de incubación y huevo fértil; 3 ml/L para granjas, equipo y vehículos"
    },
    {
      producto: "JELLKEM",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 5,
      doseMax: 10,
      doseUnit: "cc/L",
      duracionDias: 1,
      notes: "Lavado de galpones y equipo: 5 a 10 cc por litro de agua; contacto 30 min a 1 h en galpones y 10 min en equipo"
    },
    {
      producto: "CLEANEX F48",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 5,
      doseMax: 10,
      doseUnit: "cc/L",
      duracionDias: 1,
      notes: "Lavado de galpones: 5 a 10 cc por litro de agua; rendimiento aproximado de 4 m2 por litro de solución"
    },
    {
      producto: "PYAM",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 0.3,
      doseMax: 0.3,
      doseUnit: "kg/1000m2",
      duracionDias: 2,
      notes: "Requiere ficha técnica específica para cerrar dosis exacta"
    },
    {
      producto: "Bio Fly",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 0.5,
      doseMax: 0.5,
      doseUnit: "kg/area",
      duracionDias: 7,
      notes: "Requiere ficha técnica específica para cerrar dosis exacta"
    },
    {
      producto: "Trampa Atrapamoscas",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 1,
      doseMax: 1,
      doseUnit: "und/area",
      duracionDias: 14,
      notes: "Requiere definir área tratada para calcular inversión"
    },
    {
      producto: "Brodifacoum pellets",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 0.6,
      doseMax: 0.6,
      doseUnit: "kg/area",
      duracionDias: 14,
      notes: "Requiere definir área tratada para calcular inversión"
    },
    {
      producto: "Deltaforce 2,5% EC",
      ruta: "area",
      doseMode: "per_area",
      doseMin: 0.2,
      doseMax: 0.2,
      doseUnit: "L/area",
      duracionDias: 2,
      notes: "Requiere definir área tratada para calcular inversión"
    }
  ]
};

export const STANDARD_PROTOCOL = PROTOCOL_LIBRARY.Digestivo;
