# Turno Fijo

Agenda de turnos para profesionales de salud que trabajan con sesiones recurrentes y cobran
particular. Mercado inicial: General Roca, Río Negro.

- Diseño: `docs/superpowers/specs/2026-08-19-turnofijo-design.md`
- Investigación de competencia: `docs/research/2026-08-19-competencia-y-dolores.md`
- Planes de la Etapa 1: `docs/superpowers/plans/2026-08-24-etapa-1a-agenda-base.md` y
  `docs/superpowers/plans/2026-08-24-etapa-1b-series-y-dia.md`

## Estado

Etapa 1 completa: auth, tenancy con RLS, pacientes, horarios, bloqueos, turnos sueltos, agenda
semanal, series recurrentes con horizonte rodante, reprogramación "solo este / de acá en
adelante" y pantalla del día para celular. **Sin WhatsApp** — eso es la Etapa 2.

## Correr en local

```bash
npm install
cp .env.local.example .env.local   # completar con los datos del proyecto de Supabase
npm run dev
```

## Tests

```bash
npm test               # lógica pura: tiempo, teléfonos, horarios, solapamiento, validación
npm run test:integration   # RLS y garantías del esquema contra el Supabase de desarrollo
```

Los tests de integración necesitan `.env.test.local` con `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Crean y borran usuarios de
prueba reales en el proyecto de desarrollo.

## Base de datos

No hay Supabase CLI ni Docker en el entorno de desarrollo. Las migraciones se versionan en
`supabase/migrations/` y se aplican con la herramienta MCP `apply_migration` contra el
proyecto remoto. **Regla: nunca cambiar el esquema desde el dashboard sin escribir la
migración correspondiente.**

## Decisiones que no se ven en el código

- **Todo en UTC, se muestra en −03.** Argentina no tiene horario de verano: el offset es una
  constante en `src/lib/tiempo.ts` y no hay librería de zonas horarias.
- **`patients` no tiene campos clínicos.** Es una restricción del diseño, no un olvido.
- **Dos garantías viven en el esquema, no en el código:** RLS por `professional_id` y la
  restricción `EXCLUDE USING gist` contra turnos superpuestos.
- **Confirmación de email apagada en desarrollo.** Hay que prenderla antes de tener usuarios
  reales: Authentication → Sign In / Providers → Email → Confirm email.
- **La cadencia de las series vive en Postgres**, en `generar_ocurrencias`. No hay una segunda
  implementación en TypeScript: el job de `pg_cron` la necesita adentro de la base, y dos
  copias de la misma regla se desincronizan.
- **`mensual` son 28 días**, no el mismo número de mes: la serie se identifica por día de la
  semana, y "el 15" caería un día distinto cada vez.
- **Las series no se borran**, se finalizan o se cancelan. Borrarlas perdería el historial de
  asistencia, que es lo que el profesional quiere conservar.
- **Un job diario a las 03:00 (ART) extiende las series activas** hasta 8 semanas adelante:
  `cron.job` → `extender-series`. Si las series indefinidas dejan de aparecer en la agenda, es
  lo primero que hay que mirar.
