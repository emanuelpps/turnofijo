# Turno Fijo — Etapa 1b: Series recurrentes y pantalla del día — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para el seguimiento.

**Objetivo:** Cerrar la Etapa 1 del diseño — series recurrentes materializadas con horizonte rodante, reprogramación con la pregunta "¿solo este, o de acá en adelante?", y la pantalla del día optimizada para celular. Al terminar, un profesional puede usar Turno Fijo como su agenda real, todos los días.

**Arquitectura:** Los turnos de una serie **se materializan**: crear "María, martes 15:00, 10 sesiones" inserta diez filas reales en `appointments`, no una regla que se interpreta al vuelo. Mover el turno 4 al jueves es entonces un `UPDATE`, no la parte más difícil del sistema. La generación de fechas vive en **una sola función de Postgres** porque el job de `pg_cron` la necesita tanto como la app, y dos implementaciones de la misma cadencia se desincronizan sin falta. La validación (horarios, bloqueos, choques) sigue en TypeScript, reusando `validarTurno` de la Etapa 1a.

**Stack:** el mismo de 1a — Next.js 16, Supabase (Postgres + RLS + `pg_cron`), TypeScript, Tailwind 4, Vitest.

**Referencia de diseño:** `docs/superpowers/specs/2026-08-19-turnofijo-design.md` (§5 series y horizonte rodante, §8 alta de serie, reprogramar y pantalla del día, §10 casos de borde, §12 Etapa 1).

**Plan anterior:** `docs/superpowers/plans/2026-08-24-etapa-1a-agenda-base.md`. **Este plan asume que 1a está terminada y en verde.** No arranca hasta que `npm test`, `npm run test:integration`, `npm run lint` y `npm run build` pasen.

---

## Alcance

**Entra en 1b:**
- Tabla `series` y la clave foránea de `appointments.series_id`
- Generación de ocurrencias en Postgres: semanal, quincenal y mensual
- Alta de serie con vista previa: qué días entran, cuáles chocan y por qué
- Horizonte rodante: un job diario que extiende las series hasta 8 semanas adelante
- Reprogramación con la pregunta *"¿solo este, o de acá en adelante?"*
- Cancelar una serie entera
- Pantalla del día para celular, con los botones grandes de asistió / ausente

**No entra (Etapa 2 en adelante):** WhatsApp, recordatorios, bandeja, matcher de disponibilidad, cobros, notas clínicas.

---

## Tres decisiones que se toman acá y conviene tener a mano

**1. `mensual` son 28 días, no "el mismo número de mes".** La serie se identifica por día de la semana y hora (`dia_semana` + `hora_local`, §5 del diseño). "El 15 de cada mes" no cabe en ese modelo: caería un martes, después un jueves, después un domingo. Cuatro semanas mantiene el día fijo y queda a dos días de los "cada 30 días" que el diseño menciona para nutrición. Si alguna vez hace falta el día del mes, es otra columna y otra rama del generador — no un parche a éste.

**2. El alta de serie muestra vista previa; la extensión automática y la reprogramación, no.** En el alta hay alguien mirando la pantalla y el diseño pide que ese flujo sea impecable: se calculan las ocurrencias, se valida cada una con `validarTurno` y se muestra qué entra y qué choca antes de confirmar. El job de `pg_cron` corre a las 3 de la mañana y la reprogramación "de acá en adelante" resuelve un caso mucho menos frecuente: los dos saltean lo que choca y reportan cuántos crearon. Duplicar la pantalla de vista previa para esos dos casos sería trabajo que no compra nada.

**3. Las series no se borran nunca: se finalizan o se cancelan.** `appointments.series_id` apunta a `series` con `on delete restrict`. Borrar una serie con historial dejaría turnos huérfanos y perdería el registro de asistencia, que es justamente lo que el profesional quiere conservar.

---

## Estructura de archivos

**Se crean:**

```
supabase/migrations/
├── 0005_series.sql                    tabla series, enums, FK de appointments.series_id
├── 0006_generar_ocurrencias.sql       la cadencia, en un solo lugar
├── 0007_crear_serie.sql               alta atómica: serie + turnos en una transacción
├── 0008_materializar_y_extender.sql   horizonte rodante + pg_cron
└── 0009_reprogramar_y_cancelar.sql    "de acá en adelante" y baja de serie

src/acciones/series.ts                 previsualizar, crear, reprogramar, cancelar
src/componentes/series/
├── formulario-serie.tsx               el flujo estrella: menos de 30 segundos
└── vista-previa-serie.tsx             qué días entran y cuáles chocan
src/componentes/agenda/dialogo-reprogramar.tsx   la pregunta
src/componentes/dia/pantalla-del-dia.tsx
src/app/(app)/hoy/page.tsx

tests/integration/ocurrencias.test.ts   la cadencia, caso por caso
tests/integration/series.test.ts        atomicidad, horizonte, reprogramación
```

**Se modifican:**

```
src/tipos/db.ts                        Serie, SerieFrecuencia, SerieEstado
src/app/(app)/layout.tsx               "Hoy" primero en la navegación
src/app/(app)/agenda/page.tsx          traer series junto con los turnos
src/componentes/agenda/agenda-semanal.tsx   marca de serie + botón de alta + reprogramar
```

---

## Tarea 1: Migración 0005 — la tabla `series`

**Archivos:**
- Crear: `supabase/migrations/0005_series.sql`
- Modificar: `src/tipos/db.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0005_series.sql`:

```sql
create type public.serie_frecuencia as enum ('semanal', 'quincenal', 'mensual');
create type public.serie_estado as enum ('activa', 'finalizada', 'cancelada');

create table public.series (
  id                uuid primary key default gen_random_uuid(),
  professional_id   uuid not null references public.professionals(id) on delete cascade,
  patient_id        uuid not null,
  dia_semana        smallint not null check (dia_semana between 0 and 6),
  hora_local        time not null,
  duracion_min      integer not null check (duracion_min between 5 and 480),
  frecuencia        public.serie_frecuencia not null default 'semanal',
  -- NULL = indefinida: el psicólogo que atiende a alguien hace tres años.
  sesiones_totales  integer check (sesiones_totales is null or sesiones_totales between 1 and 200),
  desde             date not null,
  -- Hasta dónde se materializó. El job del horizonte rodante lo empuja.
  horizonte_hasta   date not null,
  estado            public.serie_estado not null default 'activa',
  creado_en         timestamptz not null default now(),

  constraint series_paciente_del_profesional
    foreign key (patient_id, professional_id)
    references public.patients (id, professional_id)
    on delete restrict,

  -- Habilita la FK compuesta desde appointments.
  unique (id, professional_id)
);

comment on table public.series is
  'Serie recurrente. Los turnos se materializan en appointments: acá vive la regla, no el calendario.';

create index series_activas on public.series (professional_id, estado);

alter table public.series enable row level security;

create policy series_todo_propio on public.series
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- La FK quedó pendiente desde la migración 0004. MATCH SIMPLE: los turnos
-- sueltos (series_id NULL) pasan sin problema.
-- on delete restrict: una serie con turnos no se borra, se finaliza o se cancela.
alter table public.appointments
  add constraint appointments_serie_del_profesional
  foreign key (series_id, professional_id)
  references public.series (id, professional_id)
  on delete restrict;

create index appointments_por_serie on public.appointments (series_id);
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0005_series", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Verificar**

`mcp__claude_ai_Supabase__execute_sql`:

```sql
select
  (select relrowsecurity from pg_class where relname = 'series') as rls_activa,
  (select count(*) from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_serie_del_profesional') as fk_serie;
```

Esperado: `rls_activa = true`, `fk_serie = 1`.

- [ ] **Paso 4: Agregar los tipos**

Al final de `src/tipos/db.ts`:

```ts
export type SerieFrecuencia = 'semanal' | 'quincenal' | 'mensual'
export type SerieEstado = 'activa' | 'finalizada' | 'cancelada'

export type Serie = {
  id: string
  professional_id: string
  patient_id: string
  dia_semana: number
  /** `HH:MM:SS` — Postgres devuelve `time` con segundos. */
  hora_local: string
  duracion_min: number
  frecuencia: SerieFrecuencia
  /** `null` = indefinida. */
  sesiones_totales: number | null
  desde: string
  horizonte_hasta: string
  estado: SerieEstado
}
```

`db.ts` es el espejo del esquema, igual que en 1a: `Serie`, `SerieEstado` y `SerieFrecuencia` quedan declarados aunque 1b todavía no los consuma desde ningún componente.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0005_series.sql src/tipos/db.ts
git commit -m "feat: tabla series y clave foránea de appointments.series_id"
```

---

## Tarea 2: Migración 0006 — la cadencia, en un solo lugar

Ésta es la pieza que el diseño manda testear en serio (§10). Vive en Postgres y no en TypeScript por una razón concreta: el job de `pg_cron` que extiende el horizonte corre dentro de la base, sin pasar por la app. Si la cadencia estuviera en TypeScript habría que escribirla dos veces, y el día que alguien arregle un borde en una de las dos, las series se van a partir en silencio.

**Archivos:**
- Crear: `supabase/migrations/0006_generar_ocurrencias.sql`
- Test: `tests/integration/ocurrencias.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0006_generar_ocurrencias.sql`:

```sql
/**
 * Fechas de una serie, desde `p_desde` hasta `p_hasta` inclusive.
 *
 * La primera ocurrencia es el primer día >= p_desde que caiga en el día de la
 * semana pedido (0 = domingo, igual que extract(dow)). Después se avanza de a
 * un paso fijo: 7, 14 o 28 días.
 *
 * `p_sesiones_totales` NULL significa serie indefinida: corta solo por p_hasta.
 *
 * Es la ÚNICA definición de la cadencia en todo el sistema.
 */
create or replace function public.generar_ocurrencias(
  p_desde            date,
  p_dia_semana       smallint,
  p_frecuencia       public.serie_frecuencia,
  p_sesiones_totales integer,
  p_hasta            date
)
returns setof date
language sql
immutable
set search_path = public
as $$
  with parametros as (
    select
      p_desde + ((p_dia_semana - extract(dow from p_desde)::int + 7) % 7) as primera,
      case p_frecuencia
        when 'semanal'   then 7
        when 'quincenal' then 14
        when 'mensual'   then 28
      end as paso
  )
  select g::date
  from parametros,
       lateral generate_series(primera::timestamp, p_hasta::timestamp, (paso || ' days')::interval) as g
  where p_sesiones_totales is null
     or (g::date - primera) / paso < p_sesiones_totales;
$$;
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0006_generar_ocurrencias", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Escribir el test**

Es un test de integración y no unitario porque la función vive en Postgres. Corre contra el proyecto de desarrollo, no toca ninguna tabla y no necesita usuarios de prueba.

`tests/integration/ocurrencias.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { admin } from './ayudantes'

async function ocurrencias(args: {
  desde: string
  diaSemana: number
  frecuencia: 'semanal' | 'quincenal' | 'mensual'
  sesiones: number | null
  hasta: string
}): Promise<string[]> {
  const { data, error } = await admin.rpc('generar_ocurrencias', {
    p_desde: args.desde,
    p_dia_semana: args.diaSemana,
    p_frecuencia: args.frecuencia,
    p_sesiones_totales: args.sesiones,
    p_hasta: args.hasta,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}

// 2026-08-24 es lunes. Martes = 2.
const LUNES = '2026-08-24'

describe('generar_ocurrencias', () => {
  it('genera 4 martes seguidos', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 4, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('arranca el mismo día si desde ya cae en el día de la semana pedido', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 1, frecuencia: 'semanal', sesiones: 2, hasta: '2026-12-31' })
    expect(r[0]).toBe(LUNES)
  })

  it('salta al día correcto cuando desde cae después en la semana', async () => {
    // Miércoles 26, pidiendo martes → el martes siguiente
    const r = await ocurrencias({ desde: '2026-08-26', diaSemana: 2, frecuencia: 'semanal', sesiones: 1, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-09-01'])
  })

  it('quincenal avanza de a 14 días', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'quincenal', sesiones: 3, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-08', '2026-09-22'])
  })

  it('mensual avanza de a 28 días y mantiene el día de la semana', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'mensual', sesiones: 3, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-22', '2026-10-20'])
  })

  it('una serie indefinida corta en el horizonte', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: null, hasta: '2026-09-15' })
    expect(r).toEqual(['2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('el horizonte manda aunque falten sesiones', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 40, hasta: '2026-09-08' })
    expect(r).toHaveLength(3)
  })

  it('devuelve vacío si el horizonte queda antes de la primera ocurrencia', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 4, hasta: '2026-08-24' }),
    ).toEqual([])
  })

  it('cruza el fin de año sin romperse', async () => {
    const r = await ocurrencias({ desde: '2026-12-21', diaSemana: 1, frecuencia: 'semanal', sesiones: 3, hasta: '2027-12-31' })
    expect(r).toEqual(['2026-12-21', '2026-12-28', '2027-01-04'])
  })

  it('cruza febrero de un año bisiesto', async () => {
    const r = await ocurrencias({ desde: '2028-02-21', diaSemana: 1, frecuencia: 'semanal', sesiones: 3, hasta: '2028-12-31' })
    expect(r).toEqual(['2028-02-21', '2028-02-28', '2028-03-06'])
  })

  it('una sola sesión devuelve una sola fecha', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 1, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-08-25'])
  })

  it('el domingo es el día 0 y funciona igual', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 0, frecuencia: 'semanal', sesiones: 2, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-08-30', '2026-09-06'])
  })
})
```

- [ ] **Paso 4: Correr el test**

Correr: `npm run test:integration -- ocurrencias`
Esperado: PASA, 12 tests.

Si alguno falla por el formato de la fecha (`2026-08-25T00:00:00` en vez de `2026-08-25`), es porque PostgREST serializó `date` como timestamp: cambiar el `return` del ayudante por `(data ?? []).map((d: string) => d.slice(0, 10))` y volver a correr.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0006_generar_ocurrencias.sql tests/integration/ocurrencias.test.ts
git commit -m "feat: generación de ocurrencias de una serie en Postgres, con tests"
```

---

## Tarea 3: Migración 0007 — alta atómica de la serie

La serie y sus turnos se crean en una sola transacción. Si el turno número siete choca con algo, no queda una serie a medio materializar: no queda nada, y el profesional ve el error. El cuerpo de una función de Postgres es una transacción, así que sale gratis.

**Archivos:**
- Crear: `supabase/migrations/0007_crear_serie.sql`
- Test: `tests/integration/series.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0007_crear_serie.sql`:

```sql
/**
 * Crea la serie y materializa los turnos que le pasan en `p_inicios`.
 *
 * La app calcula y valida los inicios antes de llamar (vista previa): acá no se
 * decide nada, se escribe. Todo o nada: si un turno viola la exclusión de
 * superposiciones, la serie tampoco queda creada.
 */
create or replace function public.crear_serie(
  p_patient_id       uuid,
  p_dia_semana       smallint,
  p_hora_local       time,
  p_duracion_min     integer,
  p_frecuencia       public.serie_frecuencia,
  p_sesiones_totales integer,
  p_desde            date,
  p_horizonte_hasta  date,
  p_inicios          timestamptz[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_serie_id uuid;
  v_inicio   timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  if array_length(p_inicios, 1) is null then
    raise exception 'la serie no tiene ningún turno para crear';
  end if;

  insert into public.series (
    professional_id, patient_id, dia_semana, hora_local, duracion_min,
    frecuencia, sesiones_totales, desde, horizonte_hasta
  )
  values (
    auth.uid(), p_patient_id, p_dia_semana, p_hora_local, p_duracion_min,
    p_frecuencia, p_sesiones_totales, p_desde, p_horizonte_hasta
  )
  returning id into v_serie_id;

  foreach v_inicio in array p_inicios loop
    insert into public.appointments (professional_id, patient_id, series_id, periodo)
    values (
      auth.uid(),
      p_patient_id,
      v_serie_id,
      tstzrange(v_inicio, v_inicio + (p_duracion_min || ' minutes')::interval, '[)')
    );
  end loop;

  return v_serie_id;
end;
$$;
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0007_crear_serie", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Escribir el test**

`tests/integration/series.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

function inicio(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString()
}

describe('crear_serie', () => {
  let ana: ProfesionalDePrueba
  let maria: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    const { data, error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María', telefono_e164: '+5492984111111' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    maria = data.id
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
  })

  const parametrosBase = {
    p_dia_semana: 2,
    p_hora_local: '15:00',
    p_duracion_min: 50,
    p_frecuencia: 'semanal',
    p_sesiones_totales: 4,
    p_desde: '2026-08-24',
    p_horizonte_hasta: '2026-09-15',
  }

  it('crea la serie y sus cuatro turnos', async () => {
    const { data: serieId, error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_inicios: [
        inicio('2026-08-25', '15:00'),
        inicio('2026-09-01', '15:00'),
        inicio('2026-09-08', '15:00'),
        inicio('2026-09-15', '15:00'),
      ],
    })

    expect(error).toBeNull()
    expect(serieId).toBeTruthy()

    const { count } = await ana.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', serieId as string)

    expect(count).toBe(4)
  })

  it('NO deja nada creado si un turno choca (todo o nada)', async () => {
    const { count: seriesAntes } = await ana.cliente
      .from('series')
      .select('id', { count: 'exact', head: true })

    const { error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_hora_local: '15:00',
      p_inicios: [
        inicio('2026-10-06', '15:00'),
        // Éste pisa el turno del 2026-09-01 creado en el test anterior.
        inicio('2026-09-01', '15:20'),
      ],
    })

    expect(error?.code).toBe('23P01')

    const { count: seriesDespues } = await ana.cliente
      .from('series')
      .select('id', { count: 'exact', head: true })

    expect(seriesDespues).toBe(seriesAntes)

    const { count: sueltos } = await ana.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .filter('periodo', 'ov', `[${inicio('2026-10-06', '15:00')},${inicio('2026-10-06', '16:00')})`)

    expect(sueltos).toBe(0)
  })

  it('rechaza una serie sin ningún turno', async () => {
    const { error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_inicios: [],
    })
    expect(error).not.toBeNull()
  })

  it('los turnos de la serie quedan enlazados a ella', async () => {
    const { data } = await ana.cliente
      .from('appointments')
      .select('series_id')
      .not('series_id', 'is', null)
      .limit(1)
      .single()

    expect(data?.series_id).toBeTruthy()
  })
})
```

El import de `admin` todavía no se usa en este archivo: lo consume el bloque que agrega la Tarea 6. Si el linter lo marca ahora, dejarlo igual.

- [ ] **Paso 4: Correr el test**

Correr: `npm run test:integration -- series`
Esperado: PASA, 4 tests.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0007_crear_serie.sql tests/integration/series.test.ts
git commit -m "feat: alta atómica de series con sus turnos materializados"
```

---

## Tarea 4: Vista previa y alta de serie desde la app

**Archivos:**
- Crear: `src/lib/agenda-datos.ts`
- Modificar: `src/acciones/turnos.ts` (usar los helpers extraídos)
- Crear: `src/acciones/series.ts`

- [ ] **Paso 1: Extraer los helpers de consulta a un módulo propio**

Los tres helpers que la Tarea 15 de 1a dejó privados dentro de `src/acciones/turnos.ts` los necesita ahora también `series.ts`. Un archivo con `'use server'` solo debería exportar acciones, así que se mudan a un módulo común.

Crear `src/lib/agenda-datos.ts` con el contenido exacto que hoy está en `turnos.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { aTstzrange, parsearTstzrange } from './tiempo'
import type { FranjaHoraria } from './horarios'
import type { Periodo } from './solapamiento'

/** Turnos vigentes (no cancelados) que pisan el período, opcionalmente sin uno. */
export async function turnosQueChocan(
  supabase: SupabaseClient,
  periodo: Periodo,
  excluirId?: string,
): Promise<Periodo[]> {
  let consulta = supabase
    .from('appointments')
    .select('id, periodo')
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  if (excluirId) consulta = consulta.neq('id', excluirId)

  const { data } = await consulta
  return (data ?? []).map((t) => parsearTstzrange(t.periodo as string))
}

export async function bloqueosQueChocan(
  supabase: SupabaseClient,
  periodo: Periodo,
): Promise<Periodo[]> {
  const { data } = await supabase
    .from('blocks')
    .select('periodo')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  return (data ?? []).map((b) => parsearTstzrange(b.periodo as string))
}

export async function franjasDeAtencion(supabase: SupabaseClient): Promise<FranjaHoraria[]> {
  const { data } = await supabase.from('working_hours').select('dia_semana, desde, hasta')
  return (data ?? []).map((f) => ({
    dia_semana: f.dia_semana as number,
    desde: String(f.desde).slice(0, 5),
    hasta: String(f.hasta).slice(0, 5),
  }))
}
```

En `src/acciones/turnos.ts`: borrar las tres funciones y sus imports de `SupabaseClient`, `aTstzrange` y `parsearTstzrange`, y agregar arriba:

```ts
import { turnosQueChocan, bloqueosQueChocan, franjasDeAtencion } from '@/lib/agenda-datos'
```

El resto de `turnos.ts` no cambia: los nombres y las firmas son los mismos.

- [ ] **Paso 2: Verificar que 1a sigue en verde después del refactor**

Correr: `npm run build && npm test`
Esperado: build exitoso y 62 tests unitarios en verde. Si el build se queja de un import que quedó sin usar en `turnos.ts`, sacarlo.

- [ ] **Paso 3: Escribir las acciones de series**

`src/acciones/series.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { bloqueosQueChocan, franjasDeAtencion, turnosQueChocan } from '@/lib/agenda-datos'
import { localAUtc, sumarDias } from '@/lib/tiempo'
import { validarTurno, type MotivoRechazo } from '@/lib/validar-turno'

/** Ocho semanas: el horizonte rodante del diseño (§5). */
const DIAS_DE_HORIZONTE = 56

export type OcurrenciaPrevia = {
  fecha: string
  hora: string
  libre: boolean
  motivo?: MotivoRechazo
}

export type EstadoSerie = {
  error?: string
  ocurrencias?: OcurrenciaPrevia[]
  creada?: boolean
  cantidadCreada?: number
}

const esquema = z.object({
  patient_id: z.string().uuid('Elegí un paciente.'),
  dia_semana: z.coerce.number().int().min(0).max(6),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elegí una hora.'),
  duracion_min: z.coerce.number().int().min(5).max(480),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']),
  indefinida: z.coerce.boolean(),
  sesiones_totales: z.coerce.number().int().min(1).max(200).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí desde cuándo.'),
})

type Parametros = z.infer<typeof esquema>

function leerFormulario(datos: FormData) {
  return esquema.safeParse({
    patient_id: datos.get('patient_id'),
    dia_semana: datos.get('dia_semana'),
    hora: datos.get('hora'),
    duracion_min: datos.get('duracion_min'),
    frecuencia: datos.get('frecuencia'),
    indefinida: datos.get('indefinida') === 'on',
    sesiones_totales: datos.get('sesiones_totales') || undefined,
    desde: datos.get('desde'),
  })
}

/**
 * Calcula las ocurrencias y valida cada una contra horarios, bloqueos y turnos
 * existentes. No escribe nada.
 */
async function previsualizar(p: Parametros): Promise<OcurrenciaPrevia[] | { error: string }> {
  const supabase = await crearClienteServidor()
  const sesiones = p.indefinida ? null : (p.sesiones_totales ?? null)

  if (!p.indefinida && sesiones === null) {
    return { error: 'Decime cuántas sesiones, o marcá que es indefinida.' }
  }

  const horizonte = sumarDias(p.desde, DIAS_DE_HORIZONTE)

  const { data: fechas, error } = await supabase.rpc('generar_ocurrencias', {
    p_desde: p.desde,
    p_dia_semana: p.dia_semana,
    p_frecuencia: p.frecuencia,
    p_sesiones_totales: sesiones,
    p_hasta: horizonte,
  })
  if (error) return { error: 'No se pudieron calcular las fechas de la serie.' }

  const listaFechas = ((fechas ?? []) as string[]).map((f) => f.slice(0, 10))
  if (listaFechas.length === 0) {
    return { error: 'Con esos datos no cae ninguna sesión. Revisá el día y la fecha de inicio.' }
  }

  // Una sola consulta por tabla para toda la serie, no una por ocurrencia.
  const rangoCompleto = {
    inicio: localAUtc(p.desde, '00:00'),
    fin: localAUtc(sumarDias(horizonte, 1), '00:00'),
  }

  const [franjas, bloqueos, turnos] = await Promise.all([
    franjasDeAtencion(supabase),
    bloqueosQueChocan(supabase, rangoCompleto),
    turnosQueChocan(supabase, rangoCompleto),
  ])

  return listaFechas.map((fecha) => {
    const inicio = localAUtc(fecha, p.hora)
    const validacion = validarTurno({
      inicio,
      duracionMin: p.duracion_min,
      franjas,
      bloqueos,
      turnosExistentes: turnos,
    })
    return validacion.ok
      ? { fecha, hora: p.hora, libre: true }
      : { fecha, hora: p.hora, libre: false, motivo: validacion.motivo }
  })
}

/**
 * Un solo action para los dos botones del formulario. Sin `confirmar`, muestra
 * la vista previa; con `confirmar`, crea. La vista previa se recalcula del lado
 * del servidor antes de escribir: lo que mandó el navegador no se usa para decidir.
 */
export async function previsualizarOCrearSerie(
  _estado: EstadoSerie,
  datos: FormData,
): Promise<EstadoSerie> {
  const parseado = leerFormulario(datos)
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }
  const p = parseado.data

  const previa = await previsualizar(p)
  if ('error' in previa) return { error: previa.error }

  if (datos.get('confirmar') !== '1') {
    return { ocurrencias: previa }
  }

  const libres = previa.filter((o) => o.libre)
  if (libres.length === 0) {
    return {
      ocurrencias: previa,
      error: 'Ninguna de esas fechas está libre. Probá otro día u horario.',
    }
  }

  const supabase = await crearClienteServidor()
  const inicios = libres.map((o) => localAUtc(o.fecha, o.hora).toISOString())
  const ultima = libres[libres.length - 1].fecha

  const { error } = await supabase.rpc('crear_serie', {
    p_patient_id: p.patient_id,
    p_dia_semana: p.dia_semana,
    p_hora_local: p.hora,
    p_duracion_min: p.duracion_min,
    p_frecuencia: p.frecuencia,
    p_sesiones_totales: p.indefinida ? null : (p.sesiones_totales ?? null),
    p_desde: p.desde,
    p_horizonte_hasta: ultima,
    p_inicios: inicios,
  })

  if (error) {
    if (error.code === '23P01') {
      return { error: 'Alguien ocupó uno de esos horarios recién. Volvé a ver la vista previa.' }
    }
    return { error: 'No se pudo crear la serie.' }
  }

  revalidatePath('/agenda')
  revalidatePath('/hoy')
  return { creada: true, cantidadCreada: libres.length }
}

export async function cancelarSerie(datos: FormData) {
  const id = String(datos.get('serie_id'))
  const supabase = await crearClienteServidor()

  await supabase.rpc('cancelar_serie', { p_serie_id: id })

  revalidatePath('/agenda')
  revalidatePath('/hoy')
}

export async function reprogramarDesde(
  _estado: { error?: string; ok?: boolean; creadas?: number },
  datos: FormData,
): Promise<{ error?: string; ok?: boolean; creadas?: number }> {
  const appointment_id = String(datos.get('appointment_id'))
  const fecha = String(datos.get('fecha'))
  const hora = String(datos.get('hora'))

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: 'Elegí una fecha y una hora.' }
  }

  const nuevoDiaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('reprogramar_serie_desde', {
    p_appointment_id: appointment_id,
    p_nuevo_dia_semana: nuevoDiaSemana,
    p_nueva_hora: hora,
    p_desde: fecha,
  })

  if (error) return { error: 'No se pudo reprogramar la serie.' }

  revalidatePath('/agenda')
  revalidatePath('/hoy')

  const creadas = Array.isArray(data) ? (data[0]?.creadas ?? 0) : 0
  return { ok: true, creadas }
}

```

El motivo del rechazo viaja como código (`fuera_de_horario`, `bloqueado`, `superpuesto`) y se traduce en el componente de vista previa. Mandar el texto ya armado obligaría a un ida y vuelta más al servidor por cada fecha.

- [ ] **Paso 4: Verificar que compila**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`. Las RPC `cancelar_serie` y `reprogramar_serie_desde` todavía no existen en la base — eso no rompe el build, se crean en la Tarea 7.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/agenda-datos.ts src/acciones/turnos.ts src/acciones/series.ts
git commit -m "feat: vista previa y alta de series desde la app"
```

---

## Tarea 5: La pantalla de alta de serie

El flujo estrella del diseño (§8): paciente, día, hora, duración, cantidad. Objetivo, menos de 30 segundos. La vista previa es lo que lo hace confiable — el profesional ve las diez fechas antes de que existan.

**Archivos:**
- Crear: `src/componentes/series/vista-previa-serie.tsx`, `src/componentes/series/formulario-serie.tsx`
- Modificar: `src/componentes/agenda/agenda-semanal.tsx` (botón de alta de serie)

- [ ] **Paso 1: Escribir la vista previa**

`src/componentes/series/vista-previa-serie.tsx`:

```tsx
'use client'

import type { OcurrenciaPrevia } from '@/acciones/series'

const MOTIVOS: Record<string, string> = {
  fuera_de_horario: 'fuera de tu horario',
  bloqueado: 'día bloqueado',
  superpuesto: 'ya tenés otro turno',
}

export function VistaPreviaSerie({ ocurrencias }: { ocurrencias: OcurrenciaPrevia[] }) {
  const libres = ocurrencias.filter((o) => o.libre).length
  const chocan = ocurrencias.length - libres

  return (
    <div className="rounded-lg border border-zinc-200">
      <div className="border-b border-zinc-200 px-3 py-2 text-sm">
        <span className="font-medium">{libres} sesiones</span> se van a agendar
        {chocan > 0 && <span className="text-amber-700"> · {chocan} se saltean</span>}
      </div>
      <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-100 text-sm">
        {ocurrencias.map((o) => (
          <li key={o.fecha} className="flex items-center gap-2 px-3 py-1.5">
            <span className={o.libre ? '' : 'text-zinc-400 line-through'}>
              {o.fecha} · {o.hora}
            </span>
            {!o.libre && o.motivo && (
              <span className="ml-auto text-xs text-amber-700">{MOTIVOS[o.motivo]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Paso 2: Escribir el formulario**

`src/componentes/series/formulario-serie.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import { previsualizarOCrearSerie, type EstadoSerie } from '@/acciones/series'
import { Boton } from '@/componentes/ui/boton'
import { VistaPreviaSerie } from './vista-previa-serie'
import type { Paciente } from '@/tipos/db'

const DIAS = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 0, nombre: 'Domingo' },
]

const CLASE_CAMPO = 'block w-full min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base'

export function FormularioSerie({
  pacientes,
  fechaInicial,
  duracionDefault,
  onCreada,
}: {
  pacientes: Paciente[]
  fechaInicial: string
  duracionDefault: number
  onCreada: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoSerie, FormData>(
    previsualizarOCrearSerie,
    {},
  )
  const [indefinida, setIndefinida] = useState(false)

  useEffect(() => {
    if (estado.creada) onCreada()
  }, [estado.creada, onCreada])

  return (
    <form action={accion} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">Paciente</span>
        <select name="patient_id" required defaultValue="" className={CLASE_CAMPO}>
          <option value="" disabled>
            Elegí un paciente
          </option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Día</span>
          <select name="dia_semana" defaultValue="1" className={CLASE_CAMPO}>
            {DIAS.map((d) => (
              <option key={d.numero} value={d.numero}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Hora</span>
          <input type="time" name="hora" step={300} required className={CLASE_CAMPO} />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Minutos</span>
          <input
            type="number"
            name="duracion_min"
            min={5}
            max={480}
            step={5}
            defaultValue={duracionDefault}
            required
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Frecuencia</span>
          <select name="frecuencia" defaultValue="semanal" className={CLASE_CAMPO}>
            <option value="semanal">Todas las semanas</option>
            <option value="quincenal">Cada 15 días</option>
            <option value="mensual">Cada 4 semanas</option>
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={fechaInicial}
            required
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      <div className="flex items-end gap-3">
        <label className="w-32">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Sesiones</span>
          <input
            type="number"
            name="sesiones_totales"
            min={1}
            max={200}
            defaultValue={10}
            disabled={indefinida}
            className={`${CLASE_CAMPO} disabled:bg-zinc-100 disabled:text-zinc-400`}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="indefinida"
            checked={indefinida}
            onChange={(e) => setIndefinida(e.target.checked)}
            className="size-4"
          />
          Sin fecha de fin
        </label>
      </div>

      {estado.ocurrencias && <VistaPreviaSerie ocurrencias={estado.ocurrencias} />}
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex justify-end gap-2">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? 'Calculando…' : 'Ver vista previa'}
        </Boton>
        {estado.ocurrencias && estado.ocurrencias.some((o) => o.libre) && (
          <Boton type="submit" name="confirmar" value="1" disabled={pendiente}>
            Crear {estado.ocurrencias.filter((o) => o.libre).length} sesiones
          </Boton>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Si es indefinida, se agendan las próximas 8 semanas y el sistema las va extendiendo solo.
      </p>
    </form>
  )
}
```

**Los dos botones son `type="submit"` del mismo formulario.** El segundo lleva `name="confirmar" value="1"`, que el navegador incluye en el `FormData` solo cuando se aprieta ése. Por eso un único action resuelve la vista previa y el alta sin duplicar estado.

- [ ] **Paso 3: Enganchar el alta de serie en la agenda**

En `src/componentes/agenda/agenda-semanal.tsx`:

Agregar los imports:

```tsx
import { FormularioSerie } from '@/componentes/series/formulario-serie'
```

Agregar el estado, junto a los otros `useState`:

```tsx
  const [serieEn, setSerieEn] = useState<string | null>(null)
```

Reemplazar el botón "+ Turno" de cada día por los dos botones:

```tsx
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => setNuevoEn(fecha)}
                  className="flex-1 rounded border border-dashed border-zinc-300 py-1.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                >
                  + Turno
                </button>
                <button
                  onClick={() => setSerieEn(fecha)}
                  className="flex-1 rounded border border-dashed border-zinc-300 py-1.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                >
                  + Serie
                </button>
              </div>
```

Y agregar el diálogo, junto a los otros:

```tsx
      <Dialogo abierto={serieEn !== null} onCerrar={() => setSerieEn(null)} titulo="Nueva serie">
        {serieEn && (
          <FormularioSerie
            key={serieEn}
            pacientes={pacientes}
            fechaInicial={serieEn}
            duracionDefault={duracionDefault}
            onCreada={() => setSerieEn(null)}
          />
        )}
      </Dialogo>
```

- [ ] **Paso 4: Probar a mano**

Correr: `npm run dev`, entrar a `/agenda` con horarios cargados y al menos un paciente.

1. "+ Serie" en un lunes → María, martes, `15:00`, 50 min, semanal, 10 sesiones → "Ver vista previa" → aparecen 9 fechas (las que entran en 8 semanas), todas libres.
2. "Crear 9 sesiones" → el diálogo se cierra y los martes de la agenda se llenan.
3. Otra serie de Juan los martes `15:00` → vista previa con las 9 marcadas *"ya tenés otro turno"* y el botón de crear no aparece.
4. Serie de Juan los martes `16:00`, pero con una semana de vacaciones bloqueada en el medio → esa fecha aparece tachada con *"día bloqueado"* y el botón dice "Crear 8 sesiones".
5. Serie a las `21:00` → todas *"fuera de tu horario"*.
6. Marcar "Sin fecha de fin" → el campo de sesiones se deshabilita y la vista previa muestra 8 semanas.

- [ ] **Paso 5: Commit**

```bash
git add src/componentes/series src/componentes/agenda/agenda-semanal.tsx
git commit -m "feat: alta de serie con vista previa de las fechas que entran y las que chocan"
```

---

## Tarea 6: Migración 0008 — horizonte rodante

La serie indefinida es el caso normal en psicología: el paciente viene hace tres años y no hay una fecha de fin. Materializar hasta el infinito no tiene sentido, así que se materializan 8 semanas y un job diario las va empujando.

`materializar_serie` **solo agrega hacia adelante**, nunca rellena huecos anteriores al último turno de la serie. Es a propósito: un hueco en el pasado suele ser un turno que el profesional movió o canceló, y volver a crearlo sería deshacerle el trabajo.

**Archivos:**
- Crear: `supabase/migrations/0008_materializar_y_extender.sql`
- Modificar: `tests/integration/series.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0008_materializar_y_extender.sql`:

```sql
/**
 * Extiende una serie hasta `p_hasta`, salteando lo que choca. Devuelve cuántos
 * turnos creó.
 *
 * security definer porque la llama pg_cron, que corre sin sesión y por lo tanto
 * sin auth.uid(). El EXECUTE se revoca de PUBLIC justo abajo: nadie la puede
 * llamar desde la API con el id de la serie de otro.
 */
create or replace function public.materializar_serie(p_serie_id uuid, p_hasta date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s         public.series;
  v_ultima  date;
  v_fecha   date;
  v_inicio  timestamptz;
  v_fin     timestamptz;
  v_creadas integer := 0;
begin
  select * into s from public.series where id = p_serie_id;
  if not found or s.estado <> 'activa' then
    return 0;
  end if;

  -- Nunca se rellena hacia atrás: un hueco anterior al último turno suele ser
  -- una cancelación o una mudanza hecha a mano.
  select coalesce(
           max((lower(a.periodo) at time zone 'America/Argentina/Buenos_Aires')::date),
           s.desde - 1
         )
    into v_ultima
    from public.appointments a
   where a.series_id = s.id;

  for v_fecha in
    select * from public.generar_ocurrencias(
      s.desde, s.dia_semana, s.frecuencia, s.sesiones_totales, p_hasta
    )
  loop
    continue when v_fecha <= v_ultima;

    v_inicio := (v_fecha::text || ' ' || s.hora_local::text)::timestamp
                  at time zone 'America/Argentina/Buenos_Aires';
    v_fin := v_inicio + (s.duracion_min || ' minutes')::interval;

    continue when exists (
      select 1 from public.appointments a
       where a.professional_id = s.professional_id
         and a.estado <> 'cancelado'
         and a.periodo && tstzrange(v_inicio, v_fin, '[)')
    );

    continue when exists (
      select 1 from public.blocks b
       where b.professional_id = s.professional_id
         and b.periodo && tstzrange(v_inicio, v_fin, '[)')
    );

    insert into public.appointments (professional_id, patient_id, series_id, periodo)
    values (s.professional_id, s.patient_id, s.id, tstzrange(v_inicio, v_fin, '[)'));

    v_creadas := v_creadas + 1;
  end loop;

  update public.series
     set horizonte_hasta = greatest(horizonte_hasta, p_hasta)
   where id = p_serie_id;

  return v_creadas;
end;
$$;

revoke execute on function public.materializar_serie(uuid, date) from public, anon, authenticated;
grant execute on function public.materializar_serie(uuid, date) to service_role;

/** Empuja todas las series activas al horizonte de 8 semanas. La corre pg_cron. */
create or replace function public.extender_series()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_total integer := 0;
  v_hasta date := (now() at time zone 'America/Argentina/Buenos_Aires')::date + 56;
begin
  for r in select id from public.series where estado = 'activa' loop
    v_total := v_total + public.materializar_serie(r.id, v_hasta);
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.extender_series() from public, anon, authenticated;
grant execute on function public.extender_series() to service_role;

create extension if not exists pg_cron;

-- 06:00 UTC = 03:00 en Argentina.
select cron.schedule('extender-series', '0 6 * * *', $$select public.extender_series();$$);
```

**Si `create extension pg_cron` o `cron.schedule` fallan** por permisos: habilitar `pg_cron` desde el dashboard (Database → Extensions), y volver a aplicar solo el `cron.schedule`. En Supabase los jobs de cron corren únicamente sobre la base `postgres`.

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0008_materializar_y_extender", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Verificar que el job quedó agendado**

`mcp__claude_ai_Supabase__execute_sql`:

```sql
select jobname, schedule, active from cron.job where jobname = 'extender-series';
```

Esperado: una fila, `schedule = '0 6 * * *'`, `active = true`.

- [ ] **Paso 4: Agregar los tests del horizonte**

Al final de `tests/integration/series.test.ts`, dentro del mismo archivo pero como un `describe` nuevo:

```ts
describe('horizonte rodante', () => {
  let beto: ProfesionalDePrueba
  let juan: string
  let serieId: string

  beforeAll(async () => {
    beto = await crearProfesionalDePrueba()

    const { data: paciente, error } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Juan', telefono_e164: '+5492984555555' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    juan = paciente.id

    // Serie indefinida materializada a mano con solo dos turnos.
    const { data, error: errorSerie } = await beto.cliente.rpc('crear_serie', {
      p_patient_id: juan,
      p_dia_semana: 3,
      p_hora_local: '09:00',
      p_duracion_min: 30,
      p_frecuencia: 'semanal',
      p_sesiones_totales: null,
      p_desde: '2027-03-03',
      p_horizonte_hasta: '2027-03-10',
      p_inicios: [
        new Date('2027-03-03T09:00:00-03:00').toISOString(),
        new Date('2027-03-10T09:00:00-03:00').toISOString(),
      ],
    })
    if (errorSerie) throw new Error(errorSerie.message)
    serieId = data as unknown as string
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(beto)
  })

  it('un profesional NO puede llamar a materializar_serie', async () => {
    const { error } = await beto.cliente.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(error).not.toBeNull()
  })

  it('extiende la serie hasta el horizonte pedido', async () => {
    const { data: creadas, error } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(error).toBeNull()
    // Del 17/3 al 28/4 hay 7 miércoles.
    expect(creadas).toBe(7)
  })

  it('es idempotente: correrlo de nuevo no crea nada', async () => {
    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(creadas).toBe(0)
  })

  it('saltea las fechas que caen en un bloqueo', async () => {
    await beto.cliente.from('blocks').insert({
      professional_id: beto.id,
      periodo: `[${new Date('2027-05-05T00:00:00-03:00').toISOString()},${new Date('2027-05-06T00:00:00-03:00').toISOString()})`,
      motivo: 'Feriado',
    })

    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-05-12',
    })
    // 5/5 bloqueado: la única que entra es el 12/5.
    expect(creadas).toBe(1)

    const { count } = await beto.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', serieId)
      .filter(
        'periodo',
        'ov',
        `[${new Date('2027-05-05T00:00:00-03:00').toISOString()},${new Date('2027-05-06T00:00:00-03:00').toISOString()})`,
      )
    expect(count).toBe(0)
  })

  it('no toca una serie cancelada', async () => {
    await beto.cliente.from('series').update({ estado: 'cancelada' }).eq('id', serieId)

    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-06-30',
    })
    expect(creadas).toBe(0)
  })
})
```

- [ ] **Paso 5: Correr los tests**

Correr: `npm run test:integration -- series`
Esperado: PASA, 9 tests.

Si el test del bloqueo no da 1, imprimir las fechas materializadas con
`select lower(periodo) at time zone 'America/Argentina/Buenos_Aires' from appointments where series_id = '<id>' order by 1;`
y ajustar el número esperado a lo que efectivamente corresponde — el que está mal es el número del test, no la función, salvo que aparezca una fecha dentro del bloqueo.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/0008_materializar_y_extender.sql tests/integration/series.test.ts
git commit -m "feat: horizonte rodante de 8 semanas con job diario de pg_cron"
```

---

## Tarea 7: Migración 0009 — reprogramar de acá en adelante, y cancelar la serie

*"¿Solo este, o de acá en adelante?"* resuelve el 90% de los casos reales (§8): se enfermó una semana, contra cambió el horario para siempre. "Solo este" ya funciona desde 1a — es `guardarTurno` moviendo una fila. Lo que falta es el otro.

"De acá en adelante" **parte la serie en dos**: la vieja se finaliza el día anterior y se crea una nueva con el horario nuevo. Es lo que permite que el historial de lo que ya pasó quede intacto, con su día y hora reales.

**Archivos:**
- Crear: `supabase/migrations/0009_reprogramar_y_cancelar.sql`
- Modificar: `tests/integration/series.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0009_reprogramar_y_cancelar.sql`:

```sql
/**
 * Corta la serie en el turno indicado y la vuelve a armar con día y hora nuevos.
 *
 * Los turnos con historia (asistio, ausente, cancelado) no se tocan nunca: son
 * el registro de lo que efectivamente pasó.
 *
 * security definer porque necesita llamar a materializar_serie, cuyo EXECUTE
 * está revocado. La pertenencia se verifica a mano contra auth.uid().
 */
create or replace function public.reprogramar_serie_desde(
  p_appointment_id   uuid,
  p_nuevo_dia_semana smallint,
  p_nueva_hora       time,
  p_desde            date
)
returns table (serie_nueva_id uuid, creadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  a           public.appointments;
  s           public.series;
  v_restantes integer;
  v_nueva     uuid;
  v_creadas   integer;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  select * into a from public.appointments where id = p_appointment_id;
  if not found or a.professional_id <> auth.uid() then
    raise exception 'ese turno no es tuyo';
  end if;
  if a.series_id is null then
    raise exception 'ese turno no pertenece a una serie';
  end if;

  select * into s from public.series where id = a.series_id;

  delete from public.appointments
   where series_id = s.id
     and estado in ('programado', 'confirmado')
     and lower(periodo) >= lower(a.periodo);

  if s.sesiones_totales is not null then
    select greatest(s.sesiones_totales - count(*), 1)
      into v_restantes
      from public.appointments
     where series_id = s.id;
  else
    v_restantes := null;
  end if;

  update public.series
     set estado = 'finalizada',
         horizonte_hasta = p_desde - 1
   where id = s.id;

  insert into public.series (
    professional_id, patient_id, dia_semana, hora_local, duracion_min,
    frecuencia, sesiones_totales, desde, horizonte_hasta
  )
  values (
    s.professional_id, s.patient_id, p_nuevo_dia_semana, p_nueva_hora, s.duracion_min,
    s.frecuencia, v_restantes, p_desde, p_desde - 1
  )
  returning id into v_nueva;

  v_creadas := public.materializar_serie(v_nueva, p_desde + 56);

  return query select v_nueva, v_creadas;
end;
$$;

/**
 * Cancela los turnos futuros de una serie y la da de baja. Los pasados quedan
 * como están: son historial de asistencia.
 */
create or replace function public.cancelar_serie(p_serie_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cancelados integer;
begin
  update public.appointments
     set estado = 'cancelado', cancelado_por = 'profesional'
   where series_id = p_serie_id
     and estado in ('programado', 'confirmado')
     and lower(periodo) >= now();

  get diagnostics v_cancelados = row_count;

  update public.series set estado = 'cancelada' where id = p_serie_id;

  return v_cancelados;
end;
$$;
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0009_reprogramar_y_cancelar", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Agregar los tests**

Al final de `tests/integration/series.test.ts`:

```ts
describe('reprogramar de acá en adelante y cancelar serie', () => {
  let carla: ProfesionalDePrueba
  let otro: ProfesionalDePrueba
  let paciente: string
  let serieId: string
  let turnos: { id: string; periodo: string }[]

  beforeAll(async () => {
    carla = await crearProfesionalDePrueba()
    otro = await crearProfesionalDePrueba()

    const { data: p, error } = await carla.cliente
      .from('patients')
      .insert({ professional_id: carla.id, nombre: 'Sofía', telefono_e164: '+5492984777777' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    paciente = p.id

    // Cuatro jueves de 2028, 10:00.
    const fechas = ['2028-03-02', '2028-03-09', '2028-03-16', '2028-03-23']
    const { data: id, error: e } = await carla.cliente.rpc('crear_serie', {
      p_patient_id: paciente,
      p_dia_semana: 4,
      p_hora_local: '10:00',
      p_duracion_min: 50,
      p_frecuencia: 'semanal',
      p_sesiones_totales: 4,
      p_desde: '2028-03-02',
      p_horizonte_hasta: '2028-03-23',
      p_inicios: fechas.map((f) => new Date(`${f}T10:00:00-03:00`).toISOString()),
    })
    if (e) throw new Error(e.message)
    serieId = id as unknown as string

    const { data: creados } = await carla.cliente
      .from('appointments')
      .select('id, periodo')
      .eq('series_id', serieId)
      .order('periodo')
    turnos = (creados ?? []) as { id: string; periodo: string }[]
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(carla)
    await borrarProfesionalDePrueba(otro)
  })

  it('otro profesional NO puede reprogramar una serie ajena', async () => {
    const { error } = await otro.cliente.rpc('reprogramar_serie_desde', {
      p_appointment_id: turnos[0].id,
      p_nuevo_dia_semana: 2,
      p_nueva_hora: '18:00',
      p_desde: '2028-03-14',
    })
    expect(error).not.toBeNull()
  })

  it('marca el primer turno como asistido y ese no se toca nunca más', async () => {
    await carla.cliente.from('appointments').update({ estado: 'asistio' }).eq('id', turnos[0].id)

    const { error } = await carla.cliente.rpc('reprogramar_serie_desde', {
      p_appointment_id: turnos[1].id,
      p_nuevo_dia_semana: 2, // martes
      p_nueva_hora: '18:00',
      p_desde: '2028-03-14',
    })
    expect(error).toBeNull()

    const { data: viejo } = await carla.cliente
      .from('appointments')
      .select('estado')
      .eq('id', turnos[0].id)
      .single()
    expect(viejo?.estado).toBe('asistio')
  })

  it('la serie vieja queda finalizada', async () => {
    const { data } = await carla.cliente.from('series').select('estado').eq('id', serieId).single()
    expect(data?.estado).toBe('finalizada')
  })

  it('los turnos futuros pasan al día y la hora nuevos', async () => {
    const { data } = await carla.cliente
      .from('series')
      .select('id, dia_semana, hora_local, sesiones_totales')
      .eq('estado', 'activa')
      .eq('professional_id', carla.id)
      .single()

    expect(data?.dia_semana).toBe(2)
    expect(String(data?.hora_local).slice(0, 5)).toBe('18:00')
    // Quedaba una sesión consumida (la que asistió): restan 3.
    expect(data?.sesiones_totales).toBe(3)

    const { count } = await carla.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', data!.id)
    expect(count).toBe(3)
  })

  it('cancelar_serie cancela los futuros y marca la serie', async () => {
    const { data: activa } = await carla.cliente
      .from('series')
      .select('id')
      .eq('estado', 'activa')
      .eq('professional_id', carla.id)
      .single()

    const { data: cancelados, error } = await carla.cliente.rpc('cancelar_serie', {
      p_serie_id: activa!.id,
    })
    expect(error).toBeNull()
    expect(cancelados).toBe(3)

    const { data: serie } = await carla.cliente
      .from('series')
      .select('estado')
      .eq('id', activa!.id)
      .single()
    expect(serie?.estado).toBe('cancelada')
  })

  it('el turno asistido sigue intacto después de cancelar la serie', async () => {
    const { data } = await carla.cliente
      .from('appointments')
      .select('estado')
      .eq('id', turnos[0].id)
      .single()
    expect(data?.estado).toBe('asistio')
  })
})
```

- [ ] **Paso 4: Correr los tests**

Correr: `npm run test:integration -- series`
Esperado: PASA, 15 tests.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0009_reprogramar_y_cancelar.sql tests/integration/series.test.ts
git commit -m "feat: reprogramar una serie de acá en adelante y darla de baja"
```

---

## Tarea 8: La pregunta — "¿solo este, o de acá en adelante?"

**Archivos:**
- Crear: `src/componentes/agenda/dialogo-reprogramar.tsx`
- Modificar: `src/componentes/agenda/agenda-semanal.tsx`

- [ ] **Paso 1: Escribir el diálogo**

`src/componentes/agenda/dialogo-reprogramar.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import { reprogramarDesde } from '@/acciones/series'
import { Boton } from '@/componentes/ui/boton'
import { FormularioTurno } from './formulario-turno'
import type { Paciente } from '@/tipos/db'

type EstadoReprogramar = { error?: string; ok?: boolean; creadas?: number }

export type TurnoAReprogramar = {
  id: string
  patient_id: string
  fecha: string
  hora: string
  duracion_min: number
}

const CLASE_CAMPO = 'block w-full min-h-11 rounded-lg border border-zinc-300 px-3 text-base'

export function DialogoReprogramar({
  turno,
  pacientes,
  onListo,
}: {
  turno: TurnoAReprogramar
  pacientes: Paciente[]
  onListo: () => void
}) {
  const [alcance, setAlcance] = useState<'preguntar' | 'solo_este' | 'en_adelante'>('preguntar')
  const [estado, accion, pendiente] = useActionState<EstadoReprogramar, FormData>(
    reprogramarDesde,
    {},
  )

  useEffect(() => {
    if (estado.ok) onListo()
  }, [estado.ok, onListo])

  if (alcance === 'preguntar') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600">
          Este turno es parte de una serie. ¿Qué querés cambiar?
        </p>
        <Boton variante="secundario" className="w-full" onClick={() => setAlcance('solo_este')}>
          Solo este turno
        </Boton>
        <Boton variante="secundario" className="w-full" onClick={() => setAlcance('en_adelante')}>
          Este y todos los que siguen
        </Boton>
        <p className="text-xs text-zinc-500">
          &quot;Solo este&quot; para cuando se enfermó una semana. &quot;Todos los que
          siguen&quot; para cuando cambió el horario para siempre.
        </p>
      </div>
    )
  }

  if (alcance === 'solo_este') {
    return (
      <FormularioTurno
        turno={{
          id: turno.id,
          patient_id: turno.patient_id,
          fecha: turno.fecha,
          hora: turno.hora,
          duracion_min: turno.duracion_min,
        }}
        pacientes={pacientes}
        onGuardado={onListo}
      />
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="appointment_id" value={turno.id} />

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Nueva fecha</span>
          <input type="date" name="fecha" defaultValue={turno.fecha} required className={CLASE_CAMPO} />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Hora</span>
          <input type="time" name="hora" step={300} defaultValue={turno.hora} required className={CLASE_CAMPO} />
        </label>
      </div>

      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        Los turnos de esta serie que ya pasaron no se tocan. Los que vienen se rehacen con el día
        y la hora nuevos, salteando los que choquen con otro turno o con un bloqueo.
      </p>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex justify-between">
        <Boton variante="secundario" type="button" onClick={() => setAlcance('preguntar')}>
          Volver
        </Boton>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Reprogramando…' : 'Reprogramar la serie'}
        </Boton>
      </div>
    </form>
  )
}
```

**El día de la semana nuevo sale de la fecha elegida**, no se pide aparte: lo calcula `reprogramarDesde` en el servidor. Un campo menos en una pantalla que el profesional usa apurado.

- [ ] **Paso 2: Enganchar la pregunta en la agenda**

En `src/componentes/agenda/agenda-semanal.tsx`:

Agregar el import:

```tsx
import { DialogoReprogramar } from './dialogo-reprogramar'
import { cancelarSerie } from '@/acciones/series'
```

Agregar `series_id` al tipo de la vista y al mapeo. En `type TurnoDeVista`, después de `patient_id`:

```tsx
  series_id: string | null
```

Y en `aVista`, dentro del objeto que devuelve, después de `patient_id: t.patient_id,`:

```tsx
    series_id: t.series_id,
```

Agregar el estado del nuevo diálogo, junto a los otros `useState`:

```tsx
  const [reprogramando, setReprogramando] = useState<TurnoDeVista | null>(null)
```

Marcar visualmente los turnos de una serie. En el `<button>` de cada turno, después del nombre del paciente:

```tsx
                      {t.series_id && <span className="ml-1 text-xs opacity-60">↻</span>}
```

Cambiar el botón "Mover" del diálogo de detalle para que pregunte cuando hay serie:

```tsx
                <Boton
                  variante="secundario"
                  className="w-full"
                  onClick={() => {
                    if (abierto.series_id) setReprogramando(abierto)
                    else setMoviendo(abierto)
                    setAbierto(null)
                  }}
                >
                  Mover
                </Boton>
```

Y agregar, dentro del mismo bloque de acciones del diálogo de detalle, debajo del botón de cancelar turno:

```tsx
                {abierto.series_id && (
                  <form action={cancelarSerie} onSubmit={() => setAbierto(null)}>
                    <input type="hidden" name="serie_id" value={abierto.series_id} />
                    <Boton type="submit" variante="peligro" className="w-full">
                      Dar de baja toda la serie
                    </Boton>
                  </form>
                )}
```

Finalmente, agregar el diálogo junto a los otros:

```tsx
      <Dialogo
        abierto={reprogramando !== null}
        onCerrar={() => setReprogramando(null)}
        titulo="Mover turno de una serie"
      >
        {reprogramando && (
          <DialogoReprogramar
            key={reprogramando.id}
            turno={{
              id: reprogramando.id,
              patient_id: reprogramando.patient_id,
              fecha: reprogramando.fecha,
              hora: reprogramando.hora,
              duracion_min: reprogramando.duracion_min,
            }}
            pacientes={pacientes}
            onListo={() => setReprogramando(null)}
          />
        )}
      </Dialogo>
```

- [ ] **Paso 3: Verificar que compila**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`.

- [ ] **Paso 4: Probar a mano**

Correr: `npm run dev` y entrar a `/agenda` con una serie ya creada.

1. Los turnos de la serie muestran el `↻`.
2. Click en el tercer turno de la serie → "Mover" → aparece la pregunta con las dos opciones.
3. "Solo este turno" → cambiarlo al viernes → se mueve solo ése; los otros siguen en su día.
4. Click en el cuarto → "Mover" → "Este y todos los que siguen" → cambiar a otro día y hora → ése y los siguientes se mudan; los anteriores no.
5. Marcar un turno pasado como "Asistió", después reprogramar de ahí en adelante → el asistido queda intacto.
6. Click en cualquier turno de la serie → "Dar de baja toda la serie" → los futuros quedan tachados, los pasados no.

- [ ] **Paso 5: Commit**

```bash
git add src/componentes/agenda
git commit -m "feat: reprogramar preguntando si es solo este turno o de acá en adelante"
```

---

## Tarea 9: La pantalla del día

**Es prioridad de producto, no un detalle de implementación** (§8). La investigación de competencia encontró que la debilidad documentada de los grandes está justo acá: de reviews de AgendaPro, *"la versión que tienen disponibles para los teléfonos celulares no funciona muy bien, se queda cargando"*. Si esta pantalla es impecable en un teléfono, ya se ganó la comparación en el lugar donde el profesional vive.

Se abre diez veces por jornada, entre paciente y paciente, con una mano.

**Archivos:**
- Crear: `src/componentes/dia/pantalla-del-dia.tsx`, `src/app/(app)/hoy/page.tsx`
- Modificar: `src/app/(app)/layout.tsx`

- [ ] **Paso 1: Escribir la pantalla**

`src/componentes/dia/pantalla-del-dia.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { marcarAsistencia } from '@/acciones/turnos'
import { formatearTelefonoParaMostrar } from '@/lib/telefono'
import { parsearTstzrange, utcALocal, sumarDias } from '@/lib/tiempo'
import type { EstadoTurno, TurnoConPaciente } from '@/tipos/db'

const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  programado: '',
  confirmado: 'confirmó',
  cancelado: 'cancelado',
  asistio: 'asistió',
  ausente: 'no vino',
}

const COLOR_ESTADO: Record<EstadoTurno, string> = {
  programado: 'border-zinc-200',
  confirmado: 'border-green-300 bg-green-50',
  cancelado: 'border-zinc-200 bg-zinc-50 opacity-60',
  asistio: 'border-blue-300 bg-blue-50',
  ausente: 'border-red-300 bg-red-50',
}

export function PantallaDelDia({ fecha, turnos }: { fecha: string; turnos: TurnoConPaciente[] }) {
  const items = turnos
    .map((t) => {
      const { inicio, fin } = parsearTstzrange(t.periodo)
      return {
        id: t.id,
        hora: utcALocal(inicio).hora,
        hasta: utcALocal(fin).hora,
        nombre: t.patients?.nombre ?? 'Paciente',
        telefono: t.patients?.telefono_e164 ?? '',
        estado: t.estado,
        deSerie: t.series_id !== null,
      }
    })
    .sort((a, b) => (a.hora < b.hora ? -1 : 1))

  const pendientes = items.filter((i) => i.estado === 'programado' || i.estado === 'confirmado')

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/hoy?fecha=${sumarDias(fecha, -1)}`}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          aria-label="Día anterior"
        >
          ←
        </Link>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold">{fecha}</h1>
          <p className="text-sm text-zinc-500">
            {items.length === 0
              ? 'Sin turnos'
              : `${items.length} turno${items.length === 1 ? '' : 's'} · ${pendientes.length} sin marcar`}
          </p>
        </div>
        <Link
          href={`/hoy?fecha=${sumarDias(fecha, 1)}`}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          aria-label="Día siguiente"
        >
          →
        </Link>
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No tenés turnos este día.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t.id} className={`rounded-xl border p-4 ${COLOR_ESTADO[t.estado]}`}>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{t.hora}</span>
              <span className="text-sm text-zinc-500">a {t.hasta}</span>
              {t.deSerie && <span className="text-sm text-zinc-400">↻</span>}
              {ETIQUETA_ESTADO[t.estado] && (
                <span className="ml-auto text-sm font-medium">{ETIQUETA_ESTADO[t.estado]}</span>
              )}
            </div>

            <p className="text-lg font-medium">{t.nombre}</p>
            {t.telefono && (
              <a href={`tel:${t.telefono}`} className="text-sm text-zinc-600 underline">
                {formatearTelefonoParaMostrar(t.telefono)}
              </a>
            )}

            {(t.estado === 'programado' || t.estado === 'confirmado') && (
              <div className="mt-4 flex gap-2">
                <form action={marcarAsistencia} className="flex-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="estado" value="asistio" />
                  <button
                    type="submit"
                    className="min-h-14 w-full rounded-lg bg-zinc-900 text-base font-medium text-white"
                  >
                    Asistió
                  </button>
                </form>
                <form action={marcarAsistencia} className="flex-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="estado" value="ausente" />
                  <button
                    type="submit"
                    className="min-h-14 w-full rounded-lg border border-zinc-300 bg-white text-base font-medium"
                  >
                    No vino
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Los botones miden 56px de alto** (`min-h-14`) porque se aprietan con el pulgar, parado, entre dos pacientes. El teléfono es un link `tel:` por lo mismo: si el paciente no llegó, el profesional lo llama desde ahí.

- [ ] **Paso 2: Escribir la página**

`src/app/(app)/hoy/page.tsx`:

```tsx
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PantallaDelDia } from '@/componentes/dia/pantalla-del-dia'
import { aTstzrange, hoyLocal, localAUtc, sumarDias } from '@/lib/tiempo'
import type { TurnoConPaciente } from '@/tipos/db'

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha: fechaCruda } = await searchParams
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaCruda ?? '') ? fechaCruda! : hoyLocal()

  const desde = localAUtc(fecha, '00:00')
  const hasta = localAUtc(sumarDias(fecha, 1), '00:00')

  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('appointments')
    .select('*, patients(nombre, telefono_e164)')
    .filter('periodo', 'ov', aTstzrange(desde, hasta))

  return <PantallaDelDia fecha={fecha} turnos={(data ?? []) as TurnoConPaciente[]} />
}
```

- [ ] **Paso 3: Poner "Hoy" primero en la navegación**

En `src/app/(app)/layout.tsx`, reemplazar la constante:

```tsx
const NAVEGACION = [
  { href: '/hoy', texto: 'Hoy' },
  { href: '/agenda', texto: 'Agenda' },
  { href: '/pacientes', texto: 'Pacientes' },
  { href: '/configuracion', texto: 'Configuración' },
]
```

Y en `src/lib/supabase/middleware.ts`, cambiar el destino de la redirección de quien ya tiene sesión, para que entre por la pantalla que usa todos los días:

```ts
  if (user && (esPublica || ruta === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/hoy'
    return NextResponse.redirect(url)
  }
```

Cambiar también los tres `redirect('/agenda')` de `src/app/(auth)/acciones.ts` por `redirect('/hoy')` — son dos, en `registrarse` y en `iniciarSesion`.

- [ ] **Paso 4: Probar a mano, en un teléfono de verdad**

Correr: `npm run dev -- -H 0.0.0.0` y abrir `http://<ip-de-la-compu>:3000/hoy` desde el celular, en la misma red.

1. Los turnos de hoy aparecen ordenados por hora, con la hora bien grande.
2. Apretar "Asistió" con el pulgar, sin hacer zoom → la tarjeta cambia de color y el contador de "sin marcar" baja.
3. Apretar "No vino" en otro → queda en rojo.
4. Tocar el teléfono de un paciente → abre el marcador del celular.
5. Las flechas mueven al día anterior y siguiente.
6. Un día sin turnos muestra el mensaje vacío, no una pantalla en blanco.
7. Nada de scroll horizontal en ningún ancho.

- [ ] **Paso 5: Commit**

```bash
git add src/componentes/dia src/app/\(app\)/hoy src/app/\(app\)/layout.tsx src/lib/supabase/middleware.ts src/app/\(auth\)/acciones.ts
git commit -m "feat: pantalla del día para celular con botones grandes de asistencia"
```

---

## Tarea 10: Cierre de la Etapa 1

**Archivos:**
- Modificar: `README.md`
- Crear: `docs/superpowers/checklists/2026-08-24-humo-etapa-1b.md`

- [ ] **Paso 1: Actualizar el README**

En `README.md`, reemplazar la sección `## Estado` por:

```markdown
## Estado

Etapa 1 completa: auth, tenancy con RLS, pacientes, horarios, bloqueos, turnos sueltos, agenda
semanal, series recurrentes con horizonte rodante, reprogramación "solo este / de acá en
adelante" y pantalla del día para celular. **Sin WhatsApp** — eso es la Etapa 2.
```

Y agregar al final, en `## Decisiones que no se ven en el código`:

```markdown
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
```

- [ ] **Paso 2: Escribir la checklist de humo**

`docs/superpowers/checklists/2026-08-24-humo-etapa-1b.md`:

```markdown
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
- [ ] `select jobname, active from cron.job where jobname = 'extender-series';` → activa
- [ ] Correr `select public.extender_series();` a mano → devuelve un número sin error
- [ ] Una serie indefinida creada hoy tiene turnos hasta ~8 semanas adelante
```

- [ ] **Paso 3: Correr todo antes de cerrar**

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

Esperado: los cuatro en verde. 62 tests unitarios, 50 de integración (23 de 1a + 12 de ocurrencias + 15 de series), sin errores de lint, build exitoso.

**No declarar la etapa terminada sin haber visto esas cuatro salidas.**

- [ ] **Paso 4: Revisar los avisos de seguridad de Supabase**

`mcp__claude_ai_Supabase__get_advisors` con `{ "project_id": "<PROJECT_ID>", "type": "security" }`.

Esperado: ningún `rls_disabled_in_public`. Si aparece un aviso sobre funciones `security definer`, verificar que sean exactamente `materializar_serie`, `extender_series`, `reprogramar_serie_desde` y `handle_new_user`, y que las tres primeras tengan el `EXECUTE` revocado de `public` o el chequeo de `auth.uid()` adentro. Cualquier otra función `definer` es un problema.

- [ ] **Paso 5: Recorrer las dos checklists de humo**

La de 1a y la de 1b, enteras, a mano.

- [ ] **Paso 6: Commit final**

```bash
git add README.md docs/superpowers/checklists/
git commit -m "docs: cierre de la Etapa 1 — README y checklist de humo de 1b"
```

- [ ] **Paso 7: Sentarse con un profesional de General Roca**

El diseño (§12) dice que al terminar la Etapa 1 un profesional ya puede usar esto como agenda.
Antes de arrancar la Etapa 2: cargarle los horarios reales, sus pacientes y sus series a alguien
de verdad, y mirar dónde se traba. Especialmente el alta de serie —que tiene que salir en menos
de 30 segundos— y la pantalla del día en su propio teléfono.

Lo que aparezca ahí manda sobre lo que diga el plan de la Etapa 2.

---

## Qué queda para la Etapa 2

Del §12 del diseño, y con dos validaciones pendientes del §11 que hay que cerrar **antes** de
escribir ese plan, porque cambian el modelo de negocio si dan mal:

- **Tarifas vigentes de plantillas utility de WhatsApp en Argentina.** Si el costo por mensaje
  no cierra contra un precio plano en pesos, se cae el diferencial número uno.
- **Requisitos de Embedded Signup y verificación de Meta.**
- Después sí: outbox, despachador con `pg_cron`, plantilla con botones, webhook con validación
  de firma, chequeo diario de salud de la conexión y avisos de falla.
