import csv
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
PDF_PATH = PROJECT_ROOT / "LISTA DE PRECIOS" / "LISTA DE PRECIOS 2026 BIOARA.pdf"
CSV_PATH = PROJECT_ROOT / "V1_app_data" / "01_precios_supuestos_bioara.csv"

# Valores comprobados directamente del PDF y convertidos a referencia por unidad (kg/L)
PRICE_RULES = {
    "BIOASIS": {"aliases": ["Bioasis", "Bioasis NF"], "value": 178000, "presentacion": "1 kg", "unidad": "kg", "obs": "Extraído del PDF BioARA - 500 g a 178.000 COP"},
    "BUTYRIBIOL 2": {"aliases": ["Butyribiol 2", "BUTYRIBIOL 2"], "value": 180000, "presentacion": "1 kg", "unidad": "kg", "obs": "Extraído del PDF BioARA - 5 K a 900.000 COP"},
    "Bio L.r.": {"aliases": ["Bio-Lr", "Bio L.r."], "value": 111000, "presentacion": "1 kg", "unidad": "kg", "obs": "Extraído del PDF BioARA - 5 K a 555.000 COP"},
    "BIO LPS": {"aliases": ["Bio-LPS", "BIO LPS"], "value": 247000, "presentacion": "1 L", "unidad": "L", "obs": "Extraído del PDF BioARA - Frasco x 1 L"},
    "HI-2": {"aliases": ["H.I. 2", "HI-2"], "value": 178000, "presentacion": "1 kg", "unidad": "kg", "obs": "Extraído del PDF BioARA - 1 K a 178.000 COP"},
    "BRONCOBIOL": {"aliases": ["Broncobiol"], "value": 37500, "presentacion": "1 L", "unidad": "L", "obs": "Extraído del PDF BioARA - Garrafa x 4 L a 150.000 COP"},
    "BIOPOL D-49": {"aliases": ["BIOPOL D49", "BIOPOL D-49"], "value": 75750, "presentacion": "1 L", "unidad": "L", "obs": "Extraído del PDF BioARA - Garrafa x 4 L a 303.000 COP"},
}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_pdf_prices() -> list[dict]:
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"No existe el PDF: {PDF_PATH}")

    reader = PdfReader(str(PDF_PATH))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    normalized_text = normalize_text(text)

    rows = []
    for product, rule in PRICE_RULES.items():
        alias_found = False
        for alias in rule["aliases"]:
            if alias.lower() in normalized_text.lower():
                alias_found = True
                break
        if not alias_found:
            raise ValueError(f"No se encontró el producto en el PDF: {product}")

        rows.append(
            {
                "fecha_actualizacion": "2026-08-11",
                "producto": product,
                "categoria": "Extraido_PDF",
                "presentacion": rule["presentacion"],
                "unidad_presentacion": rule["unidad"],
                "precio_unitario_cop": rule["value"],
                "costo_referencia_por_kg_o_litro_cop": rule["value"],
                "observaciones": rule["obs"],
            }
        )

    return rows


def write_csv(rows: list[dict], output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "fecha_actualizacion",
        "producto",
        "categoria",
        "presentacion",
        "unidad_presentacion",
        "precio_unitario_cop",
        "costo_referencia_por_kg_o_litro_cop",
        "observaciones",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    rows = extract_pdf_prices()
    write_csv(rows, CSV_PATH)
    print(f"CSV generado: {CSV_PATH}")
    for row in rows:
        print(f"{row['producto']}: {row['precio_unitario_cop']} COP")
