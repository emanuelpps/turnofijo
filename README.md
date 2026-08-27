# Turno Fijo

Agenda de turnos para profesionales de salud que trabajan con sesiones recurrentes y cobran
particular. Mercado inicial: General Roca, Río Negro.

- Diseño: `docs/superpowers/specs/2026-08-19-turnofijo-design.md`
- Investigación de competencia: `docs/research/2026-08-19-competencia-y-dolores.md`
- Plan de esta etapa: `docs/superpowers/plans/2026-08-24-etapa-1a-agenda-base.md`

## Estado

Etapa 1a terminada: auth, tenancy con RLS, pacientes, horarios, bloqueos, turnos sueltos y
agenda semanal. **Sin WhatsApp y sin series recurrentes** — eso es 1b y la Etapa 2.

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
