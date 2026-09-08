# Demo BioARA V1 - Local y Desconectada

## Stack exacto recomendado
- Frontend: Web App con JavaScript modular.
- Modo offline: Service Worker + IndexedDB.
- Persistencia local: IndexedDB (sin servidor).
- Exportacion de datos: CSV.
- Instalacion tipo app: PWA (instalable desde navegador).

## Estructura tecnica
- index.html: interfaz principal.
- styles.css: estilos responsive.
- manifest.webmanifest: metadatos PWA.
- sw.js: cache para funcionamiento sin red.
- app/config.js: precios supuestos y protocolo base.
- app/calc.js: motor de calculo zootecnico y ROI.
- app/db.js: base local IndexedDB.
- app/csv.js: exportacion CSV.
- app/ui.js: render de resultados e historico.
- app/main.js: orquestacion y eventos.

## Gobernanza tecnica y control de calidad
- Protocolo HARNESS del proyecto: ../GRAFOS_ARNES_AGENTES.md
- Este protocolo define quality gates para cambios en catalogo, reglas de recomendacion y validaciones.

## Flujo de sincronizacion (demo)
1. Caso creado sin internet: estado offline_pending.
2. Caso creado con internet: estado pending.
3. Boton Simular sincronizacion: cambia a synced con fecha syncedAt.

## Como ejecutar local hoy
1. Abrir terminal en esta carpeta.
2. Ejecutar:

```powershell
python -m http.server 8080
```

3. Abrir en navegador:
- http://localhost:8080

## Que permite esta demo
- Registrar cliente, granja y lote.
- Capturar fase, peso, edad, animales y variables economicas.
- Calcular consumo agua/alimento, dosis, inversion y ROI.
- Guardar historico local incluso sin internet.
- Exportar todos los casos en CSV.

## Camino de evolucion a produccion
1. V1.1: integrar Google Sheets (mismos campos).
2. V1.1.1: semaforo visual (verde/amarillo/rojo) para alertas de mortalidad y FCA.
3. V1.1.2: umbrales editables por granja y cliente, diferenciados por fase.
4. V1.2: API central (FastAPI o Node) para sync real.
5. V1.3: autenticacion por usuario y auditoria de cambios.
6. V2.0: motor inteligente de recomendacion por desafio y fase.
