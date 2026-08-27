# Turno Fijo — Investigación de competencia y puntos de dolor

**Fecha:** 2026-08-19
**Método:** reviews de Capterra, páginas de producto y precios de los competidores, sitios de reclamos, prensa argentina y del Alto Valle, contenido de la industria.
**Limitación importante:** todo esto es investigación de escritorio. Nada reemplaza hablar con diez profesionales de Roca (ver §7).

---

## 1. El mercado está mucho más poblado de lo que suponíamos

Competidores relevados, todos activos en Argentina o apuntando a Argentina:

| Producto | Foco | Nota |
|---|---|---|
| Turnera | Salud, landings por especialidad | Argentino. Agenda **gratis**, recordatorios por pack |
| Turnito | Salud y servicios | Argentino. Plan gratis de por vida |
| Gendu | Servicios | Argentino. Gratis ilimitado, 100% pesos, sin comisiones |
| ReservaSimple | Servicios | Argentino, cobra en ARS por MercadoPago |
| Citalo | Kinesiología | Argentino |
| Psicobit | Psicólogos | Argentino, con historia clínica |
| Booksolut | Clínicas LatAm | Publicita turnos recurrentes + lista de espera |
| Encuadrado | Terapeutas LatAm | Agenda + cobros + boletas |
| AgendaPro | Salud y estética, 17 países | Chileno, el más grande |
| Doctoralia | Salud | El de mayor marca en Argentina |
| Otros | | Turnosia, Turnitos, TusTurnos, DocFav, TurnoBoost, Confirmafy, RecordarApp, DoctoCliq, Medicloud |

Además compiten de arriba Calendly y Acuity, y de abajo el cuaderno y Google Calendar.

## 2. El diferencial "la serie es la unidad de trabajo" está muerto

Era el punto 1 del §2 del spec. **Ya lo hacen.**

- **Turnera**: "Elegí frecuencia y cantidad de encuentros" — arma la serie completa en un click.
- **Turnito**: reservas recurrentes, hasta 15 en el plan Advance e ilimitadas en el Pro.
- El contenido de la industria describe como **requisito estándar** para software de kinesiología: "crear series de turnos recurrentes, modificar o cancelar una sesión puntual sin afectar el resto de la serie".

O sea que reprogramar una sesión sin romper la serie no es un diferencial: es la línea de base. El spec hay que corregirlo.

## 3. El diferencial "reserva por disponibilidad" sigue en pie

No encontré **ninguno** que permita al paciente mandar sus días y franja horaria para que el sistema arme la serie. Todos son selección de casillero: el paciente ve huecos y elige uno.

Verificado explícitamente en Turnera y Turnito.

**Salvedad honesta:** ausencia de evidencia en páginas de marketing no es evidencia de ausencia. Hay que confirmarlo usando los productos, no leyéndolos.

## 4. Los dolores documentados, ordenados por qué tan explotables son

### 4.1 Cobrar los recordatorios de WhatsApp aparte — el dolor #1

Es la queja más repetida y la más explotable. De reviews reales de AgendaPro en Capterra:

- *"Que los mensajes de whatsapp se tengan que comprar aparte"* — dueño de clínica dental
- *"los costos todavía son altos para los mensajes de whtasapp"* — CEO de práctica médica

Y así lo cobra el mercado:

- **Turnera**: agenda gratis, pero los recordatorios en packs — 20 a $150 c/u, 50 a $140 c/u, 100 a $135 c/u.
- **Turnito**: el plan gratis **no incluye ningún recordatorio**. Hay que pasar a $24.500/mes para tener 100, o $42.000/mes para 250.

**La lectura:** el recordatorio *es* el producto, y todos lo venden como extra medido. El profesional siente que le cobran por lo único que le importa. Un precio plano en pesos con una cuota generosa incluida es una cuña real, y además es un mensaje de venta de una sola frase.

**El riesgo:** el costo por mensaje de la API oficial es tuyo. Sin verificar ese número (§7) no sabés si el precio plano cierra.

### 4.2 Precio en dólares

Documentado como queja específica del mercado argentino: un precio en dólares es impredecible, uno en pesos es presupuestable — más impuesto PAÍS y percepciones. Doctoralia acumula reclamos por cobrar en dólares habiendo prometido pesos.

**Lectura:** precio en ARS por MercadoPago. No es diferencial, es requisito de entrada. Los competidores argentinos ya lo hacen.

### 4.3 Permanencia, letra chica y comisiones no declaradas

- **Doctoralia**: permanencia de un año, siguen debitando aunque el profesional no reciba pacientes, soporte que no responde, reembolsos prometidos que no llegan.
- **Booksy**: cobro de un porcentaje por cliente atendido *sin avisarlo al contratar*, cobros por cancelaciones ajenas.
- **Turnito**: 5% de comisión sobre los pagos en el plan gratis.

**Lectura:** "sin permanencia, sin comisiones, cancelás cuando querés" es una promesa que en este rubro tiene credibilidad porque el dolor es real y reciente.

### 4.4 La app móvil es peor que la web

De reviews de AgendaPro:

- *"la versión que tienen disponibles para los teléfonos celulares no funciona muy bien, se queda cargando"*
- *"La aplicación no tiene las mismas funciones que la versión web"*

**Lectura:** valida la decisión de diseño de §8 del spec. El profesional que atiende solo vive en el celular, y ahí es donde los grandes están flojos. La pantalla "El día" tiene que ser impecable en un teléfono.

### 4.5 Soporte lento o inexistente

Aparece en AgendaPro, Booksy y Doctoralia por igual.

**Lectura — y probablemente lo más importante de todo el documento:** acá es donde tu ventaja es estructural y no copiable. Estás en Roca. Podés ir al consultorio. Ninguno de estos productos puede. El foso no es el software, es la presencia.

### 4.6 Política de cancelación

La evidencia sostiene lo que habíamos discutido: avisar al paciente que se le cobra si cancela con menos de 24 horas **aumenta la asistencia**, y las condiciones de cancelación poco claras fomentan el ausentismo.

Está fuera de v1 por decisión tomada. Queda registrado como el candidato más fuerte para v2.

## 5. El hallazgo que puede cambiar el nicho: kinesiología

**El problema real de un kinesiólogo argentino no son los turnos. Son las obras sociales.**

- Los pagos se liquidan a dos meses de presentada la facturación, y la inflación se come el importe.
- Los valores rondaban $2.700–$2.800 por sesión, cifra que según el propio colegio no cubre el costo de mantener un consultorio abierto.
- El Colegio de Kinesiólogos bonaerense llegó a **suspender la atención** a afiliados de Galeno, OSECAC y AMEBPBA.

**Y en Río Negro puntualmente, con IPROSS:**

- Deudas acumuladas de hasta **cuatro meses**, cuando el convenio estipula 45 días.
- Kinesiología estuvo impaga desde noviembre en adelante.
- **Solo el 15% de los prestadores atiende con IPROSS, y bajando.**
- El Colegio de Psicólogos reclamó formalmente para que "no se corte la cadena de pagos".

**Lectura:** a un kinesiólogo que factura a obra social, una app de turnos no le toca el problema que lo desvela. Le estarías vendiendo aspirinas a alguien con una fractura.

**Los que sí tienen tu dolor son los que cobran particular** — psicólogos sobre todo, y nutricionistas. Controlan su propia plata, el ausentismo les pega directo en el bolsillo, y la sesión semanal es su modo de trabajo natural.

**Recomendación:** re-pesar el nicho hacia **psicólogos y nutricionistas que atienden particular**. Kinesiología no se descarta, pero deja de ser el foco: para ese segmento la cuña sería facturación a obras sociales, que es otro producto.

## 6. Qué le hace todo esto al plan

**Cambios al spec:**

1. **Sacar "la serie es la unidad de trabajo" de la lista de diferenciales** y bajarlo a requisito de paridad. Sigue habiendo que construirlo; simplemente no vende solo.
2. **El diferencial pasa a ser tres cosas**, en este orden:
   - Precio plano en pesos con recordatorios incluidos, contra el modelo de packs medidos de todo el mercado
   - Presencia local: onboarding presencial y soporte de alguien que vive acá
   - Reserva por disponibilidad, que es el único diferencial de software que sobrevive
3. **Re-pesar el nicho** hacia particular: psicólogos y nutricionistas primero.
4. **La pantalla "El día" en celular pasa a ser prioridad de producto**, no un detalle de implementación: es la debilidad documentada de los grandes.

**Cambio de fondo, y es incómodo:** la diferenciación por software es delgada. Lo que te distingue de verdad es el precio y estar acá. Eso empuja el negocio hacia lo que discutimos al principio — servicio productizado antes que SaaS puro.

## 7. Lo que falta verificar y no se puede hacer desde el escritorio

1. **Usar Turnera y Turnito de verdad** para confirmar el hueco de la reserva por disponibilidad. Es la base del único diferencial de software que queda.
2. **Hablar con diez profesionales de Roca.** Qué usan hoy, qué pagan, qué los enoja, cuántos turnos pierden por semana. Nada de esta investigación sustituye eso.
3. **Costos de la API de WhatsApp.** De esto depende si el precio plano con recordatorios incluidos cierra o es suicida.
4. **Reviews de las tiendas de apps** de Psicobit, AgendaPro y Turnito. El intento devolvió 429; reintentar.
5. **Grupos de Facebook y WhatsApp de los colegios profesionales del Alto Valle.** Es donde estas quejas se dicen sin filtro de marketing, y no son indexables.

## Fuentes

- [AgendaPro — reviews en Capterra](https://www.capterra.com/p/218709/AgendaPro/reviews/)
- [Turnera — software para psicólogos](https://www.turnera.com.ar/agenda/software-para-psicologos)
- [Turnito — app para psicólogos y psiquiatras](https://turnito.app/ar/app-reservas-psicologos-psiquiatras/)
- [Doctoralia — reclamos en tuQuejaSuma](https://tuquejasuma.com/doctoralia/reclamos/estafa)
- [Doctoralia — reclamaciones en OCU](https://www.ocu.org/reclamar/empresas/doctoralia/c171c484f900cca285)
- [Booksy — opiniones en Trustpilot](https://es.trustpilot.com/review/booksy.com)
- [Kinesiólogos suspenden servicios a obras sociales — El Día](https://www.eldia.com/nota/2024-2-6-2-46-15-kinesiologos-suspenden-servicios-a-obras-sociales-la-ciudad)
- [El Colegio de Psicólogos reclama a IPROSS — Diario Río Negro](https://www.rionegro.com.ar/el-colegio-de-psicologos-reclama-a-ipross-que-no-se-corte-la-cadena-de-pagos-1058244/)
- [Psicólogos y la cadena de deudas de IOMA — Perfil](https://www.perfil.com/noticias/politica/atender-en-diciembre-y-cobrar-en-mayo-los-psicologos-van-al-paro-por-la-cadena-de-deudas-de-ioma.phtml)
- [Gestionar cancelaciones en psicoterapia](https://emprendepsicologo.com/blog/gestionar-cancelaciones-psicoterapia)
- [Mejores plataformas para gestionar turnos en Argentina](https://www.reservasimple.com/mejores-plataformas-gestionar-turnos-argentina)
