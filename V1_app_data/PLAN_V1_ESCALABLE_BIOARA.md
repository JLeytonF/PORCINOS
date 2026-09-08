# Plan V1 Escalable BioARA Swine AI

## Objetivo
Construir una V1 funcional, simple y trazable para adopcion por el personal, con crecimiento por etapas sin rehacer la base de datos.

## Enfoque recomendado ahora
Usar CSV como base operativa inicial. Ventajas:
- Implementacion inmediata y sin dependencia de credenciales.
- Se abre directo en Excel o Google Sheets.
- Versionable y auditable en el repositorio.
- Facil migracion futura a PostgreSQL o MySQL.

## Estructura de datos creada
1. 01_precios_supuestos_bioara.csv
2. 02_clientes_granjas.csv
3. 03_lotes_y_diagnostico_entrada.csv
4. 04_protocolos_aplicados.csv
5. 05_resultados_roi.csv
6. 06_parametros_default_v1.csv

## Flujo de trabajo V1
1. Registrar cliente y granja.
2. Registrar lote y diagnostico de entrada.
3. Calcular protocolo y guardarlo por producto.
4. Guardar cierre economico ROI.
5. Revisar historico por cliente, granja, etapa y producto.

## Campos criticos para no perder trazabilidad
- Identificadores: cliente_id, granja_id, lote_id, caso_id, aplicacion_id, resultado_id.
- Fechas: registro, inicio, fin, evaluacion.
- Productivo: etapa, peso, numero animales lote, numero animales a tratar.
- Sanitario: desafio principal, sintomas, mortalidad, FCA.
- Economico: costos unitarios, inversion total, beneficios y ROI.

## Reglas operativas sugeridas
- No borrar filas historicas; usar nuevos registros por actualizacion.
- Mantener formato de IDs con prefijos (CLI, GRA, LOTE, CASO, APL, RES).
- Actualizar precios en 01_precios_supuestos_bioara.csv sin cambiar nombres de producto.
- Si hay dato faltante, usar 06_parametros_default_v1.csv y marcarlo en observaciones.

## Evolucion V1 a V2
- V1.1: Integracion de Google Sheets (mismos encabezados).
- V1.1.1: Semaforo visual de riesgo sanitario (verde/amarillo/rojo) para mortalidad y FCA en la pantalla de resultados.
- V1.1.2: Umbrales tecnicos editables por granja y cliente (estandar propio por fase) con persistencia local.
- V1.2: Dashboard de adopcion y KPI (mortalidad, FCA, costo por cerdo).
- V1.3: API y BD relacional (PostgreSQL) con usuarios y permisos.
- V2.0: Reglas de recomendacion automatica por desafio y fase.

## KPI minimos de adopcion
- Porcentaje de casos con datos completos.
- Tiempo promedio de registro por caso.
- Diferencia entre ROI proyectado y ROI observado.
- Reduccion de mortalidad y mejora de FCA por fase.
