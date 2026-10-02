# Informe de uso y datos almacenados

Fecha de corte: 2026-10-01
Aplicación evaluada: Porcicultura Demo 1 — BioARA AI
URL: https://poultryia.com/porcicultura-demo-1/?t=porc2026-EvalDemo-x7K9mQz

## 1) Objetivo

1. Estimar cuántas veces han consultado la aplicación.
2. Identificar qué datos están almacenados actualmente.
3. Dejar evidencia determinista en formato auditable.

## 2) Fuentes usadas (deterministas)

1. API pública del demo:
- GET https://poultryia.com/api/porc/health
- GET https://poultryia.com/api/porc/cases

2. Código de persistencia del backend:
- [PORCICULTURA/porcicultura_demo_1/server/src/store.js](PORCICULTURA/porcicultura_demo_1/server/src/store.js)
- [PORCICULTURA/porcicultura_demo_1/server/server.js](PORCICULTURA/porcicultura_demo_1/server/server.js)

## 3) Resultado de uso (consultas)

### 3.1 Consultas registradas (casos)

- Total de casos almacenados: 16
- Último caso: CASO-1790344466858-515764
- Último estado observado: approved

Interpretación:
- Cada caso representa una consulta operativa completada en backend.
- Por lo tanto, hay 16 consultas trazables de forma determinista.

### 3.2 Ciclo de operación observado

- Estados por caso: {"approved": 16}
- Casos aprobados: 16
- Casos con PDF generado: 16
- Casos con registro de correo: 16
- Correos en dry_run: 8
- Correos enviados por SMTP: 8

### 3.3 Ventana temporal de uso registrada

- Primer caso creado: 2026-09-22T21:48:04.564Z
- Último caso creado: 2026-09-25T13:54:26.868Z
- Primer caso actualizado: 2026-09-22T21:48:07.650Z
- Último caso actualizado: 2026-09-25T13:54:29.581Z

### 3.4 Sobre "cuántas veces han entrado a la página"

- No existe instrumentación de page_view en frontend ni endpoint dedicado para visitas.
- Sin analítica web activa (por ejemplo, Matomo/GA) ni conteo consolidado de logs en una fuente accesible por API, no es posible calcular visitas de página exactas de forma determinista con el diseño actual.
- Cota mínima verificable: al menos 16 ingresos con interacción real, porque hay 16 casos persistidos.

## 4) Qué datos hay en la "base de datos" de esta aplicación

Hallazgo clave:
- Esta app no usa una base de datos relacional en el backend del demo.
- La persistencia es por archivos JSON en DATA_DIR (casos y auditoría), según [PORCICULTURA/porcicultura_demo_1/server/src/store.js](PORCICULTURA/porcicultura_demo_1/server/src/store.js).

### 4.1 Estructura principal de cada caso

Campos de primer nivel observados:
- id
- createdAt
- updatedAt
- status
- version
- payload
- jev
- approval
- pdf
- email

### 4.2 Campos observados en payload (resumen)

Ejemplos de campos de negocio presentes:
- cliente, granja, fase, viaPreferida, desafio
- totalAnimalesCliente, animalesTratar, pesoPromedio, edadDias
- consumoAlimentoRealKgDia, consumo
- protocolos, financiero, recomendaciones
- approvedProtocols, approvedFinancial, approvalResolved
- emailCliente, emailBioara, veterinaryNotes
- inversionTotalCop, roiPct, jev

### 4.3 Subestructuras adicionales

approval:
- veterinarianName, viaAprobada, dosisAprobada, diasAprobados, observaciones, approvedAt, signed

pdf:
- fileName, absolutePath, generatedAt

email:
- caseId, to, cc, subject, body, provider, status, trackingId, sentAt

## 5) Segmentos de uso observados

- vía preferida detectada en los casos: ["Agua"]
- desafío detectado en los casos: ["Digestivo"]

## 6) Conclusión ejecutiva

1. Consultas operativas deterministas registradas: 16.
2. Visitas de página exactas: no medibles hoy con precisión determinista por falta de instrumentación explícita de page_view.
3. Persistencia actual: archivos JSON (casos, auditoría) y artefactos PDF, no una BD SQL en este demo.

## 7) Recomendación para cerrar el gap de visitas

Para responder en adelante con un número exacto de "entradas a la página", agregar un evento backend explícito de page_view con:
1. timestamp
2. ruta
3. ip hash
4. user-agent hash
5. token de campaña (si aplica)

Con eso, el próximo informe podrá reportar:
- total de visitas
- visitantes únicos aproximados
- consultas iniciadas
- consultas completadas
- tasa de conversión visita -> caso
