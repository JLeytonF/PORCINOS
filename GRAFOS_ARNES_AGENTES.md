# PROTOCOLO DE VERIFICACIÓN Y SEGUIMIENTO TÉCNICO (HARNESS)

Sistema de auditoría metodológica para pipelines, agentes autónomos y automatización de datos en PoultryIA

Versión: 3.1
Fecha: 2026-09-23
Estado: Producción / operativo

---

## 1. Propósito

Este documento define los invariantes arquitectónicos, los quality gates y los requisitos de evidencia que deben cumplirse antes de cerrar cualquier tarea ejecutada por agentes IA, flujos ETL, scripts analíticos, automatizaciones de datos o procedimientos de corrección de producción dentro del ecosistema PoultryIA.

Su objetivo operativo es garantizar que:

- las decisiones queden trazables,
- las transformaciones críticas se ejecuten con lógica determinista,
- las operaciones no dependan de inferencia libre del modelo,
- los fallos se corrijan en la infraestructura o en el código real, no con prompts más largos,
- cada cambio deje evidencia verificable en el repositorio o en artefactos del proyecto.

---

## 2. Principios fundamentales

### 2.1. Separación cerebro / plomería

Toda operación crítica debe separarse en dos capas:

- Cerebro: razonamiento, clasificación, decisión contextual, estrategia.
- Plomería: validación, parsing, transformaciones, persistencia, SQL, API calls, deduplicación, normalización y auditoría.

La plomería debe implementarse en código determinista (Python, SQL, scripts y validadores), nunca en la improvisación del LLM.

### 2.2. Cero alucinaciones financieras o operativas

Ningún cálculo financiero, flujo de conversión, KPI o regla zootécnica puede inferirse sin respaldo técnico. Si el dato no existe, debe marcarse como faltante, pendiente por confirmar o cotizar; nunca inventarse.

### 2.3. Evidencia antes de cierre

La ausencia de error no es evidencia de éxito. Toda tarea debe dejar:

- cambios rastreables en código o artefactos,
- validación ejecutada,
- salida física útil,
- registro del resultado en documentación o logs,
- señal clara de si la ejecución fue exitosa o bloqueada.

### 2.4. Corrección localizada

Si un bloque falla, se corrige ese bloque. No se parchea todo el flujo por una causa puntual. La corrección debe ser de raíz y acotada.

### 2.5. Motores de puntuación rápida (JEV / filtros ligeros)

En PoultryIA, especialmente en flujos de mercado, indicadores y validación operativa, debe existir una etapa de filtrado rápida antes de escalar a un modelo pesado, una revisión humana o una publicación automática.

Este motor no reemplaza a la lógica de negocio ni al análisis profundo; actúa como un gate determinista de entrada.

#### 2.5.1. Principio JEV

La metodología JEV significa:

- J = Justificación: ¿la decisión tiene un motivo técnico y contextual claro?
- E = Evidencia: ¿existe dato, fuente o evento verificable detrás del valor?
- V = Verificación: ¿la evidencia es consistente, plausible y segura para avanzar?

La implementación real del proyecto ya refleja este patrón en [server_mercado_py/agents/jev_validator.py](../server_mercado_py/agents/jev_validator.py) y [server_mercado_py/agents/node_validator.py](../server_mercado_py/agents/node_validator.py), donde cada indicador se valida con:

- confianza calculada en rango 0.0–1.0,
- checks de validación por peso,
- umbral configurable (por ejemplo 0.90),
- acción de decisión: PUBLICAR / REVISAR / RECHAZAR,
- evidencia histórica y variación porcentual respecto al valor previo.

#### 2.5.2. Regla de uso

El flujo debe seguir este patrón:

1. Captura / scrape / ingestión.
2. Validación rápida de consistencia y plausibilidad.
3. Cálculo de confianza mediante score determinista.
4. Gate: si la puntuación no supera el umbral, no se avanza a publicación ni a inferencia costosa.
5. Si pasa, se puede continuar con análisis más profundo o con publicación controlada.

#### 2.5.3. Qué debe evaluar un motor ligero

- fuente conocida y legible,
- HTTP exitoso o ingestión válida,
- valor dentro de rangos plausibles del dominio,
- variación aceptable frente al histórico,
- consistencia del dato con el contexto del indicador,
- ausencia de valores nulos, duplicados o inconsistentes.

#### 2.5.4. Regla de diseño

Los motores de puntuación rápida deben cumplir estas condiciones:

- ser deterministas, no adivinar,
- usar criterios explícitos y medibles,
- producir un score y una decisión clara,
- permitir auditoría humana,
- no reemplazar el análisis técnico profundo,
- dejar evidencia de cada check evaluado.

#### 2.5.5. Alineación con el proyecto

Esto es una práctica ya incorporada en la arquitectura de agentes del mercado y es un patrón que debe conservarse en cualquier flujo complejo de PoultryIA: primero un filtro rápido, luego la escalada a la capa de análisis más costosa.

---

## 3. Alcance del protocolo

Este protocolo aplica a cualquier actividad dentro de PoultryIA que involucre:

- agentes IA o asistentes de análisis,
- pipelines ETL,
- procesos de ingestión y limpieza de datos,
- scripts de automatización,
- transformaciones críticas sobre PostgreSQL,
- reportes, indicadores o dashboards que alimenten decisiones operativas,
- desarrollo de módulos y servicios Python, Node o frontend ligados al flujo de negocio.

---

## 4. Matriz de cumplimiento arquitectónico

Antes de cerrar cualquier tarea, el auditor técnico debe completar esta matriz.

| Capa / Componente | Requisito metodológico indispensable | Estado |
| :--- | :--- | :--- |
| 1. Contrato de tarea | Existe objetivo acotado, alcance, restricciones y criterio de aceptación antes de ejecutar. | [ ] Aprobado |
| 2. Topología de grafo | El flujo está dividido en nodos independientes (extractor, validador, transformador, verificador) con dependencias explícitas. | [ ] Aprobado |
| 3. Separación cerebro/plomería | Las operaciones deterministas se ejecutan en código, no por inferencia del agente. | [ ] Aprobado |
| 4. Estado estructurado | Los nodos se comunican con objetos tipados, dicts validados o tablas estructuradas, no texto libre. | [ ] Aprobado |
| 5. Verificación adversarial | Existe un rol de validación que intenta romper o invalidar la salida. | [ ] Aprobado |
| 6. Políticas congeladas | Las reglas críticas quedan fuera del alcance de la optimización del agente. | [ ] Aprobado |
| 7. Bucle de retroalimentación | En nodos críticos se aplica: producir → probar → corregir, máximo 3 intentos. | [ ] Aprobado |
| 8. Evidencia física | Hay artefactos generados en disco y verificados con evidencia de cambio. | [ ] Aprobado |
| 9. Seguridad y acceso | Se respetan reglas de multi-tenancy, permisos, sockets, puertos y secretos. | [ ] Aprobado |
| 10. Trazabilidad | La tarea queda documentada y revisable en repo, logs o checklist. | [ ] Aprobado |

---

## 5. Task Contract (contrato de tarea)

Toda tarea debe formalizarse antes de ejecutarse.

### 5.1. Estructura mínima obligatoria

Cada tarea debe responder estas preguntas:

1. ¿Cuál es el objetivo final?
2. ¿Qué está dentro del alcance?
3. ¿Qué está fuera de alcance?
4. ¿Qué datos de entrada existen?
5. ¿Qué salida se espera?
6. ¿Qué validaciones se deben ejecutar?
7. ¿Cuáles son las restricciones técnicas o de negocio?
8. ¿Qué criterio define éxito o falla?
9. ¿Qué artefactos deben dejarse?

### 5.2. Plantilla mínima

```yaml
id: tarea-001
objetivo: "..."
alcance:
  - "..."
  - "..."
fuera_de_alcance:
  - "..."
entradas:
  - "..."
restricciones:
  - "..."
criterio_aceptacion:
  - "..."
validaciones:
  - "..."
artefactos:
  - "..."
```

### 5.3. Regla de cierre

No se puede cerrar una tarea sin completar el criterio de aceptación y sin dejar evidencia de la validación.

---

## 6. Topología del grafo de ejecución

Todo flujo complejo debe representarse como un grafo con nodos tipados y aristas explícitas.

### 6.1. Tipos de nodo

- Extractor: obtiene datos desde fuente local, API, BD o archivo.
- Validador: verifica schema, nulos, rangos, fechas y consistencia referencial.
- Transformador: aplica reglas del dominio y limpieza determinista.
- Reducidor: agrega, consolida o resume datos sin perder trazabilidad.
- Verificador: prueba la salida, valida que cumpla la regla y documenta la evidencia.
- Publicador: escribe el resultado en DB, archivo o servicio destino.

### 6.2. Reglas del grafo

- Los nodos deben ser independientes cuando sea posible.
- Las dependencias deben estar explícitas.
- No se debe pasar texto libre como “estado del proceso” si ya existe un objeto o tabla estructurada.
- Cada nodo debe producir un resultado verificable.
- Si un nodo falla, su fallo debe rastrearse hasta la causa raíz.

### 6.3. Ejemplo mínimo de flujo

```text
Extractor -> Validador -> Transformador -> Verificador -> Publicador
      \____________________  ____________________/
                           |
                       Auditor
```

---

## 7. Estado estructurado y contratos de datos

Los nodos no deben comunicarse mediante texto libre del modelo. Deben usar:

- dicts validados,
- DataFrames con schema definido,
- JSON con campos explícitos,
- tablas con columnas y constraints,
- objetos enriquecidos con metadata de ejecución.

### 7.1. Requisitos mínimos

Cada salida intermedia debe incluir:

- source_id o referencia de origen,
- timestamp de ejecución,
- estado del registro,
- errores o advertencias,
- hash o fingerprint si aplica,
- validación de integridad.

### 7.2. Regla anti-hallucination

Si un dato no existe o no puede validarse, el flujo debe marcarlo como:

- null/pendiente,
- no disponible,
- pendiente por confirmar,
- cotizar,
- fuera de rango,
- no aplicable.

Nunca como “valor estimado” sin respaldo técnico.

---

## 8. Regla de oro de ejecución agentica

1. La ausencia de error no es evidencia de éxito.
2. Si falla un bloque, se corrige ese bloque; no todo el lote.
3. El humano interviene en gates de alto impacto: aprobación final, publicación y decisiones irreversibles.
4. Las decisiones operativas deben estar respaldadas por código determinista y validadores.
5. Los resultados de IA solo sirven para apoyar análisis, no para inventar cifras de negocio.

---

## 9. Protocolo ante fallos (Harness Flywheel)

Si un pipeline o agente falla, no se corrige con prompts más largos ni con más “razonamiento” verbal. Se corrige la infraestructura real: el código, la regla, la validación o el contrato.

### 9.1. Flujo de respuesta ante fallo

1. Clasificar el error:
   - timeout,
   - argumento inválido,
   - contexto faltante,
   - esquema roto,
   - validación fallida,
   - ambigüedad en el contrato,
   - fallo de conexión o de dependencias.

2. Determinar la causa raíz:
   - ¿es de entrada?
   - ¿es de validación?
   - ¿es de lógica de negocio?
   - ¿es de infraestructura?
   - ¿es de permisos, BD, puertos o API?

3. Convertir la observación en defensa permanente:
   - nueva prueba,
   - validador de esquema,
   - restricción de política,
   - ajuste del contrato técnico,
   - dato de salida más explícito y más acotado.

4. Reejecutar con evidencia:
   - mantener artefactos,
   - conservar logs,
   - documentar la corrección,
   - verificar que el flujo vuelve a ser determinista.

### 9.2. Política de reintentos

- Máximo 3 intentos por bloque crítico.
- Si falla el tercer intento, detener la ejecución y documentar bloqueo.
- No reintentar indefinidamente en producción.

---

## 10. Reglas congeladas (Frozen Rules)

Las reglas críticas deben quedar fuera del alcance del agente para optimización o improvisación.

En PoultryIA, estas reglas son especialmente relevantes:

- uso de PostgreSQL y migraciones con Python, no SQL directo a mano,
- no usar psql directamente para tareas operativas del proyecto,
- se debe respetar la política de puertos inmutables del sistema,
- los endpoints de demo / público deben distinguirse cuidadosamente de los de tenant registrado,
- las decisiones financieras deben basarse en datos verificados, no inferencias del modelo,
- los secretos y variables críticas deben mantenerse fuera del repositorio,
- la integridad referencial y la trazabilidad son obligatorias.

### 10.1. Reglas de protección

- no alterar puertos sin autorización explícita,
- no inventar columnas de BD sin verificar el schema real,
- no asumir endpoint ni payload si no existe evidencia del proyecto,
- no publicar cambios sin validación y evidencia.

---

## 11. Verificación adversarial (Red Team)

Toda ejecución crítica debe tener un rol explícito de invalidación.

### 11.1. Objetivo del Red Team

El rol de red team no es “decir que está bien” sino intentar romper la salida del flujo.

Debe verificar:

- si hay datos nulos o inconsistentes,
- si hay valores inventados,
- si la lógica descuida edge cases,
- si la salida se cumple en un escenario real,
- si se está validando el contrato correcto,
- si hay riesgo de fuga de información o errores de tenant.

### 11.2. Preguntas mínimas del Red Team

- ¿Qué pasa si la fuente llega vacía?
- ¿Qué pasa si existe un dato duplicado?
- ¿Qué pasa si hay fechas fuera de rango?
- ¿Qué pasa si el data source no se entrega en el formato esperado?
- ¿Qué pasa si el cálculo no tiene sustento verificable?
- ¿Qué pasa si el flujo se ejecuta con datos de producción reales?

### 11.3. Criterio de paso

Un flujo solo se considera validado si el red team no logra encontrar fallos severos en:

- integridad,
- esquema,
- determinismo,
- seguridad,
- trazabilidad,
- regresión funcional.

---

## 12. Evidencia física obligatoria

Todo cambio importante debe dejar artefactos verificables.

### 12.1. Artefactos aceptables

- scripts o módulos modificados,
- CSV/JSON/Parquet de datos procesados,
- reportes generados,
- logs de ejecución,
- snapshots de resultados,
- documentación de tareas o cambios,
- captura de la validación ejecutada.

### 12.2. Requiere evidencias mínimas

Para cerrar una tarea se deben mostrar:

- qué se ejecutó,
- qué cambió,
- qué comprobación se hizo,
- qué resultado obtuvo,
- cuál fue la decisión final.

---

## 13. Checklist mínimo de liberación

Antes de cerrar una iteración o entrega, se debe pasar la siguiente lista:

1. Se documentó el alcance y el criterio de aceptación.
2. Se definieron la entrada, la salida y las restricciones del flujo.
3. Se separó la lógica de negocio de la lógica determinista.
4. Se validó el schema, la integridad y los tipos de datos.
5. Se ejecutó la validación adversarial.
6. Se verificó que no se introdujeron valores inventados o no respaldados.
7. Se probaron los flujos principales afectados.
8. Se registraron pendientes con etiqueta de riesgo si aplica.
9. Se dejó evidencia física de la ejecución o del cambio.
10. Se documentó un cierre técnico claro y auditable.

---

## 14. Aplicación concreta en PoultryIA

### 14.1. Reglas operativas del proyecto que deben respetarse

- La automatización debe operar dentro del marco de [ .github/copilot-instructions.md ](.github/copilot-instructions.md).
- Los servicios y rutas deben respetar la arquitectura monorepo y la política de puertos inmutables.
- Las migraciones y consultas críticas de BD deben ejecutarse con scripts de Python y validación del repositorio, no con SQL directo ad hoc.
- El flujo de datos debe mantener trazabilidad y responder a un modelo productivo, no a un “chat de prueba”.
- Toda actividad que afecte producción debe dejar evidencia y control de cambios.

### 14.2. Uso de agentes en PoultryIA

Los agentes deben usarse como:

- asistentes para estructurar, organizar y analizar,
- herramientas para extraer y validar información,
- componentes que apoyen decisiones con datos reales,
- orquestadores de flujos de transformación deterministas,
- recursos de apoyo al diagnóstico técnico, no sustitutos de la validación.

No deben utilizarse para:

- inventar cifras financieras,
- ocultar errores detrás de una respuesta “bonita”,
- omitir validación,
- operar sobre producción sin evidencia,
- decidir reglas de negocio sin control humano y documentación.

---

## 15. Política de cierre de trabajo

Una tarea solo puede considerarse cerrada cuando:

- el objetivo está cumplido,
- la validación fue ejecutada,
- la evidencia quedó guardada,
- la causa raíz fue abordada,
- el riesgo fue evaluado,
- la documentación del cambio refleja el estado real.

Si alguna de estas condiciones no se cumple, la ejecución queda abierta, no cerrada.

---

## 16. Resumen ejecutivo

Este protocolo no busca reemplazar la ingeniería ni la disciplina del desarrollo. Busca reforzarla con una estructura de ejecución clara:

- control del alcance,
- topología deliberada del flujo,
- separación de responsabilidades,
- validaciones técnicas reales,
- evidencia física,
- corrección por causa raíz,
- trazabilidad y cierre responsable.

En PoultryIA, la diferencia entre un proceso improvisado y un proceso robusto está en si el sistema puede demostrar, con evidencia, que cada decisión y cada transformación fue ejecutada de manera verificable.

---

## 17. Anexo: checklist rápido para uso diario

- [ ] ¿Existe un objetivo claro y acotado?
- [ ] ¿Está definido el alcance y el criterio de aceptación?
- [ ] ¿El flujo está estructurado por nodos?
- [ ] ¿Hay validación de entrada y salida?
- [ ] ¿La lógica crítica es determinista?
- [ ] ¿Se respetan políticas del proyecto y del dominio?
- [ ] ¿Hay evidencia física del resultado?
- [ ] ¿Se evitó generar datos inventados?
- [ ] ¿Se documentó la causa raíz del problema si hubo fallo?
- [ ] ¿La tarea queda cerrada solo con validación y trazabilidad?

---

## 18. Estado del documento

Documento maestro de gobernanza y ejecución para agentes, ejecución analítica y flujos automatizados en PoultryIA.

Uso recomendado:

- como protocolo de referencia para tareas complejas,
- como checklist de auditoría para agentes y pipelines,
- como estándar mínimo para liberar cambios con impacto operativo o analítico.
