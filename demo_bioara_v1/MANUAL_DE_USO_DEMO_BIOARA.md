# Manual de uso del Demo BioARA

## 1. Proposito del demo
Este demo es una version de trabajo para mostrar como BioARA puede apoyar la recomendacion tecnica, el calculo economico y la trazabilidad basica de un caso porcicola. Esta pensado como una herramienta ejecutiva y comercial, no como una version clinica definitiva ni como un sistema regulatorio final.

Marco de control tecnico obligatorio:
- Ver el protocolo [../GRAFOS_ARNES_AGENTES.md](../GRAFOS_ARNES_AGENTES.md).
- Cualquier producto con informacion incompleta debe quedar con la etiqueta exacta: "pendiente por confirmar".

## 2. Alcance actual de la version DEMO
El demo permite:
- Registrar el caso con cliente, granja, lote y datos productivos.
- Elegir la linea de servicio de porcicultura.
- Seleccionar el desafio principal del caso.
- Calcular la recomendacion tecnica y el costo estimado.
- Generar un resumen visual, un PDF y un correo de salida.
- Guardar el historico local en el mismo navegador.
- Revisar el catalogo base de precios de forma desplegable.

El demo trabaja con supuestos controlados. No reemplaza el criterio del medico veterinario, ni sustituye fichas tecnicas oficiales cuando estas falten o no tengan una indicacion exacta.

## 3. Como usar la aplicacion, paso a paso

### Paso 1. Abrir la aplicacion
La aplicacion se ejecuta localmente desde un servidor simple. En esta version demo se usa el navegador como interfaz principal.

### Paso 2. Elegir la linea de servicio
Selecciona la linea activa de porcicultura. Las otras lineas aparecen como proximas versiones.

### Paso 3. Diligenciar el caso
Completa los datos del cliente y de la granja:
- Nombre del cliente.
- Nombre de la granja.
- Total de animales del cliente.
- Animales a tratar.
- Genetica.
- Correo del cliente.
- Especialista BioARA asignado.

### Paso 4. Definir la fase y el desafio principal
Selecciona la fase productiva y el desafio principal. Esto controla la logica de recomendacion.

### Paso 5. Ingresar variables tecnicas
Dependiendo del desafio, completa los campos de peso, edad, via preferida y, en Bioseguridad, el area tratada en m2.

### Paso 6. Seleccionar prioridad tecnica manual
En la seccion de seleccion manual, el medico veterinario puede escoger productos del catalogo base. El motor despues agrega reglas automaticas complementarias.

### Paso 7. Calcular el caso
Al guardar el caso, la aplicacion genera:
- Recomendacion prioritaria.
- Matriz tecnica.
- Impacto economico.
- Resumen ejecutivo.
- Registro historico local.

### Paso 8. Revisar el resumen
Verifica el resultado, los soportes adicionales y el catalogo de precios. El bloque de precio base del catalogo esta oculto por defecto y se despliega al hacer clic.

### Paso 9. Aprobar o ajustar
El medico veterinario puede dejar observaciones, aprobar la recomendacion, imprimir PDF o enviar el correo final.

## 4. Funcionamiento de los modulos principales

### Recomendacion tecnica
El motor cruza desafio, fase, parametros del caso y reglas de la base tecnica para entregar una salida priorizada.

### Bioseguridad
La Bioseguridad usa el area tratada para calcular cantidades y costos. En esta version se corrigio la lectura de unidades para evitar resultados irreales.

### Biologicos / Vacunas
Esta rama fue incorporada para que el demo pueda sugerir biologicos segun fase y desafio. Cuando no existe referencia de precio confiable, el sistema muestra Cotizar en lugar de inventar un valor.

### Soporte adicional
Esta seccion funciona como bloque plegable. El usuario solo la abre si necesita revisar indicaciones complementarias.

### Precio base del catalogo
Tambien queda oculto por defecto y se abre por clic, igual que Soporte adicional. Esto deja la pantalla mas limpia para uso ejecutivo y comercial.

## 5. Criterios de uso clinico y comercial
La version demo debe usarse como apoyo a la decision, no como sustituto del juicio tecnico.

Desde lo clinico:
- Sirve para comparar escenarios.
- Ayuda a estandarizar una recomendacion inicial.
- Permite dejar trazabilidad de la aprobacion veterinaria.

Desde lo comercial:
- Facilita explicar al cliente el valor de la recomendacion.
- Permite mostrar una propuesta ordenada y defendible.
- Da una base para cotizacion y seguimiento.

Desde lo gerencial:
- Apoya adopcion interna con un flujo simple.
- Permite revisar volumen de casos y trazabilidad.
- Abre la puerta a medir conversion, uso y rentabilidad.

## 6. Temas pendientes para version 1
Hay dos grupos de temas que deben incorporarse en la version 1:

### a) Productos NANO
Los productos NANO quedan pendientes porque en este demo no se conto con fichas tecnicas completas para su evaluacion final.

### b) Productos con ficha tecnica, pero sin indicacion exacta para el demo
Tambien quedan pendientes los productos que si tienen ficha tecnica, pero cuya indicacion exacta no quedo suficientemente definida para integrarlos con seguridad en esta version.

### Necesidad tecnica para V1
La version 1 deberia incorporar:
- Biblioteca formal de fichas tecnicas.
- Campo de version de ficha y fecha de vigencia.
- Campo de indicacion aprobada por producto.
- Matriz de fase autorizada por producto.
- Control de producto habilitado o pendiente.
- Observaciones tecnicas cuando la fuente no sea concluyente.

## 7. Anotaciones de cierre para la V1
Estas son las anotaciones que conviene dejar desde ya:
- No usar productos sin indicacion exacta.
- No mezclar productos de catalogo comercial con productos clinicos sin validacion tecnica.
- No asumir precios donde no existe fuente real.
- No forzar recomendaciones para cubrir huecos de informacion.
- Todo producto nuevo debe entrar por ficha tecnica antes de pasar a recomendacion automatica.

## 8. Ventajas y desventajas de llevarlo a web, App Store y Google Play

### Aplicacion web
Ventajas:
- Despliegue rapido.
- Facil de actualizar sin pedir instalacion nueva.
- Menor costo inicial.
- Ideal para pilotos y equipos comerciales.

Desventajas:
- Depende del navegador y de la conectividad si no se usa cache local.
- Menor presencia de marca que una app instalada.
- Menos control sobre experiencia nativa del dispositivo.

### Aplicacion para App Store de Apple
Ventajas:
- Mejor percepcion de producto serio y consolidado.
- Mayor confianza en ambientes corporativos.
- Mejor integracion con el ecosistema Apple.

Desventajas:
- Mayor exigencia de publicacion y mantenimiento.
- Costos de compilacion, certificados y aprobacion.
- Menor flexibilidad para cambios rapidos.

### Aplicacion para Google Play
Ventajas:
- Alcance amplio en equipos Android.
- Mejor adopcion en campo por disponibilidad de dispositivos.
- Facilita trabajo comercial y tecnico en movilidad.

Desventajas:
- Requiere disciplina de versionado y soporte.
- Control de calidad mas estricto que la web.
- Mantenimiento doble si tambien se publica para Apple.

## 9. Alternativas practicas desde lo tecnologico
Para BioARA, la ruta mas practica es una estrategia por etapas:

1. Primero, mantener una web app/PWA como base operativa.
2. Luego, convertirla en app instalable para equipos de campo.
3. Despues, publicar una version movil solo si la adopcion lo justifica.
4. Integrar sincronizacion con backend cuando el flujo ya este validado.

Otra opcion practica es usar una arquitectura mixta:
- Web para gerencia y ventas.
- PWA para tecnicos.
- App movil nativa solo cuando haya analitica de uso suficiente.

## 10. Lectura ejecutiva, comercial y gerencial

### Para direccion ejecutiva
La propuesta demuestra capacidad de innovacion, orden tecnico y trazabilidad. Es util para mostrar diferenciacion y construir una narrativa de valor.

### Para el equipo comercial
La herramienta ayuda a convertir una conversacion tecnica en una propuesta clara, con soporte, costo y seguimiento.

### Para gerencia
Permite estandarizar criterios, dejar evidencia de uso y preparar el salto a una version administrable con datos y reportes.

## 11. Recomendacion final
La mejor ruta para BioARA en esta etapa es consolidar la web app como version base, cerrar la biblioteca de fichas tecnicas, completar la version 1 con control de vigencia y luego decidir si el producto evoluciona a PWA, app Android o app iOS segun adopcion real.

La prioridad inmediata debe ser completar la validacion tecnica de productos pendientes, especialmente NANO y los productos con indicacion no cerrada, antes de ampliar la automatizacion.

## 12. Como se maneja la informacion capturada

### Donde se guarda hoy en la DEMO
En esta version demo, la informacion se guarda localmente en el navegador del equipo que esta usando la aplicacion. Tecnologicamente se usa IndexedDB para los casos y un exportador CSV para sacar copias de trabajo.

Esto significa:
- La data queda en el dispositivo, no en un servidor central.
- Si otro equipo abre la app, no ve automaticamente esos casos.
- El historico local es util para piloto, entrenamiento y validacion de flujo.

### Excel o Google Sheets
En la DEMO no hay integracion automatica directa a Excel o Google Sheets en tiempo real. El mecanismo operativo es:
1. Capturar y guardar caso en la app.
2. Exportar casos a CSV.
3. Abrir CSV en Excel o importarlo en Google Sheets.

Para V1 se recomienda integrar Google Sheets o una base central para evitar manejo manual de archivos y consolidar datos de todos los tecnicos.

## 13. Como se alimenta la informacion y cual es el flujo

### Flujo actual (demo)
1. Usuario diligencia datos del caso en el formulario.
2. Motor calcula recomendacion tecnica y economica.
3. Caso se guarda en historico local.
4. Se puede aprobar, generar PDF y enviar correo.
5. Se exporta a CSV para consolidacion externa.

### Flujo recomendado para V1 operativa
1. Captura en campo desde web/PWA.
2. Validacion de campos obligatorios y consistencia.
3. Sincronizacion a repositorio central de datos.
4. Capa ETL para limpieza, homologacion y versionado.
5. Capa analitica para KPIs, dashboards y modelos.
6. Capa ejecutiva para decisiones comerciales y tecnicas.

## 14. Importancia de acumular datos
Acumular datos no es solo guardar historicos; es construir inteligencia del negocio.

Beneficios directos:
- Mejorar precision de recomendaciones por fase, desafio y region.
- Cuantificar impacto real de productos en mortalidad, FCA, conversion y rentabilidad.
- Identificar que combinaciones funcionan mejor por tipo de granja.
- Soportar decisiones comerciales con evidencia, no solo percepcion.
- Disenar portafolio tecnico con mayor probabilidad de exito en campo.

Sin acumulacion de datos, no se puede escalar una estrategia de analitica robusta ni un sistema de recomendacion confiable.

## 15. Niveles de analisis propuestos

### Nivel 1: Reporteria descriptiva (operativa)
Responde que paso.
- Casos por veterinario, granja, fase y desafio.
- Productos mas recomendados.
- Tasa de aprobacion veterinaria.
- Casos con cotizacion pendiente.

### Nivel 2: Diagnostico (EDA)
Responde por que paso.
- Patrones por zona, genetica, edad y peso.
- Relacion entre desafio y combinacion de productos.
- Deteccion de outliers en costos, dosis y ROI.
- Calidad de datos por usuario o canal.

### Nivel 3: Predictivo
Responde que puede pasar.
- Probabilidad de mejora de ROI por tipo de protocolo.
- Probabilidad de desvio tecnico segun perfil de granja.
- Prediccion de demanda de productos por temporada y region.

### Nivel 4: Prescriptivo
Responde que deberiamos hacer.
- Sugerencia de protocolo optimo por perfil de caso.
- Priorizacion comercial de cuentas con mayor potencial.
- Plan de accion tecnico con mayor retorno esperado.

## 16. ETL propuesto (Extract, Transform, Load)

### Extract
Fuentes iniciales:
- Casos de la app (captura primaria).
- Catalogo de productos y precios.
- Fichas tecnicas y matriz de indicaciones.
- Resultados reales de seguimiento en campo.

### Transform
Procesos clave:
- Estandarizar nombres de producto y categorias.
- Homologar unidades (ml, kg, L, und, m2).
- Limpiar valores faltantes o invalidos.
- Versionar cambios de precio y de ficha tecnica.
- Enriquecer con metadatos: zona, asesor, segmento.

### Load
Destino recomendado:
- Data mart operativo para reporteria diaria.
- Data warehouse analitico para historico y modelado.

Frecuencia sugerida:
- Operativo: diario.
- Ejecutivo: semanal/mensual.

## 17. EDA propuesto (Exploratory Data Analysis)
Antes de modelar, se debe ejecutar EDA formal para verificar:
- Distribucion de casos por fase y desafio.
- Densidad de uso por producto y combinaciones.
- Correlaciones entre dosis, costo, resultado y ROI.
- Sesgos de captura por asesor o region.
- Cobertura de datos y porcentaje de campos incompletos.

Resultado esperado de EDA:
- Diccionario de datos validado.
- Reglas de calidad de datos.
- Hipotesis para modelos predictivos.

## 18. KPIs, metricas y dashboard de productos y uso

### KPIs tecnicos
- Tasa de adopcion de recomendacion aprobada.
- Variacion de mortalidad antes y despues.
- Variacion de FCA antes y despues.
- Cumplimiento de fase e indicacion tecnica.

### KPIs comerciales
- Ticket promedio por caso.
- Margen estimado por recomendacion.
- Conversion de cotizacion a venta.
- Frecuencia de recompra por cliente.

### KPIs gerenciales
- Crecimiento de casos por mes.
- Productividad por asesor.
- Mix de productos por zona.
- ROI agregado del portafolio recomendado.

### Dashboard minimo recomendado
1. Dashboard de adopcion y uso: usuarios, casos, fases, desafios.
2. Dashboard de productos: top productos, rotacion, margen, cotizaciones.
3. Dashboard clinico-economico: mortalidad, FCA, inversion, ROI.
4. Dashboard de calidad de datos: completitud, errores, consistencia.

## 19. Analisis predictivo y prescriptivo para BioARA

### Predictivo (primer ciclo)
Casos de uso de alto valor:
- Prediccion de probabilidad de aceptacion de una recomendacion.
- Prediccion de consumo de productos por region y fase.
- Prediccion de casos con alto riesgo de baja rentabilidad.

Modelos sugeridos para iniciar:
- Regresion y arboles de decision para interpretabilidad.
- Series de tiempo para demanda por producto.
- Scoring simple por perfil de granja.

### Prescriptivo (segundo ciclo)
Una vez haya estabilidad en datos y modelos, incorporar:
- Recomendador de siguiente mejor accion comercial.
- Recomendador de protocolo tecnico por perfil.
- Priorizador de visitas tecnicas segun impacto esperado.

## 20. Gobierno de datos y seguridad minima para V1
Para escalar con control, V1 debe incluir:
- Politica de propiedad del dato (BioARA).
- Control de acceso por rol (tecnico, comercial, gerencia, admin).
- Trazabilidad de cambios de fichas y reglas.
- Respaldo automatico y recuperacion.
- Politica de retencion y depuracion historica.

## 21. Hoja de ruta recomendada de datos
1. Cierre demo: captura local + exportacion CSV controlada.
2. V1.1: consolidacion en Google Sheets o base central ligera.
3. V1.2: ETL formal + data mart + dashboards ejecutivos.
4. V1.3: modelos predictivos iniciales.
5. V2.0: capa prescriptiva y automatizacion comercial-tecnica.

## 22. Necesidad de aprobacion de textos (app, PDF y correos)
Para BioARA es critico formalizar la aprobacion de textos antes de pasar a produccion. La recomendacion tecnica, el PDF y el correo son piezas de comunicacion oficial frente al cliente y deben estar alineadas en criterio clinico, comercial y legal.

### Por que es obligatorio
- Evita contradicciones entre lo que se muestra en pantalla, lo que se imprime y lo que se envia por correo.
- Reduce riesgo reputacional por mensajes ambiguos o no validados.
- Protege a la empresa frente a interpretaciones tecnicas incorrectas.
- Asegura consistencia de marca y lenguaje comercial.

### Alcance de aprobacion
Debe aprobarse todo texto que salga de la aplicacion:
- Textos de interfaz (labels, ayudas, mensajes de estado, alertas).
- Textos del PDF (resumen tecnico, observaciones, notas de soporte).
- Textos de correo (asunto, cuerpo, disclaimers, destinatarios por regla).

## 23. Flujo de aprobacion recomendado

### Etapa 1: Borrador funcional
Responsable: equipo de producto/tecnico.
- Se redactan textos base para app, PDF y correo.
- Se marcan textos sensibles: clinicos, comerciales y regulatorios.

### Etapa 2: Revision tecnica veterinaria
Responsable: direccion tecnica veterinaria.
- Valida exactitud sanitaria y lenguaje de recomendacion.
- Verifica coherencia con fichas tecnicas vigentes.

### Etapa 3: Revision comercial y de marca
Responsable: gerencia comercial/marketing.
- Ajusta tono, claridad y propuesta de valor al cliente.
- Alinea mensajes con estrategia comercial por segmento.

### Etapa 4: Revision legal y de riesgo
Responsable: legal/compliance (si aplica).
- Define disclaimers requeridos.
- Aprueba textos de responsabilidad y alcance de uso.

### Etapa 5: Aprobacion final y publicacion
Responsable: comite de aprobacion (dueno de producto + tecnico + comercial).
- Se congela una version de textos aprobados.
- Se registra fecha de vigencia, responsable y numero de version.

## 24. Control de versiones de textos
Se recomienda manejar una matriz de contenidos aprobados con estos campos:
- Canal: App, PDF o Correo.
- Modulo: seccion exacta donde aparece el texto.
- Texto actual aprobado.
- Version del texto.
- Fecha de aprobacion.
- Responsable que aprueba.
- Estado: vigente, en revision, retirado.

Regla operativa:
- Ningun cambio de texto pasa a produccion sin ticket de aprobacion y version nueva.

## 25. Reglas minimas por canal

### Aplicacion
- Mensajes claros, breves y no ambiguos.
- Evitar afirmaciones absolutas cuando la salida depende de validacion veterinaria.
- Incluir notas de apoyo cuando hay datos incompletos o Cotizar.

### PDF
- Debe reflejar exactamente la salida aprobada del caso.
- Incluir fecha/hora de emision y responsable.
- Mantener disclaimer tecnico de uso profesional.

### Correo
- Destinatarios controlados segun politica vigente.
- Asunto estandarizado para trazabilidad.
- Cuerpo con resumen ejecutivo + llamado a accion comercial.
- Firma y aviso de confidencialidad cuando aplique.

## 26. KPI de calidad de comunicacion
Para gestionar este frente en V1, medir:
- Porcentaje de textos versionados y aprobados.
- Tiempo promedio de aprobacion por cambio de texto.
- Numero de incidencias por mensaje ambiguo o inconsistente.
- Tasa de correcciones post-envio de PDF/correo.

## 27. Recomendacion de implementacion inmediata
Antes del cierre formal de V1, ejecutar un sprint corto de gobierno de contenidos:
1. Inventariar todos los textos visibles en app, PDF y correo.
2. Clasificarlos por criticidad (alta, media, baja).
3. Aprobar y congelar la version 1.0 de mensajes.
4. Publicar matriz de textos aprobados como anexo operativo.

Con esto, BioARA asegura que la capa tecnica y la capa de comunicacion salgan alineadas, trazables y defendibles frente al cliente.

## 28. Anexo: plantilla de matriz de textos aprobados
Esta plantilla se usa para controlar todos los textos de salida en App, PDF y Correo. Esta lista para llenar y versionar en cada liberacion.

### 28.1 Instrucciones de diligenciamiento
1. Crear un registro por cada texto visible o enviado al cliente.
2. No agrupar textos distintos en una sola fila.
3. Mantener un identificador unico por texto.
4. Actualizar la version cada vez que cambie el contenido.
5. No publicar cambios con estado diferente de Aprobado.

### 28.2 Matriz maestra (formato base)
| ID texto | Canal | Modulo/Pantalla | Ubicacion exacta | Tipo de texto | Criticidad | Texto vigente aprobado | Version | Estado | Fecha solicitud | Fecha aprobacion | Solicitante | Revisor tecnico | Revisor comercial | Revisor legal | Aprobador final | Ticket/Acta | Vigencia desde | Vigencia hasta | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TXT-APP-001 | App | Formulario caso | Mensaje validacion Bioseguridad | Validacion | Alta | Para Bioseguridad debes indicar el area tratada en m2 antes de calcular. | 1.0 | Aprobado | 2026-08-13 | 2026-08-14 | Producto | Dir. Tecnica | Gerencia Comercial | Legal | Comite V1 | TCK-1024 | 2026-08-15 | 2026-12-31 | Texto inicial V1 |
| TXT-PDF-001 | PDF | Resumen tecnico | Disclaimer pie de pagina | Disclaimer | Alta | Documento de apoyo tecnico. Requiere validacion del medico veterinario responsable. | 1.0 | En revision | 2026-08-13 |  | Producto | Dir. Tecnica | Gerencia Comercial | Legal |  | TCK-1025 |  |  | Pendiente concepto legal |
| TXT-MAIL-001 | Correo | Envio de caso | Asunto | Asunto | Media | BioARA - Caso tecnico {{caso_id}} - {{cliente}} | 1.0 | Aprobado | 2026-08-13 | 2026-08-14 | Producto | Dir. Tecnica | Gerencia Comercial | N/A | Comite V1 | TCK-1026 | 2026-08-15 | 2026-12-31 | Mantener formato para trazabilidad |
| TXT-MAIL-002 | Correo | Envio de caso | Cuerpo principal | Resumen comercial | Alta | Adjuntamos el resumen tecnico y economico del caso para su revision y plan de accion. | 1.0 | Borrador | 2026-08-13 |  | Producto |  |  |  |  | TCK-1027 |  |  | Falta revision cruzada tecnico-comercial |

### 28.3 Catalogo de valores sugeridos
Campos recomendados para estandarizar el llenado:

- Canal: App, PDF, Correo.
- Tipo de texto: Label, Ayuda, Validacion, Alerta, Disclaimer, Asunto, Cuerpo, CTA, Firma.
- Criticidad: Alta, Media, Baja.
- Estado: Borrador, En revision, Aprobado, Rechazado, Retirado.

### 28.4 Reglas de control de cambios
- Si cambia una sola palabra, se crea nueva version.
- Todo texto aprobado debe quedar trazado con ticket o acta.
- El estado Aprobado exige fecha de aprobacion y aprobador final.
- Ningun texto con estado Borrador o En revision puede salir a produccion.

### 28.5 Checklist de salida a produccion (textos)
Antes de publicar una version:
1. 100% de textos criticos en estado Aprobado.
2. Asuntos y cuerpo de correo revisados por comercial y tecnico.
3. Disclaimers PDF validados por legal/compliance (si aplica).
4. Mensajes de validacion en App probados en escenarios reales.
5. Matriz firmada y archivada como evidencia de liberacion.

## 29. Sistema de captura de precios economicos (cerdo y alimento)
Para que el resultado economico sea defendible, el demo requiere capturar dos variables base en cada caso:
- Precio del kilo de cerdo (COP/kg).
- Precio del kilo de alimento (COP/kg).

Estas dos variables impactan directamente el calculo de costo, beneficio y ROI. Si se capturan mal, el resultado financiero pierde validez.

### 29.1 Como se capturan hoy en la DEMO
En el formulario del caso, el usuario ingresa manualmente:
- costoAlimento (COP por kg).
- precioCerdo (COP por kg).

La aplicacion permite actualizar estos valores con benchmark y luego los guarda dentro de cada registro de caso. Esto es clave porque conserva el contexto de mercado con el que se calculo cada recomendacion.

### 29.2 Regla operativa recomendada para V1
Para evitar sesgos:
1. Definir fuente oficial de precios por periodo (semanal o quincenal).
2. Registrar fecha de vigencia del precio aplicado.
3. No sobrescribir historicos: cada caso debe conservar su precio de origen.
4. Versionar cambio de fuente o metodologia de captura.

### 29.3 Fuentes sugeridas de precio
- Precio de alimento: lista interna de compras o promedio ponderado por proveedor.
- Precio de cerdo: referencia comercial vigente por plaza o zona.

Si hay mas de una referencia, usar una regla unica:
- Precio oficial = promedio ponderado documentado.
- Registrar en observaciones la fuente exacta usada.

## 30. Necesidad de medir antes y despues para justificar ROI
El ROI no debe interpretarse solo con un dato puntual. Debe soportarse con comparacion antes/despues bajo criterios consistentes.

### 30.1 Por que es indispensable
- Evita atribuir mejoras al protocolo cuando pueden venir de factores externos.
- Permite demostrar impacto tecnico y economico real frente al cliente.
- Fortalece la defensa comercial de la recomendacion.
- Mejora la calidad del aprendizaje para modelos futuros.

### 30.2 Ventana de comparacion recomendada
- Antes: linea base historica reciente del lote o granja (por ejemplo 2 a 4 semanas previas o ciclo equivalente).
- Despues: ventana comparable posterior a la implementacion.

Regla: usar periodos equivalentes en duracion, fase y condiciones operativas para no distorsionar resultados.

### 30.3 Variables economicas minimas a medir
Variables de entrada:
- Precio kg cerdo.
- Precio kg alimento.
- Numero de animales tratados.
- Costo total del protocolo.

Variables de desempeño tecnico-productivo:
- Mortalidad antes y despues.
- FCA antes y despues.
- Ganancia de peso o salida comercial (si aplica).

Variables de salida economica:
- Inversion total.
- Beneficio estimado o recuperado.
- Beneficio neto.
- ROI porcentual.

### 30.4 Formula de interpretacion de ROI
Se recomienda estandarizar el criterio:
- ROI > 0: la intervencion agrega valor economico.
- ROI = 0: punto de equilibrio.
- ROI < 0: revisar protocolo, ejecucion o supuestos de precio.

En presentacion ejecutiva, siempre acompañar el ROI con:
- Supuestos de precio usados.
- Ventana antes/despues aplicada.
- Nivel de confianza del dato (alto, medio, bajo).

### 30.5 Control de sesgos y trazabilidad
Para que el analisis sea audit-able:
- Registrar fecha de captura de cada variable economica.
- Registrar responsable de la captura.
- Registrar fuente de precio.
- Congelar la version del caso al momento de aprobacion.
- No recalcular historicos sin dejar traza del cambio.

## 31. Recomendacion gerencial para cierre V1
Antes de declarar ROI como argumento comercial estandar, BioARA debe aprobar un protocolo interno de medicion economica con:
1. Definicion oficial de fuentes de precio (cerdo y alimento).
2. Periodicidad de actualizacion.
3. Metodo antes/despues por fase productiva.
4. Criterios de calidad minima del dato.
5. Formato unico de reporte de ROI para app, PDF y correo.

Con esto, el ROI pasa de ser una estimacion aislada a convertirse en un indicador gerencial confiable y comercialmente defendible.