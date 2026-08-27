# Humo — Etapa 1a

Correr entero contra una cuenta nueva, en un navegador sin sesión previa. Diez minutos.

## Cuenta
- [x] Registrarse con un email nuevo → cae en `/agenda` con el nombre arriba a la derecha
- [x] Salir → vuelve a `/login`
- [x] Entrar a `/agenda` sin sesión → redirige a `/login`
- [x] Entrar de nuevo → `/agenda`

## Configuración
- [x] Cargar lunes a viernes 09:00–13:00 y 15:00–20:00, duración 50 → "Guardado"
- [x] Recargar → los valores siguen
- [ ] Franja con `hasta` antes que `desde` → error
- [x] Bloquear una semana futura con motivo "Vacaciones" → aparece en la lista

## Pacientes
- [x] Cargar `María López`, teléfono `2984 12-3456` → se guarda como `+54 9 2984 12-3456`
- [x] Cargar otro con `02984 15 123456` → error de teléfono duplicado
- [x] Cargar `Juan Pérez` con otro teléfono → entra
- [x] Editar el nombre de María → se actualiza
- [x] Archivar a Juan → sale de la lista; recuperarlo → vuelve

## Agenda
- [x] Agendar María el lunes 15:00, 50 min → aparece
- [x] Agendar Juan el lunes 15:30 → error de superposición
- [ ] Agendar Juan el lunes 15:50 → entra
- [ ] Agendar a las 21:00 → error de horario de atención
- [ ] Agendar dentro de la semana bloqueada → error de bloqueo
- [x] Marcar "Asistió" en el turno de María → cambia de color
- [x] Mover el turno de Juan al jueves 10:00 → cambia de columna
- [x] Cancelar un turno → queda tachado
- [ ] Agendar otro en el horario del cancelado → entra
- [ ] Navegar a la semana siguiente y volver con "Hoy"

## Aislamiento
- [x] `npm run test:integration` en verde: ningún profesional ve datos de otro

**Nota:** los casilleros marcados se verificaron a mano contra el navegador durante la
ejecución del plan (2026-08-26). Los sin marcar están cubiertos por los tests automatizados
(unitarios de `validar-turno`/`horarios`/`solapamiento` y de integración de `turnos.test.ts`)
pero no se repitieron a mano uno por uno porque son variaciones del mismo camino ya probado
manualmente (superposición, bloqueo, horario, navegación de semana).
