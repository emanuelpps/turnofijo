# Turno Fijo — Diseño v1

**Fecha:** 2026-08-19
**Estado:** diseño aprobado, pendiente de plan de implementación
**Mercado inicial:** General Roca, Río Negro

---

## 1. Qué es

SaaS de gestión de turnos para profesionales de salud que trabajan con **sesiones recurrentes y cobran particular**: psicólogos y nutricionistas. El usuario es un profesional que atiende solo, sin secretaria, y que entre paciente y paciente tiene dos minutos.

**Por qué "particular" está en la definición del nicho.** La investigación de competencia (`docs/research/2026-08-19-competencia-y-dolores.md`) mostró que al profesional que factura a obra social el ausentismo no le duele tanto como el cobro: IPROSS acumula deudas de hasta cuatro meses contra un convenio de 45 días, y solo el 15% de los prestadores sigue atendiendo con la obra social provincial. A ese profesional una app de turnos no le toca el problema. Kinesiología y fonoaudiología quedan fuera de foco por eso — no porque no tengan sesiones recurrentes, sino porque su dolor principal es otro.

## 2. Diferencial

**Corregido tras la investigación de competencia.** "La serie como unidad de trabajo" era el diferencial original y resultó ser **paridad, no ventaja**: Turnera arma la serie completa en un click y Turnito ofrece reservas recurrentes ilimitadas. Hay que construirlo igual — sin eso no se compite — pero no vende solo.

Lo que sí diferencia, en orden de peso:

1. **Precio plano en pesos con recordatorios incluidos.** Todo el mercado vende el recordatorio como extra medido: Turnera en packs de $135–150 por mensaje, Turnito sin ninguno incluido en el plan gratis y 100 recién a $24.500/mes. Le cobran al profesional por lo único que le importa. Sujeto a que el costo por mensaje de la API cierre (§11).
2. **Presencia local.** El soporte lento o inexistente es queja constante de AgendaPro, Booksy y Doctoralia. Ninguno puede ir a un consultorio de General Roca. Es el foso más real que hay acá, y no es de software.
3. **Reserva por disponibilidad, no por hueco.** El paciente manda los días y la franja horaria en que puede; el sistema busca la serie que mejor calza y se la propone al profesional. Ningún competidor relevado lo hace — todos son selección de casillero. Es el único diferencial de producto que sobrevivió, y falta confirmarlo usando los productos y no leyendo sus páginas.

## 3. Alcance de v1

**Entra:**

- Agenda propia — reemplaza la agenda actual del profesional
- Series recurrentes materializadas con horizonte rodante
- Recordatorios por WhatsApp con botones Confirmar / Cancelar
- Bandeja mínima de mensajes entrantes
- Link público de disponibilidad + matcher + aprobación del profesional
- Pacientes: contacto e historial de asistencia
- Configuración: horarios de atención, bloqueos, textos de recordatorio, conexión de WhatsApp

**No entra (decidido explícitamente, no olvidado):**

- Cobros de cualquier tipo: señas, pagos, facturación
- Notas clínicas o historia clínica
- Multi-profesional / policonsultorios
- Obras sociales
- Lista de espera activa — el dato se captura en v1, la función se activa en v2
- App móvil nativa: es web responsive

## 4. Stack

Next.js + Supabase (Auth, Postgres con RLS, Edge Functions, `pg_cron`) + Vercel.
WhatsApp Business Platform (Cloud API) mediante **Embedded Signup**: cada profesional conecta su propio número.

Se reusa el stack de ImportFlow. No hay nada en este producto que justifique aprender algo nuevo.

## 5. Modelo de datos

**Decisión central: los turnos de una serie se materializan.** Al crear "María, martes 15:00, 10 sesiones" se insertan diez filas reales en `appointments`, no una regla de recurrencia interpretada al vuelo. Es lo que hace que mover el turno 4 al jueves sea un `UPDATE` en vez de la parte más difícil del sistema.

Para el paciente indefinido (psicólogo con alguien hace tres años) se usa **horizonte rodante**: la serie queda abierta y un job extiende los turnos hasta 8 semanas adelante.

**Multi-tenant:** un profesional = un tenant = un usuario. `professional_id` en todas las tablas y RLS con `professional_id = auth.uid()`. Simple justo porque se descartaron los policonsultorios. Si más adelante se quieren centros, se inserta una tabla `organizations` en el medio.

### Tablas

```
professionals          id = auth.uid(), nombre, especialidad, email, telefono_contacto,
                       duracion_default_min, timezone (default America/Argentina/Buenos_Aires)

waba_connections       professional_id, waba_id, phone_number_id, display_phone_number,
                       access_token (cifrado), estado, ultimo_chequeo_en
                       estado: conectada | token_vencido | suspendida | desconectada

working_hours          professional_id, dia_semana (0-6), desde (time), hasta (time)

blocks                 professional_id, periodo (tstzrange), motivo
                       vacaciones, feriados, ausencias puntuales

patients               professional_id, nombre, telefono_e164, email,
                       notas_administrativas, contactable (bool),
                       consentimiento_wa_en
                       SIN campos clínicos — restricción explícita del diseño

series                 professional_id, patient_id, dia_semana, hora_local, duracion_min,
                       frecuencia (semanal | quincenal | mensual),
                       sesiones_totales (NULL = indefinida),
                       desde (date), horizonte_hasta (date), estado
                       mensual entra por nutrición, donde el control cada 30 días es lo normal

appointments           professional_id, patient_id, series_id (NULL si es suelto),
                       periodo (tstzrange), estado, cancelado_por
                       estado: programado | confirmado | cancelado | asistio | ausente

message_outbox         professional_id, appointment_id, tipo, send_at, estado,
                       intentos, ultimo_error, wa_message_id
                       tipo: recordatorio_24h | recordatorio_2h | confirmacion_serie
                       estado: pending | sending | sent | failed | expired | cancelled

conversations          professional_id, patient_id, ventana_abierta_hasta, ultimo_mensaje_en
                       la ventana de 24hs es por conversación, no por mensaje

inbox_messages         conversation_id, direccion, texto, wa_message_id,
                       recibido_en, leido

availability_requests  professional_id, patient_id (NULL hasta que se acepta),
                       nombre, telefono_e164, dias_posibles (int[]),
                       franja_desde, franja_hasta, frecuencia, sesiones_deseadas, estado
                       estado: pendiente | propuesta | aceptada | rechazada | sin_calce
                       Al aceptar se crea el paciente y se enlaza acá.
                       La duración sale de professionals.duracion_default_min.
                       ESTA TABLA ES TAMBIÉN LA LISTA DE ESPERA DE V2
```

### Dos garantías que viven en el esquema, no en el código

Ambas protegen contra errores que costarían clientes, así que no dependen de que la lógica esté bien:

```sql
-- Nunca dos recordatorios del mismo tipo para el mismo turno
UNIQUE (appointment_id, tipo) ON message_outbox

-- Nunca dos turnos superpuestos del mismo profesional
EXCLUDE USING gist (professional_id WITH =, periodo WITH &&)
  WHERE (estado <> 'cancelado') ON appointments
```

**Todo se guarda en UTC** y se muestra en −3. Argentina no tiene horario de verano, así que no hay ambigüedad que resolver.

## 6. El matcher de disponibilidad

**Entrada:** un `availability_request` + `working_hours` + `blocks` + turnos existentes.
**Horizonte:** 8 semanas. **Grilla:** slots de 15 minutos.

1. Generar slots candidatos: para cada día en `dias_posibles`, cada hora de inicio alineada a la grilla dentro de `[franja_desde, franja_hasta]`, tal que inicio + duración entre en la franja y caiga dentro de los horarios de atención.
2. Para cada slot candidato, proyectar las próximas 8 semanas según la frecuencia y contar cuántas ocurrencias están libres — sin choque con turnos no cancelados ni con bloqueos.
3. Descartar los que cubran menos de 4 semanas seguidas.
4. Puntuar:
   - **semanas consecutivas libres desde la primera** — peso principal
   - **compactación**: cuántos turnos ya existentes son adyacentes a ese slot ese día — peso secundario. Al profesional le sirve tener el martes lleno de corrido, no cuatro turnos desperdigados con huecos muertos.
   - desempate: más temprano dentro de la franja
5. Devolver las 3 mejores.

**Si no hay ninguna que llegue al mínimo**, el request queda en `sin_calce` y **igual se le muestra al profesional**. Ese es el insumo de la lista de espera de v2.

**El profesional aprueba, el sistema no reserva solo.** Un psicólogo no deja que un desconocido se meta en su semana sin saber quién es. La aprobación además elimina gratis el spam y las condiciones de carrera. Al aprobar se revalida el calce dentro de la transacción; la restricción de exclusión es la última línea de defensa.

## 7. Motor de recordatorios

**Las filas nacen con el turno.** Al crear un turno se insertan sus filas de `message_outbox` — por defecto una a 24hs; la de 2hs es opcional y viene **desactivada** (mandar de más hace que los pacientes marquen spam y Meta puede pausar la plantilla, que es perder el canal entero). Al reprogramar se anulan las pendientes y se recrean. Al cancelar, se anulan.

**Despachador**, `pg_cron` cada 5 minutos:

1. Toma hasta 50 filas `pending` con `send_at <= now()` usando `FOR UPDATE SKIP LOCKED` y las marca `sending`. Dos ejecuciones simultáneas nunca agarran la misma fila.
2. **Revalida antes de enviar:** el turno sigue vigente y la fecha del mensaje sigue coincidiendo con la del turno. Defensa en profundidad contra el peor error posible — avisar de un turno cancelado.
3. **Descarta lo vencido:** si el cron estuvo caído y el turno ya empezó, marca `expired` y no envía. Un recordatorio tardío es peor que ninguno.
4. Despacha a Meta, guarda el `wa_message_id`, marca `sent`.

La precisión es de ±5 minutos, irrelevante para un aviso de 24hs.

**Webhook** — una Edge Function que valida la firma `X-Hub-Signature-256`. Es un endpoint público: sin esa validación cualquiera cancela turnos ajenos. Recibe tres cosas:

- estados de entrega → actualizan el outbox
- clicks de botón → cambian el turno a confirmado o cancelado, y avisan al profesional si canceló
- texto libre → cae en la bandeja

Meta reintenta webhooks: idempotencia por `wa_message_id`.

**La ventana de 24 horas.** Cuando el paciente escribe se abre una ventana de 24hs en la que el profesional puede responderle texto libre. Cerrada la ventana solo se puede mandar plantilla aprobada. **La bandeja muestra ese estado de forma explícita** — es la fuente número uno de confusión en productos de WhatsApp: el profesional escribe, no sale, y no entiende por qué.

## 8. Interfaz

El usuario trabaja solo y tiene dos minutos entre pacientes. Las pantallas de uso diario van optimizadas para celular; las de armado y configuración, para escritorio.

**Diario (celular):**

- **El día** — la pantalla que abre diez veces por jornada. Turnos de hoy con hora, paciente, estado del aviso (confirmó / enviado / falló) y dos botones grandes: *asistió* / *ausente*.
  **Es prioridad de producto, no un detalle de implementación.** La investigación encontró que la debilidad documentada de los grandes está justo acá: de reviews de AgendaPro, *"la versión que tienen disponibles para los teléfonos celulares no funciona muy bien, se queda cargando"* y *"La aplicación no tiene las mismas funciones que la versión web"*. Si esta pantalla es impecable en un teléfono, ya ganaste la comparación en el lugar donde el usuario vive.
- **Bandeja** — conversaciones sin leer, con el estado de la ventana de 24hs bien visible.

**Armado (escritorio):**

- **Agenda semanal** — crear y mover turnos
- **Alta de serie** — el flujo estrella. Paciente, día, hora, duración, cantidad (o indefinida). Objetivo: menos de 30 segundos, validando choques y horarios.
- **Solicitudes** — los `availability_requests` entrantes con sus series candidatas, para aprobar de un toque
- **Pacientes** — contacto e historial de asistencia
- **Configuración** — horarios, duración por defecto, vacaciones y feriados, textos, conexión de WhatsApp

**Reprogramar.** Al mover un turno de una serie el sistema pregunta siempre: *¿solo este, o de acá en adelante?* Resuelve el 90% de los casos reales — se enfermó una semana vs. cambió el horario para siempre.

**Onboarding.** Es donde se pierden clientes, no en la venta. Tres pasos: conectar WhatsApp por Embedded Signup, cargar horarios, crear las primeras series. **El primero hay que hacerlo sentado al lado del profesional** para ver dónde se traba.

## 9. Manejo de errores

**El fallo más peligroso es el silencioso.** Si la conexión de WhatsApp de un profesional se cae —token vencido, número suspendido, app desconectada— dejan de salir *todos* sus recordatorios y se entera una semana después, cuando ya perdió pacientes.

- **Chequeo diario de salud** de cada conexión. Si falla: aviso por email (otro canal, no el que está roto) + banner rojo en la app. Ninguna falla muere en un log.
- **Mensaje que rebota** (número mal cargado, paciente que bloqueó, sin WhatsApp) → 3 reintentos con backoff exponencial → `failed`, visible en la pantalla del día, y el paciente se marca `contactable = false` para que lo corrija.
- **Plantilla pausada por Meta** → mitigado por diseño: el recordatorio de 2hs viene desactivado.
- **Carrera al aprobar una serie candidata** → revalidación dentro de la transacción + restricción de exclusión en la base.
- **Webhooks repetidos** → idempotencia por `wa_message_id`.

## 10. Testing

Dos piezas justifican TDD y disciplina real, porque son lógica pura y ahí viven los bugs que cuestan clientes:

- **El matcher** — horarios + ocupación + preferencia → series candidatas
- **El ciclo de vida del outbox** — cuándo se crea una fila, cuándo se anula, cuándo expira

Casos de borde obligatorios: turnos cruzando medianoche, serie que atraviesa un feriado, semana con vacaciones en el medio, serie indefinida al extenderse el horizonte.

**En los tests nunca se le pega a la API de Meta**: un doble que registra los envíos. Aparte, un test de humo end-to-end contra el número de prueba de Meta antes de cada release — crear turno, forzar el cron, verificar que salió.

**La UI no lleva testing exhaustivo en v1:** humo sobre alta de serie y aprobación de candidata, nada más. El cuello de botella es llegar al primer cliente, no la cobertura.

## 11. Riesgos y validaciones pendientes

**Competencia — relevada en `docs/research/2026-08-19-competencia-y-dolores.md`.** El mercado está poblado: Turnera, Turnito, Gendu, ReservaSimple, Citalo, Psicobit, Booksolut, Encuadrado, AgendaPro, Doctoralia, más una decena de menores y Calendly/Acuity por arriba. Varios argentinos y con planes gratuitos. Lo que falta y no se resuelve desde el escritorio: **medir cuántos profesionales de General Roca y el Alto Valle realmente usan alguno**. La sospecha de partida —que la penetración real es mucho menor que la presencia en Google— sigue sin confirmar y es la premisa sobre la que se apoya todo el proyecto.

**Falta usar los productos, no leerlos.** El único diferencial de software que sobrevivió (reserva por disponibilidad) se apoya en que Turnera y Turnito no lo tienen, y eso surge de sus páginas de marketing. Hay que crear cuentas y confirmarlo antes de construirlo.

**WhatsApp Business API — sin verificar, y ahora es más crítico.** Faltan las tarifas vigentes de plantillas utility en Argentina, los requisitos de Embedded Signup y el proceso de verificación de Meta. Pasó de ser un dato de costos a ser **la viabilidad del diferencial principal**: si el precio plano con recordatorios incluidos no cierra contra el costo por mensaje, el punto 1 de §2 se cae y hay que replantear el modelo.

**Precio — sin definir, pero con anclas de mercado.** Turnera cobra $135–150 por recordatorio en packs; Turnito pide $24.500/mes por 100 recordatorios y $42.000/mes por 250. Debe ser **en pesos y por MercadoPago**: cobrar en dólares es una queja documentada y específica de este mercado. Sin permanencia ni comisiones, y dicho explícitamente — Doctoralia y Booksy dejaron ese terreno fértil.

**Dominio y marca.** `turnofijo.com.ar` y `turnofijo.app` figuran sin resolución DNS, que no equivale a estar disponibles. Confirmar en NIC.ar (pide CUIT) y buscar la marca en INPI antes de invertir en identidad visual.

**Datos personales.** v1 evita datos clínicos por diseño; los estados `asistio` / `ausente` son operativos. Si alguna vez se agregan notas de sesión, es una decisión aparte que exige cifrado y consentimiento explícito, no un campo más.

## 12. Orden de construcción

El alcance de §3 es demasiado grande para un solo plan de implementación. Se parte en cuatro etapas, cada una con su propio plan. Cada etapa termina en algo usable, no en un pedazo a medio hacer.

**Etapa 1 — La agenda.** Auth, tenancy con RLS, pacientes, horarios de atención, bloqueos, turnos sueltos, series materializadas con horizonte rodante, reprogramación con la pregunta "este o de acá en adelante". Sin WhatsApp. Al final de esta etapa un profesional ya puede usarlo como agenda, y vos podés sentarte con uno a mirarlo.

**Etapa 2 — Los recordatorios.** Embedded Signup, outbox, despachador con `pg_cron`, plantilla con botones, webhook con validación de firma, chequeo de salud de la conexión y avisos de falla. Acá el producto empieza a valer plata.

**Etapa 3 — La bandeja.** Conversaciones, mensajes entrantes, ventana de 24hs visible, respuesta desde la app. Cierra el agujero que abre la etapa 2.

**Etapa 4 — El matcher.** Link público de disponibilidad, algoritmo de series candidatas, pantalla de aprobación. Es lo más caro de construir y va último a propósito.

La investigación de competencia **refuerza** este orden en vez de contradecirlo. Podría parecer que, siendo ahora el único diferencial de software que queda, habría que adelantarlo. Es al revés: los dos diferenciales que más pesan —precio plano con recordatorios incluidos, y estar acá para el soporte— no necesitan una sola línea del matcher. Se pueden ofrecer terminada la etapa 2. Adelantar el matcher sería retrasar el primer cliente por la parte que menos lo define.

## 13. Log de decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Vertical | Psico y nutrición **que cobran particular** | Corregido tras la investigación: al que factura a obra social le duele el cobro, no el ausentismo. IPROSS paga a cuatro meses y solo el 15% de los prestadores sigue atendiendo con ella |
| Diferencial | Precio plano + presencia local + reserva por disponibilidad | "La serie como unidad" resultó ser paridad: Turnera y Turnito ya la tienen |
| Alcance | Sistema completo, no capa | Más pegajoso y defendible, aun sabiendo que la venta cuesta más |
| Cobros | Nada en v1 | Salir a la calle semanas antes; se acepta que el efecto sobre el ausentismo sea más débil |
| Canal WhatsApp | API oficial, número propio por profesional | Sale del número del consultorio y la fricción de onboarding funciona como foso |
| Respuestas | Botones + bandeja mínima | Un número de la API no se puede abrir en la app: sin bandeja, las respuestas de los pacientes se pierden |
| Motor | Outbox en Postgres + pg_cron | Reintentos y auditoría gratis, sin dependencias ni costos nuevos |
| Reserva pública | Sí, por disponibilidad | Encaja con cómo funciona la sesión recurrente y unifica la lista de espera en la misma tabla |
| Aprobación | El profesional aprueba | Control sobre la propia agenda; elimina spam y carreras de arranque |
| Nombre | Turno Fijo | Vernáculo argentino real, nombra el diferencial, y se despega de Turnera / Turnito / Citalo / TurneroMed |
