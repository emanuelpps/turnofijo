# Etapa 2 — WhatsApp y recordatorios (diseño **incompleto**, en pausa)

> **Estado: a medio brainstormear.** Las decisiones de §1 y la arquitectura de §3 están
> tomadas y aprobadas en conversación. Falta la parte 2 del diseño (§4), la aprobación
> final, el auto-review del spec y el plan de implementación.
> Al retomar, arrancar por §4 — no por el principio.

Continúa `2026-08-19-turnofijo-design.md`, §12 "Orden de construcción", Etapa 2.
La Etapa 1 (1a + 1b) está completa y pusheada.

---

## 1. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance de este ciclo | **Recordatorios** (Etapa 2), no la reserva conversacional | La cañería de WhatsApp es prerrequisito técnico de todo lo demás, y es lo que hace que el producto valga plata |
| Conexión del número | **Asistida**: campos `phone_number_id` + token en Configuración, el alta en Meta se hace sentado al lado del profesional | Embedded Signup necesita verificación de negocio de Meta y App Review — semanas de espera fuera de nuestro control, antes de mandar un solo mensaje. Lo que la app guarda es idéntico en los dos casos, así que Embedded Signup entra después sin tirar código |
| Texto libre del paciente | **Guardar y avisar**, sin poder responder desde la app | El número vive en la API y ya no se abre en el celular. Si no se guarda, el "no puedo el martes" cae en un pozo. La bandeja completa sigue siendo la Etapa 3 |
| Avisos al profesional (cancelación, conexión caída) | **Dentro de la app + email** | Un número de la API no se manda mensajes a sí mismo: avisarle por WhatsApp exigiría un segundo número de sistema, con su alta y su costo. El email cubre el caso peligroso, que es el silencioso |

## 2. El número de WhatsApp para probar

**No se usa el número personal del usuario.** Un número registrado en la Cloud API no puede
estar activo en la app de WhatsApp ni en WhatsApp Business: migrarlo exige borrar antes la
cuenta de WhatsApp de ese número. No es un riesgo, es un requisito.

**Se prueba con el número de prueba gratuito de Meta**, que cada app trae. Manda a hasta 5
destinatarios verificados; el celular del usuario es uno de esos 5. Recibe todo en su WhatsApp
normal, sin tocar nada y sin costo.

**Descartado:** librerías no oficiales tipo Baileys / whatsapp-web.js. Funcionan con un número
común, pero violan los términos de WhatsApp y el riesgo de baneo del número es real. Para un
producto que se vende, no.

**Fricción de negocio a resolver antes del primer cliente:** el profesional va a tener que ceder
un número a la API, y muchos usan el personal para el consultorio. O consigue una línea nueva
(un chip prepago alcanza) o pierde WhatsApp en la suya. El diseño v1 daba esto por resuelto
("la fricción de onboarding funciona como foso"); es la primera pregunta que va a hacer el
profesional real.

## 3. Arquitectura y modelo de datos (aprobado en conversación)

Seis piezas nuevas, cada una con un solo trabajo.

**1. La conexión — `wa_connections`.** Una fila por profesional: `phone_number_id`, `waba_id`,
token, `estado` (`activa` | `caida`), `ultimo_chequeo`. El token es lo único verdaderamente
secreto del sistema: **RLS le niega la lectura a todo el mundo, incluido el dueño de la fila**;
solo lo lee el service role desde las Edge Functions. El formulario de Configuración lo escribe
y lee de vuelta un enmascarado. Nunca viaja al navegador.

**2. El outbox — `message_outbox`.** `appointment_id`, `tipo`, `send_at`, `estado`
(`pending` → `sending` → `sent` | `failed` | `expired` | `cancelled`), `intentos`,
`wa_message_id`, `error`. Índice único sobre `(appointment_id, tipo)` filtrado por
`estado <> 'cancelled'`: nunca dos recordatorios del mismo tipo para el mismo turno.

**3. Las filas del outbox nacen por trigger, no desde la app.** Cambio deliberado respecto de
cómo se venía trabajando. Hoy hay al menos seis caminos que tocan `appointments`: turno suelto,
`crear_serie`, `materializar_y_extender` (job de las 03:00 ART), `reprogramar_serie_desde`,
`cancelar_serie` y la cancelación individual. Si el outbox se llena desde las acciones de
TypeScript, alcanza con olvidarse de uno para que un paciente no reciba aviso o —peor— reciba el
aviso de un turno cancelado. La Etapa 1b ya mostró esa falla exacta con los `revalidatePath`
faltantes; ahí el costo era una pantalla vieja, acá es un mensaje equivocado a un paciente real.
Un trigger `AFTER INSERT OR UPDATE OR DELETE` en `appointments` cubre los seis caminos y los que
vengan.

**4. El despachador — Edge Function `despachar-recordatorios`.** Invocada cada 5 minutos por
`pg_cron` + `pg_net` con un secreto compartido en el header. Toma 50 filas con
`FOR UPDATE SKIP LOCKED`, revalida contra el turno vivo, descarta lo vencido (`expired`),
despacha a Meta, guarda el `wa_message_id`, marca `sent`. Va en TypeScript y no en SQL puro
porque acá hay HTTP, firmas y reintentos que se quieren poder testear.

**5. El webhook — Edge Function `wa-webhook`.** Pública. `GET` contesta el desafío de verificación
de Meta (`hub.challenge`); `POST` valida `X-Hub-Signature-256` —HMAC-SHA256 del **body crudo**
contra el App Secret— y recién ahí mira el contenido. Sin esa validación el endpoint es
"cancelá el turno de cualquiera". Idempotencia por `wa_message_id`, porque Meta reintenta.
Recibe tres cosas: estados de entrega (actualizan el outbox), clicks de botón (cambian el turno)
y texto libre (va a `mensajes_entrantes`).

**6. Mensajes entrantes — `mensajes_entrantes`.** El texto libre se guarda, se matchea con el
paciente por teléfono en E.164 —`src/lib/telefono.ts` ya hace esa normalización— y aparece como
aviso en `/hoy`. Si el número no matchea ningún paciente, la fila se guarda igual con
`patient_id` nulo: perder un mensaje es peor que mostrarlo sin nombre.

### Ventana de envío

El recordatorio de 24hs de un turno del lunes 8:00 cae domingo 8:00. **Ventana de envío de
08:00 a 21:00 hora argentina**: si `send_at` cae fuera, se corre al próximo 08:00. Pierde
exactitud, gana no despertar pacientes un domingo; a un aviso de 24hs le da lo mismo.

### Flujo completo

Se crea el turno → el trigger inserta la fila del outbox con `send_at` = turno − 24hs, ajustado
a la ventana → `pg_cron` despierta al despachador → revalida, manda la plantilla con los botones
y el `appointment_id` en el payload del quick reply → Meta contesta el `wa_message_id` → el
paciente toca *Confirmar* o *Cancelar* → el webhook valida la firma, ubica el turno por el
payload y lo actualiza → si canceló, se ve en `/hoy` y sale el email.

## 4. PENDIENTE — lo que falta diseñar

Al retomar, seguir por acá:

- **Plantillas de Meta**: texto exacto del recordatorio, botones, categoría (utility), proceso de
  aprobación y cuánto tarda. El recordatorio de 2hs va **desactivado** por defecto (del diseño v1).
- **Manejo de fallos**: reintentos con backoff, `contactable = false` en el paciente cuando rebota,
  chequeo de salud de la conexión (job diario + marcar `caida` ante cualquier 401), barra roja fija
  y email.
- **Costos**: tarifa vigente de plantillas utility en Argentina — **sigue sin verificar y es la
  viabilidad del diferencial principal** (precio plano con recordatorios incluidos). Dato relevante
  a confirmar: desde nov-2024 las conversaciones de servicio (iniciadas por el paciente) son
  gratis, y las plantillas utility dentro de una ventana de 24hs abierta también. Los recordatorios
  son business-initiated, así que se pagan salvo que el paciente haya escrito en las últimas 24hs.
- **Plan de pruebas**: cómo se prueba de punta a punta contra el celular del usuario con el número
  de prueba de Meta; qué se testea con Vitest y qué a mano.
- **Configuración**: pantalla de conexión asistida, textos de recordatorio editables.

Después de eso: aprobación del usuario → auto-review del spec → `writing-plans`.

## 5. Lo que viene DESPUÉS de esta etapa (no se diseña ahora, pero no hay que cerrarle la puerta)

Es lo que originó esta conversación y sigue siendo el objetivo:

**Reserva por WhatsApp con IA.** El paciente escribe al número del consultorio y saca turno
conversando, sin link ni formulario. Encima del matcher de disponibilidad del diseño v1 (§6),
pero con la entrada en lenguaje natural en vez de un formulario web.

**Modo automático vs. aprobación manual, a elección del profesional.** Tres modos:

1. **Automático** — el sistema confirma el turno solo, dentro de las reglas del profesional.
2. **Aprobación** — el sistema propone, el profesional acepta o rechaza desde `/hoy`.
3. **Rechazo con contrapropuesta** — al rechazar, el profesional manda otra opción de horario al
   paciente por el mismo hilo.

El diseño v1 tenía esto cerrado en "el profesional aprueba" (§13). **Queda reabierto como un
ajuste por profesional.** Nada de la Etapa 2 debería cerrar esa puerta: por eso el outbox tiene
`tipo` y no un enum de dos valores, y por eso los mensajes entrantes se guardan aunque todavía
no se puedan responder.
