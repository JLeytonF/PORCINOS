# PROTOCOLO DE VERIFICACION Y SEGUIMIENTO TECNICO (HARNESS - DEMO_BIOARA_V1)

Sistema de auditoria metodologica para pipelines y agentes autonomos zootecnicos
Version 3.0 | Arquitectura de grafos y control de arnes

---

## 1. Proposito

Este documento define los invariantes arquitectonicos y quality gates obligatorios para cualquier ejecucion de agentes, procesos ETL o analitica dentro de DEMO_BIOARA_V1.

Objetivo operativo:

- mantener decisiones trazables,
- ejecutar transformaciones criticas con codigo determinista,
- evitar improvisacion conversacional como sustituto de validacion tecnica.

---

## 2. Matriz de cumplimiento arquitectonico

Antes de cerrar una tarea, el auditor tecnico debe completar esta matriz.

| Capa / Componente | Requisito metodologico indispensable | Estado |
| :--- | :--- | :--- |
| 1. Contrato de tarea (Task Contract) | Existe objetivo acotado, alcance, restricciones y criterio de aceptacion antes de ejecutar. | [ ] Aprobado |
| 2. Topologia de grafo (Graph Engineering) | El flujo se separa en nodos independientes (extractor, reductor, procesador, verificador) con aristas tipadas. | [ ] Aprobado |
| 3. Separacion cerebro/plomeria | Limpieza, deduplicacion y transformaciones mecanicas van por codigo (no por inferencia del LLM). | [ ] Aprobado |
| 4. Estado estructurado | Entre nodos se pasan objetos tipados o tablas estructuradas, no texto libre. | [ ] Aprobado |
| 5. Verificacion adversarial (Red Team) | Existe evaluador independiente con rol explicito de invalidar o romper resultados debiles. | [ ] Aprobado |
| 6. Politicas congeladas (Frozen Rules) | Reglas criticas quedan fuera del alcance de optimizacion del agente. | [ ] Aprobado |
| 7. Bucle de retroalimentacion | En nodos criticos se aplica producir -> probar -> corregir (maximo 3 intentos). | [ ] Aprobado |
| 8. Evidencia fisica de salida | Artefactos requeridos generados en disco y validados con evidencia de cambio. | [ ] Aprobado |

---

## 3. Reglas de oro de ejecucion agentica

1. La ausencia de error no es evidencia de exito.
2. Si falla un bloque, se corrige ese bloque (retorno quirurgico), no todo el lote.
3. El humano interviene en gates de alto impacto: aprobacion final, publicacion o decisiones irreversibles.

---

## 4. Protocolo ante fallos (Harness Flywheel)

Si un pipeline o agente falla, no se corrige con prompts mas largos. Se corrige la infraestructura.

1. Clasificar el fallo:
   timeout, argumento invalido, contexto faltante, prueba rota o ambiguedad del contrato.
2. Traducir el hallazgo a defensa permanente:
   nueva prueba, validador de esquema, restriccion de politica o ajuste del contrato tecnico.
3. Reejecutar y conservar evidencia:
   el sistema solo mejora si cada fallo deja codigo defensivo o control verificable.

---

## 5. Como se aplica en este proyecto

Aplicacion concreta en Demo BioARA V1:

- Catalogo:
  cualquier producto sin claridad tecnica o comercial se marca como "pendiente por confirmar".
- Recomendacion:
  solo productos activos y con uso validado entran a recomendacion automatica.
- Costos:
  si no hay precio verificable, usar "Cotizar" y no inferir valores.
- Cierre de cambios:
  todo cambio debe dejar evidencia en archivos del repositorio (CSV, MD, JS o JSON) y verificacion funcional.

---

## 6. Checklist minimo de liberacion

Usar esta lista antes de cerrar una iteracion:

1. Se documento alcance y criterio de aceptacion.
2. Se actualizaron datos fuente (catalogo, protocolos o reglas).
3. Se verifico que no se introdujeron recomendaciones sin respaldo tecnico.
4. Se probaron los flujos principales de UI afectados.
5. Se registraron pendientes con etiqueta exacta "pendiente por confirmar".
6. Se dejo evidencia de verificacion en documentacion del proyecto.
