# Humo — Etapa 1b

Se corre después del humo de 1a, sobre la misma cuenta. Diez minutos.

## Alta de serie
- [ ] "+ Serie": María, martes 15:00, 50 min, semanal, 10 sesiones → vista previa con 9 fechas libres
- [ ] Crear → los martes de la agenda se llenan, todos con el `↻`
- [ ] Serie de Juan los martes 15:00 → todas marcadas "ya tenés otro turno", sin botón de crear
- [ ] Serie que cruza una semana bloqueada → esa fecha tachada con "día bloqueado"
- [ ] Serie a las 21:00 → todas "fuera de tu horario"
- [ ] Serie con "Sin fecha de fin" → agenda 8 semanas

## Reprogramar
- [ ] Mover un turno de serie → aparece la pregunta con las dos opciones
- [ ] "Solo este turno" al viernes → se mueve solo ése
- [ ] "Este y todos los que siguen" a otro día y hora → ése y los posteriores se mudan
- [ ] Los turnos anteriores quedan en su día original
- [ ] Un turno marcado "Asistió" sigue intacto después de reprogramar
- [ ] "Dar de baja toda la serie" → los futuros tachados, los pasados intactos

## Pantalla del día (en un celular de verdad)
- [ ] `/hoy` muestra los turnos ordenados, con la hora grande
- [ ] "Asistió" y "No vino" se aprietan con el pulgar sin zoom
- [ ] El contador de "sin marcar" baja al marcar
- [ ] Tocar el teléfono abre el marcador
- [ ] Las flechas van al día anterior y siguiente
- [ ] Un día vacío muestra el mensaje, no una pantalla en blanco
- [ ] Ningún scroll horizontal

## Horizonte rodante

Los dos primeros se verificaron por SQL al cerrar la Etapa 1 (job activo con `0 6 * * *`,
`extender_series()` devolvió `0` sin error porque no había series activas en ese momento). Se
repiten acá porque son lo primero que hay que mirar si las series dejan de aparecer.

- [ ] `select jobname, active from cron.job where jobname = 'extender-series';` → activa
- [ ] Correr `select public.extender_series();` a mano → devuelve un número sin error
- [ ] Una serie indefinida creada hoy tiene turnos hasta ~8 semanas adelante
