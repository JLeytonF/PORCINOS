# Plan de inclusion de productos faltantes en la aplicacion BioARA

## 1) Contrato de tarea (HARNESS - Task Contract)

Objetivo:
Incorporar productos faltantes al catalogo y a la logica de recomendacion sin inventar dosis, indicaciones ni precios.

Alcance:
- Catalogo de productos y precios del demo.
- Reglas de recomendacion automatizada solo para productos validados.
- Etiquetado estricto de datos incompletos.

Restricciones:
- La ficha tecnica es la fuente primaria de evidencia del producto y NO debe ser ignorada.
- Si falta la ficha tecnica o la evidencia comercial: usar exactamente "pendiente por confirmar".
- Si existe ficha tecnica pero aun no hay precio comercial validado: mantener el producto visible como activo con precio "Cotizar" y excluirlo del motor automatico.
- No habilitar recomendacion automatica para productos sin evidencia de uso o precio validado.
- La categoría base "Biológico" es suficiente; no hace falta reforzarla con "con ficha técnica" en cada etiqueta.

Criterio de aceptacion:
- Matriz de inclusion actualizada.
- Catalogo actualizado sin romper flujos actuales.
- Validacion funcional de UI, busqueda, calculo y exportacion.

---

## 2) Inventario inicial de productos faltantes

- EUBIOL
- BACTERINA HS F
- BACTERINA PLEUROSUIS
- BACTERINA MYCOSUIS HP
- BACTERINA TOXOIDE E. COLI
- E. COLI ORAL
- CEPA F
- ADITIVO PRRSv
- Variantes y nombres no homologos (pendiente por confirmar)

---

## 3) Reglas congeladas (HARNESS - Frozen Rules)

1. No se incluye un producto como activo sin:
   nombre comercial exacto, presentacion, indicacion de uso y nivel de precio (confirmado o Cotizar).
2. La etiqueta operativa oficial para incertidumbre es:
   "pendiente por confirmar".
3. Ningun valor tecnico se infiere por similitud de nombre.
4. Ningun producto pendiente puede entrar al motor automatico.

---

## 4) Topologia de ejecucion (HARNESS - Graph Engineering)

### Nodo N1: Extraccion de evidencia
Entrada:
- Fichas tecnicas en Fichas tecnicas.
- Lista de precios en LISTA DE PRECIOS.

Salida:
- Matriz base con nombre detectado, presentacion y fuente.

### Nodo N2: Homologacion de nombres
Entrada:
- Matriz base de N1.

Salida:
- Nombre canonico por producto.
- Mapeo de sinonimos o variantes.

### Nodo N3: Clasificacion tecnico-comercial
Entrada:
- Matriz homologada.

Salida:
- Estado por producto: activo, pendiente por confirmar, no aplicable.
- Motivo del estado.

### Nodo N4: Actualizacion de catalogo (datos)
Entrada:
- Productos activos y pendientes.

Salida:
- Actualizacion de [V1_app_data/01_precios_supuestos_bioara.csv](V1_app_data/01_precios_supuestos_bioara.csv).
- Para pendientes: observacion "pendiente por confirmar" y precio "Cotizar" cuando aplique.

### Nodo N5: Integracion de logica (motor)
Entrada:
- Productos activos con uso validado.

Salida:
- Ajustes en [demo_bioara_v1/app/config.js](demo_bioara_v1/app/config.js) y, si aplica, [demo_bioara_v1/app/calc.js](demo_bioara_v1/app/calc.js).
- Pendientes excluidos de recomendacion automatica.

### Nodo N6: Verificacion adversarial (Red Team)
Entrada:
- Cambios de N4 y N5.

Salida:
- Pruebas negativas: confirmar que pendientes no aparecen como recomendacion automatica.
- Pruebas positivas: confirmar que activos si aparecen en catalogo y busqueda.

### Nodo N7: Validacion funcional
Entrada:
- Demo corriendo local.

Salida:
- Evidencia de funcionamiento en UI, busqueda, cotizacion y exportacion/PDF.

### Nodo N8: Cierre y evidencia fisica
Salida:
- Matriz final guardada.
- Resumen de cambios y pendientes.
- Checklist HARNESS marcado.

---

## 5) Estado objetivo por producto

> Correccion: los productos que tienen ficha tecnica en la carpeta de Fichas tecnicas cuentan con evidencia tecnica valida. Su estado operativo no debe ser "pendiente por confirmar" por el solo hecho de no tener precio comercial cerrado; deben aparecer como activos con precio "Cotizar" y permanecer fuera del motor automatico hasta validarse uso o precio.

| Producto | Estado correcto | Regla de negocio |
|---|---|---|
| EUBIOL | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| BACTERINA HS F | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| BACTERINA PLEUROSUIS | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| BACTERINA MYCOSUIS HP | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| BACTERINA TOXOIDE E. COLI | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| E. COLI ORAL | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| CEPA F | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |
| ADITIVO PRRSv | activo (precio Cotizar) | Biológico; visible en catalogo, no auto-recomendado |

---

## 6) Gates de aprobacion por fase

### Gate G1 (fin N1-N2)
Pasa si:
- existe matriz de trabajo con fuentes trazables,
- nombres homologados sin duplicidad obvia.

### Gate G2 (fin N3)
Pasa si:
- cada producto tiene estado definido,
- pendientes tienen motivo escrito.

### Gate G3 (fin N4-N5)
Pasa si:
- activos cargados en catalogo,
- pendientes no entran a recomendacion automatica,
- no hay ruptura de productos existentes.

### Gate G4 (fin N6-N8)
Pasa si:
- verificacion funcional completa,
- evidencia de cambios en archivos,
- lista final de pendientes publicada.

---

## 7) Secuencia de ejecucion propuesta (iteracion 1)

1. Construir matriz canonica de faltantes y variantes.
2. Marcar todos los ambiguos como "pendiente por confirmar".
3. Subir solo los productos con evidencia completa a catalogo activo.
4. Mantener pendientes visibles para control interno, pero fuera del motor automatico.
5. Ejecutar validacion funcional y cerrar con evidencia.

---

## 8) Evidencia obligatoria de cierre

- Archivo de matriz de inclusion actualizado (fuente unica de verdad).
- Registro de cambios en catalogo y reglas del motor.
- Validacion funcional documentada.
- Listado final de productos en "pendiente por confirmar".

---

## 9) Resultado esperado

- Catalogo activo mas completo y controlado.
- Cero recomendacion automatica de productos ambiguos.
- Trazabilidad tecnico-comercial por producto.
- Riesgo reducido de recomendar productos sin sustento.
