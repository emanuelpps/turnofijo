# Turno Fijo — Etapa 1a: Agenda base — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para el seguimiento.

**Objetivo:** Dejar funcionando la base de Turno Fijo — proyecto Next.js, autenticación, multi-tenancy con RLS, pacientes, horarios de atención, bloqueos y turnos sueltos con agenda semanal — de modo que un profesional pueda reemplazar su agenda de papel, sin WhatsApp y sin series todavía.

**Arquitectura:** Next.js 16 (App Router, Server Actions) sobre Supabase remoto (Auth + Postgres con RLS). Un profesional = un tenant = un usuario: `professionals.id = auth.uid()` y toda tabla lleva `professional_id` con política RLS `professional_id = auth.uid()`. Las dos garantías que no pueden depender del código —no superponer turnos, no cruzar datos entre profesionales— viven en el esquema (restricción `EXCLUDE USING gist` y RLS). La lógica de calendario (zona horaria, horarios de atención, solapamiento) es TypeScript puro sin dependencias, testeada con Vitest antes de tocar la base.

**Stack:** Next.js 16.2.6 · React 19.2.4 · TypeScript 5 · Tailwind CSS 4 · Supabase (`@supabase/ssr`) · Zod 4 · Vitest 3.

**Referencia de diseño:** `docs/superpowers/specs/2026-08-19-turnofijo-design.md` (§3, §5, §8, §10, §12 Etapa 1).

---

## Alcance

**Entra en 1a:**
- Scaffolding del proyecto y repositorio git
- Lógica pura de calendario: zona horaria, horarios de atención, solapamiento, validación de turno
- Normalización de teléfonos argentinos a E.164
- Auth (registro, login, logout) y rutas protegidas
- Tenancy con RLS verificada por test de integración real, con dos usuarios distintos
- Pacientes (contacto, sin campos clínicos)
- Horarios de atención, duración por defecto y bloqueos (vacaciones/feriados/ausencias)
- Turnos sueltos: crear, mover, cancelar, marcar asistió/ausente
- Agenda semanal de escritorio

**No entra en 1a — va al plan 1b:**
- Series recurrentes materializadas y horizonte rodante
- Reprogramación con la pregunta "¿solo este o de acá en adelante?"
- Pantalla del día optimizada para celular

**No entra en la Etapa 1 (§3 del diseño):** WhatsApp, recordatorios, bandeja, matcher, cobros, notas clínicas, multi-profesional, obras sociales.

---

## Prerequisitos y avisos antes de empezar

1. **Node 24 y npm 11 ya están instalados.** Verificado: `node v24.11.1`, `npm 11.6.2`.
2. **No hay Docker ni Supabase CLI** en esta máquina y no se van a instalar. Todo Postgres es el proyecto Supabase remoto de desarrollo que crea la Tarea 5. Las migraciones se versionan como archivos SQL en `supabase/migrations/` y se aplican con la herramienta MCP `mcp__claude_ai_Supabase__apply_migration`.
3. **Límite de proyectos de Supabase.** La organización `psakzaxefzplduqsaxfl` ya tiene dos proyectos (`importflow` y `epic-sound-studio`, ambos `INACTIVE`). El plan gratuito permite dos proyectos activos. Si `create_project` falla por límite, la Tarea 5 tiene el procedimiento de desbloqueo. **No borrar `importflow` sin preguntarle al usuario.**
4. **Claves que hay que copiar a mano.** La URL y la clave publicable se obtienen por MCP. La clave secreta (`service_role`) **no** se expone por MCP: hay que copiarla del dashboard (Project Settings → API Keys). Se usa solo en `.env.test.local`, nunca en el código de la app.
5. **Directorio de trabajo:** `C:\Users\emanu\OneDrive\Escritorio\Proyectos Claude\turnofijo`. Ya existe y contiene `docs/`. El scaffolding se agrega adentro, no en un subdirectorio nuevo.

---

## Estructura de archivos

```
turnofijo/
├── package.json                       scripts: dev, build, lint, test, test:integration
├── tsconfig.json                      strict, alias @/* → src/*
├── next.config.ts
├── postcss.config.mjs                 Tailwind 4
├── eslint.config.mjs
├── vitest.config.ts                   dos proyectos: unit (sin red) e integration (Supabase real)
├── .env.local.example                 plantilla versionada; .env.local NO se versiona
├── .gitignore
├── README.md
├── supabase/migrations/
│   ├── 0001_professionals.sql         btree_gist, professionals, RLS, trigger de alta
│   ├── 0002_patients.sql              patients, RLS, unicidad (id, professional_id)
│   ├── 0003_working_hours_blocks.sql  working_hours, blocks, RLS
│   └── 0004_appointments.sql          appointments, enums, EXCLUDE gist, FK compuesta
├── src/
│   ├── middleware.ts                  refresco de sesión + protección de rutas
│   ├── app/
│   │   ├── layout.tsx                 layout raíz, es-AR
│   │   ├── globals.css                Tailwind 4
│   │   ├── page.tsx                   redirige a /agenda o /login
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/registro/page.tsx
│   │   ├── (auth)/acciones.ts         server actions de auth
│   │   └── (app)/
│   │       ├── layout.tsx             navegación + guarda de sesión
│   │       ├── agenda/page.tsx        agenda semanal (escritorio)
│   │       ├── pacientes/page.tsx
│   │       └── configuracion/page.tsx horarios, duración default, bloqueos
│   ├── componentes/
│   │   ├── ui/boton.tsx
│   │   ├── ui/campo.tsx               input + label + error
│   │   ├── ui/dialogo.tsx             <dialog> nativo, sin dependencias
│   │   ├── pacientes/                 formulario y lista
│   │   ├── configuracion/             horarios y bloqueos
│   │   └── agenda/                    grilla semanal y formulario de turno
│   ├── lib/
│   │   ├── tiempo.ts                  PURO — UTC ↔ hora local −03
│   │   ├── telefono.ts                PURO — normalización a E.164 argentino
│   │   ├── horarios.ts                PURO — ¿entra en el horario de atención?
│   │   ├── solapamiento.ts            PURO — intersección de períodos [inicio, fin)
│   │   ├── validar-turno.ts           PURO — compone las tres anteriores
│   │   └── supabase/
│   │       ├── servidor.ts            cliente de server components / actions
│   │       └── middleware.ts          cliente de middleware
│   ├── acciones/
│   │   ├── pacientes.ts               server actions
│   │   ├── configuracion.ts           server actions
│   │   └── turnos.ts                  server actions
│   └── tipos/db.ts                    tipos generados de la base
└── tests/
    ├── unit/                          tiempo, telefono, horarios, solapamiento, validar-turno
    └── integration/                   RLS y garantías del esquema contra Supabase real
        ├── setup.ts
        └── ayudantes.ts               alta y limpieza de dos profesionales de prueba
```

**Por qué así.** Los cinco módulos de `src/lib/*.ts` son funciones puras sin imports del framework ni de Supabase: son lo único que el diseño (§10) manda testear en serio, y aislarlos hace que ese testing no necesite ni red ni base. Las server actions viven en `src/acciones/` separadas de los componentes porque tres pantallas distintas comparten las mismas operaciones sobre turnos.

---

## Tarea 1: Scaffolding del proyecto y repositorio

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

No se usa `create-next-app`: el directorio ya tiene `docs/` y el instalador es interactivo. Se escriben los archivos a mano y se instala.

- [ ] **Paso 1: Inicializar el repositorio**

```bash
cd "C:/Users/emanu/OneDrive/Escritorio/Proyectos Claude/turnofijo"
git init
git branch -M main
```

- [ ] **Paso 2: Escribir `package.json`**

```json
{
  "name": "turnofijo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run --project unit",
    "test:watch": "vitest --project unit",
    "test:integration": "vitest run --project integration"
  },
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.2",
    "clsx": "^2.1.1",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwind-merge": "^3.6.0",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv": "^17.2.3",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Paso 3: Escribir los archivos de configuración**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

`eslint.config.mjs`:

```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['.next/**', 'node_modules/**'] },
]

export default eslintConfig
```

`.gitignore`:

```
node_modules/
.next/
out/
build/
.env
.env.local
.env.test.local
.DS_Store
*.pem
npm-debug.log*
.vercel
next-env.d.ts
coverage/
```

- [ ] **Paso 4: Escribir el layout raíz y los estilos**

`src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --fondo: #ffffff;
  --texto: #18181b;
}

html {
  color-scheme: light;
}

body {
  background: var(--fondo);
  color: var(--texto);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Turno Fijo',
  description: 'Agenda de turnos para profesionales que trabajan con sesiones recurrentes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/agenda')
}
```

- [ ] **Paso 5: Instalar dependencias**

Correr: `npm install`
Esperado: termina sin errores y crea `node_modules/` y `package-lock.json`.

- [ ] **Paso 6: Verificar que compila**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`. La ruta `/` va a aparecer en el listado. Si `next build` se queja de que falta `next-env.d.ts`, lo genera solo en la primera corrida; volver a correr.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "chore: scaffolding de Next.js 16 con Tailwind 4 y TypeScript"
```

---

## Tarea 2: Lógica de tiempo (TDD)

Todo se guarda en UTC y se muestra en −03. Argentina no tiene horario de verano, así que el offset es fijo y no hace falta ninguna librería de zonas horarias. Este módulo es la única puerta entre "hora que escribe el profesional" y "instante que guarda Postgres"; si tiene un bug, todos los turnos quedan corridos.

**Archivos:**
- Crear: `vitest.config.ts`
- Crear: `src/lib/tiempo.ts`
- Test: `tests/unit/tiempo.test.ts`

- [ ] **Paso 1: Escribir `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
})
```

- [ ] **Paso 2: Escribir el test que falla**

`tests/unit/tiempo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  localAUtc,
  utcALocal,
  minutosLocales,
  diaSemanaLocal,
  sumarMinutos,
  aTstzrange,
  parsearTstzrange,
} from '../../src/lib/tiempo'

describe('localAUtc', () => {
  it('convierte hora local argentina a UTC sumando 3 horas', () => {
    expect(localAUtc('2026-08-24', '15:00').toISOString()).toBe('2026-08-24T18:00:00.000Z')
  })

  it('cruza al día siguiente en UTC cuando la hora local es tarde', () => {
    expect(localAUtc('2026-08-24', '22:30').toISOString()).toBe('2026-08-25T01:30:00.000Z')
  })

  it('no aplica horario de verano en enero (Argentina no tiene)', () => {
    expect(localAUtc('2027-01-15', '09:00').toISOString()).toBe('2027-01-15T12:00:00.000Z')
  })

  it('rechaza una hora inválida', () => {
    expect(() => localAUtc('2026-08-24', '99:99')).toThrow()
  })
})

describe('utcALocal', () => {
  it('es la inversa de localAUtc', () => {
    const d = localAUtc('2026-08-24', '15:00')
    expect(utcALocal(d)).toEqual({ fecha: '2026-08-24', hora: '15:00' })
  })

  it('devuelve el día local anterior cuando el instante UTC ya pasó a la madrugada', () => {
    expect(utcALocal(new Date('2026-08-25T01:30:00.000Z'))).toEqual({
      fecha: '2026-08-24',
      hora: '22:30',
    })
  })
})

describe('minutosLocales y diaSemanaLocal', () => {
  it('devuelve los minutos desde la medianoche local', () => {
    expect(minutosLocales(localAUtc('2026-08-24', '15:30'))).toBe(930)
  })

  it('devuelve el día de la semana local, 0 = domingo', () => {
    // 2026-08-24 es lunes
    expect(diaSemanaLocal(localAUtc('2026-08-24', '15:00'))).toBe(1)
  })

  it('usa el día local, no el UTC, cerca de la medianoche', () => {
    // 22:30 del lunes local = 01:30 UTC del martes
    expect(diaSemanaLocal(localAUtc('2026-08-24', '22:30'))).toBe(1)
  })
})

describe('sumarMinutos', () => {
  it('suma minutos sin tocar el resto', () => {
    const d = localAUtc('2026-08-24', '15:00')
    expect(utcALocal(sumarMinutos(d, 50)).hora).toBe('15:50')
  })
})

describe('aTstzrange y parsearTstzrange', () => {
  it('arma un rango semiabierto en formato Postgres', () => {
    const inicio = localAUtc('2026-08-24', '15:00')
    const fin = sumarMinutos(inicio, 50)
    expect(aTstzrange(inicio, fin)).toBe('[2026-08-24T18:00:00.000Z,2026-08-24T18:50:00.000Z)')
  })

  it('parsea el formato que devuelve Postgres', () => {
    const r = parsearTstzrange('["2026-08-24 18:00:00+00","2026-08-24 18:50:00+00")')
    expect(r.inicio.toISOString()).toBe('2026-08-24T18:00:00.000Z')
    expect(r.fin.toISOString()).toBe('2026-08-24T18:50:00.000Z')
  })

  it('parsea también el formato ISO que genera aTstzrange', () => {
    const r = parsearTstzrange('[2026-08-24T18:00:00.000Z,2026-08-24T18:50:00.000Z)')
    expect(r.fin.toISOString()).toBe('2026-08-24T18:50:00.000Z')
  })

  it('falla ruidosamente si el rango no se reconoce', () => {
    expect(() => parsearTstzrange('cualquier cosa')).toThrow()
  })
})
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Correr: `npm test`
Esperado: FALLA con `Failed to resolve import "../../src/lib/tiempo"`.

- [ ] **Paso 4: Escribir la implementación mínima**

`src/lib/tiempo.ts`:

```ts
/**
 * Toda la app guarda instantes en UTC y los muestra en hora argentina (−03:00).
 * Argentina no tiene horario de verano, así que el offset es una constante y no
 * hace falta ninguna librería de zonas horarias.
 */

const OFFSET_MS = 3 * 60 * 60 * 1000

/** Fecha `YYYY-MM-DD` y hora `HH:MM` locales → instante UTC. */
export function localAUtc(fecha: string, hora: string): Date {
  const horaCompleta = hora.length === 5 ? `${hora}:00` : hora
  const d = new Date(`${fecha}T${horaCompleta}-03:00`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha u hora inválida: ${fecha} ${hora}`)
  }
  return d
}

/** Instante UTC → fecha `YYYY-MM-DD` y hora `HH:MM` locales. */
export function utcALocal(d: Date): { fecha: string; hora: string } {
  const iso = new Date(d.getTime() - OFFSET_MS).toISOString()
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) }
}

/** Minutos transcurridos desde la medianoche local. */
export function minutosLocales(d: Date): number {
  const [h, m] = utcALocal(d).hora.split(':').map(Number)
  return h * 60 + m
}

/** Día de la semana local, 0 = domingo (igual que `Date.getDay`). */
export function diaSemanaLocal(d: Date): number {
  return new Date(d.getTime() - OFFSET_MS).getUTCDay()
}

export function sumarMinutos(d: Date, minutos: number): Date {
  return new Date(d.getTime() + minutos * 60_000)
}

/** Rango semiabierto `[inicio, fin)` en la sintaxis de `tstzrange`. */
export function aTstzrange(inicio: Date, fin: Date): string {
  return `[${inicio.toISOString()},${fin.toISOString()})`
}

function parsearInstante(valor: string): Date {
  let s = valor.trim().replace(/^"|"$/g, '').replace(' ', 'T')
  if (/[+-]\d{2}$/.test(s)) s += ':00'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Instante no reconocido: ${valor}`)
  }
  return d
}

/** Parsea lo que devuelve Postgres para una columna `tstzrange`. */
export function parsearTstzrange(valor: string): { inicio: Date; fin: Date } {
  const m = valor.trim().match(/^\[(.+),(.+)\)$/)
  if (!m) {
    throw new Error(`tstzrange no reconocido: ${valor}`)
  }
  return { inicio: parsearInstante(m[1]), fin: parsearInstante(m[2]) }
}
```

- [ ] **Paso 5: Correr el test y verificar que pasa**

Correr: `npm test`
Esperado: PASA, 14 tests.

- [ ] **Paso 6: Commit**

```bash
git add vitest.config.ts src/lib/tiempo.ts tests/unit/tiempo.test.ts package.json
git commit -m "feat: conversión UTC ↔ hora local argentina y rangos tstzrange"
```

---

## Tarea 3: Normalización de teléfonos argentinos (TDD)

El teléfono es la llave del paciente y, en la Etapa 2, la dirección de WhatsApp. Si se guarda con formatos mezclados (`0298 15 412-3456`, `+54 9 298…`), el mismo paciente entra dos veces y los recordatorios se mandan a un número que no existe. Se normaliza a E.164 al guardar, siempre.

Un número nacional argentino sin el `0` y sin el `15` tiene exactamente 10 dígitos. El `15` aparece después del código de área, que puede tener 2, 3 o 4 dígitos. Para WhatsApp el número siempre es móvil, así que se prefija `+549`.

**Archivos:**
- Crear: `src/lib/telefono.ts`
- Test: `tests/unit/telefono.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`tests/unit/telefono.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizarTelefonoAR, formatearTelefonoParaMostrar } from '../../src/lib/telefono'

describe('normalizarTelefonoAR', () => {
  it('acepta un número nacional de 10 dígitos', () => {
    expect(normalizarTelefonoAR('2984123456')).toBe('+5492984123456')
  })

  it('acepta Buenos Aires con código de área de 2 dígitos', () => {
    expect(normalizarTelefonoAR('1145678901')).toBe('+5491145678901')
  })

  it('saca el 0 inicial y el 15 después del código de área', () => {
    expect(normalizarTelefonoAR('02984 15-123456')).toBe('+5492984123456')
  })

  it('saca el 0 y el 15 con código de área de 2 dígitos', () => {
    expect(normalizarTelefonoAR('011 15 4567-8901')).toBe('+5491145678901')
  })

  it('acepta el formato internacional completo con 9', () => {
    expect(normalizarTelefonoAR('+54 9 2984 12-3456')).toBe('+5492984123456')
  })

  it('acepta el internacional sin el 9 y se lo agrega', () => {
    expect(normalizarTelefonoAR('+54 2984 123456')).toBe('+5492984123456')
  })

  it('ignora espacios, guiones, puntos y paréntesis', () => {
    expect(normalizarTelefonoAR(' (0298) 4.12-34.56 ')).toBe('+5492984123456')
  })

  it('es idempotente sobre un número ya normalizado', () => {
    expect(normalizarTelefonoAR('+5492984123456')).toBe('+5492984123456')
  })

  it('devuelve null si tiene menos de 10 dígitos', () => {
    expect(normalizarTelefonoAR('412-3456')).toBeNull()
  })

  it('devuelve null si tiene de más y no es por el 15', () => {
    expect(normalizarTelefonoAR('298412345678')).toBeNull()
  })

  it('devuelve null con texto vacío', () => {
    expect(normalizarTelefonoAR('   ')).toBeNull()
  })

  it('devuelve null para un número de otro país', () => {
    expect(normalizarTelefonoAR('+1 415 555 2671')).toBeNull()
  })
})

describe('formatearTelefonoParaMostrar', () => {
  it('muestra el E.164 en formato legible', () => {
    expect(formatearTelefonoParaMostrar('+5492984123456')).toBe('+54 9 2984 12-3456')
  })

  it('devuelve el original si no matchea el patrón esperado', () => {
    expect(formatearTelefonoParaMostrar('+34600123456')).toBe('+34600123456')
  })
})
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Correr: `npm test`
Esperado: FALLA con `Failed to resolve import "../../src/lib/telefono"`.

- [ ] **Paso 3: Escribir la implementación**

`src/lib/telefono.ts`:

```ts
/**
 * Normaliza teléfonos argentinos a E.164 (`+549XXXXXXXXXX`).
 *
 * Un número nacional sin el `0` de larga distancia y sin el `15` de celular
 * tiene siempre 10 dígitos: código de área (2, 3 o 4) + abonado. Para WhatsApp
 * siempre se usa el móvil, así que el prefijo es `+549`.
 *
 * Devuelve `null` si no se puede interpretar como número argentino. El llamador
 * decide qué hacer: acá no se adivina.
 */
export function normalizarTelefonoAR(entrada: string): string | null {
  const bruto = entrada.trim()
  if (!bruto) return null

  const tieneMas = bruto.startsWith('+')
  let digitos = bruto.replace(/\D/g, '')
  if (!digitos) return null

  if (tieneMas && !digitos.startsWith('54')) {
    // Internacional explícito de otro país: no es asunto nuestro.
    return null
  }

  if (digitos.startsWith('54')) digitos = digitos.slice(2)
  if (digitos.startsWith('9')) digitos = digitos.slice(1)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  // El `15` va pegado después del código de área (2, 3 o 4 dígitos).
  if (digitos.length === 12) {
    for (const i of [2, 3, 4]) {
      if (digitos.slice(i, i + 2) === '15') {
        digitos = digitos.slice(0, i) + digitos.slice(i + 2)
        break
      }
    }
  }

  if (digitos.length !== 10) return null

  return `+549${digitos}`
}

/** `+5492984123456` → `+54 9 2984 12-3456`. Solo para mostrar. */
export function formatearTelefonoParaMostrar(e164: string): string {
  const m = e164.match(/^\+549(\d{2,4})(\d{2})(\d{4})$/)
  if (!m) return e164
  return `+54 9 ${m[1]} ${m[2]}-${m[3]}`
}
```

Nota sobre `formatearTelefonoParaMostrar`: el regex es ambiguo entre códigos de área de 2, 3 y 4 dígitos; JavaScript resuelve la ambigüedad tomando el grupo más largo primero (4 dígitos), que es el caso de General Roca (`2984`). Es cosmético: si un número de Buenos Aires se muestra agrupado distinto, no rompe nada.

- [ ] **Paso 4: Correr el test y verificar que pasa**

Correr: `npm test`
Esperado: PASA, 14 tests nuevos.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/telefono.ts tests/unit/telefono.test.ts
git commit -m "feat: normalización de teléfonos argentinos a E.164"
```

---

## Tarea 4: Horarios, solapamiento y validación de turno (TDD)

Estas tres piezas juntas contestan la única pregunta que importa al agendar: *¿este turno se puede poner acá?* La base tiene la restricción `EXCLUDE` como última línea de defensa, pero un error de base es un mensaje feo; acá se contesta bien y con un motivo entendible.

**Archivos:**
- Crear: `src/lib/horarios.ts`, `src/lib/solapamiento.ts`, `src/lib/validar-turno.ts`
- Test: `tests/unit/horarios.test.ts`, `tests/unit/solapamiento.test.ts`, `tests/unit/validar-turno.test.ts`

- [ ] **Paso 1: Escribir los tests de solapamiento**

`tests/unit/solapamiento.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { seSolapan, chocaConAlguno } from '../../src/lib/solapamiento'
import { localAUtc, sumarMinutos } from '../../src/lib/tiempo'

function periodo(hora: string, duracionMin: number) {
  const inicio = localAUtc('2026-08-24', hora)
  return { inicio, fin: sumarMinutos(inicio, duracionMin) }
}

describe('seSolapan', () => {
  it('detecta superposición parcial', () => {
    expect(seSolapan(periodo('15:00', 50), periodo('15:30', 50))).toBe(true)
  })

  it('detecta contención completa', () => {
    expect(seSolapan(periodo('15:00', 90), periodo('15:20', 20))).toBe(true)
  })

  it('NO considera solapados dos turnos pegados: el rango es [inicio, fin)', () => {
    expect(seSolapan(periodo('15:00', 50), periodo('15:50', 50))).toBe(false)
  })

  it('no se solapan si están separados', () => {
    expect(seSolapan(periodo('09:00', 50), periodo('18:00', 50))).toBe(false)
  })

  it('es simétrica', () => {
    const a = periodo('15:00', 50)
    const b = periodo('15:30', 50)
    expect(seSolapan(a, b)).toBe(seSolapan(b, a))
  })
})

describe('chocaConAlguno', () => {
  it('es falso con la lista vacía', () => {
    expect(chocaConAlguno(periodo('15:00', 50), [])).toBe(false)
  })

  it('encuentra el choque aunque esté al final de la lista', () => {
    const otros = [periodo('09:00', 50), periodo('11:00', 50), periodo('15:20', 50)]
    expect(chocaConAlguno(periodo('15:00', 50), otros)).toBe(true)
  })

  it('es falso si ninguno choca', () => {
    const otros = [periodo('09:00', 50), periodo('16:00', 50)]
    expect(chocaConAlguno(periodo('15:00', 50), otros)).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Correr: `npm test -- solapamiento`
Esperado: FALLA con `Failed to resolve import "../../src/lib/solapamiento"`.

- [ ] **Paso 3: Implementar solapamiento**

`src/lib/solapamiento.ts`:

```ts
export type Periodo = { inicio: Date; fin: Date }

/**
 * Semántica `[inicio, fin)`, igual que el `tstzrange` de Postgres: dos turnos
 * pegados (uno termina 15:50, el otro arranca 15:50) NO se solapan.
 */
export function seSolapan(a: Periodo, b: Periodo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime()
}

export function chocaConAlguno(p: Periodo, otros: Periodo[]): boolean {
  return otros.some((otro) => seSolapan(p, otro))
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

Correr: `npm test -- solapamiento`
Esperado: PASA, 8 tests.

- [ ] **Paso 5: Escribir los tests de horarios**

`tests/unit/horarios.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dentroDeHorarioDeAtencion, franjasDelDia } from '../../src/lib/horarios'
import type { FranjaHoraria } from '../../src/lib/horarios'
import { localAUtc } from '../../src/lib/tiempo'

// 2026-08-24 es lunes (día 1)
const LUNES = '2026-08-24'
const MARTES = '2026-08-25'

const franjas: FranjaHoraria[] = [
  { dia_semana: 1, desde: '09:00', hasta: '13:00' },
  { dia_semana: 1, desde: '15:00', hasta: '20:00' },
  { dia_semana: 2, desde: '09:00', hasta: '13:00' },
]

describe('dentroDeHorarioDeAtencion', () => {
  it('acepta un turno completamente adentro de una franja', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), 50, franjas)).toBe(true)
  })

  it('acepta un turno que termina justo en el borde de la franja', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '19:10'), 50, franjas)).toBe(true)
  })

  it('rechaza un turno que se pasa del cierre', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '19:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que arranca antes de la apertura', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '08:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que cae en el hueco del mediodía', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '13:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que atraviesa el hueco entre dos franjas del mismo día', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '12:30'), 180, franjas)).toBe(false)
  })

  it('rechaza un día sin franjas cargadas', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc('2026-08-30', '10:00'), 50, franjas)).toBe(false)
  })

  it('usa el día local: 22:30 del lunes sigue siendo lunes aunque en UTC sea martes', () => {
    const conNoche: FranjaHoraria[] = [{ dia_semana: 1, desde: '21:00', hasta: '23:00' }]
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '22:00'), 50, conNoche)).toBe(true)
  })

  it('rechaza un turno que cruzaría la medianoche', () => {
    const nocturna: FranjaHoraria[] = [{ dia_semana: 1, desde: '21:00', hasta: '23:59' }]
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '23:30'), 60, nocturna)).toBe(false)
  })

  it('rechaza duración cero o negativa', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), 0, franjas)).toBe(false)
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), -30, franjas)).toBe(false)
  })
})

describe('franjasDelDia', () => {
  it('devuelve solo las franjas del día pedido, ordenadas', () => {
    expect(franjasDelDia(localAUtc(LUNES, '10:00'), franjas)).toEqual([
      { dia_semana: 1, desde: '09:00', hasta: '13:00' },
      { dia_semana: 1, desde: '15:00', hasta: '20:00' },
    ])
  })

  it('devuelve una sola franja para el martes', () => {
    expect(franjasDelDia(localAUtc(MARTES, '10:00'), franjas)).toHaveLength(1)
  })
})
```

- [ ] **Paso 6: Correr y verificar que falla**

Correr: `npm test -- horarios`
Esperado: FALLA con `Failed to resolve import "../../src/lib/horarios"`.

- [ ] **Paso 7: Implementar horarios**

`src/lib/horarios.ts`:

```ts
import { diaSemanaLocal, minutosLocales } from './tiempo'

export type FranjaHoraria = {
  /** 0 = domingo, 6 = sábado. */
  dia_semana: number
  /** `HH:MM` local. */
  desde: string
  /** `HH:MM` local. */
  hasta: string
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Franjas del día local del instante dado, ordenadas por hora de apertura. */
export function franjasDelDia(inicio: Date, franjas: FranjaHoraria[]): FranjaHoraria[] {
  const dia = diaSemanaLocal(inicio)
  return franjas
    .filter((f) => f.dia_semana === dia)
    .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
}

/**
 * ¿El turno `[inicio, inicio + duración)` entra entero en alguna franja de
 * atención? Un turno que cruza la medianoche siempre es `false`: el modelo de
 * franjas es por día, y ningún consultorio de este nicho atiende a esa hora.
 */
export function dentroDeHorarioDeAtencion(
  inicio: Date,
  duracionMin: number,
  franjas: FranjaHoraria[],
): boolean {
  if (duracionMin <= 0) return false

  const arranca = minutosLocales(inicio)
  const termina = arranca + duracionMin
  if (termina > 24 * 60) return false // cruzaría la medianoche

  return franjasDelDia(inicio, franjas).some(
    (f) => arranca >= aMinutos(f.desde) && termina <= aMinutos(f.hasta),
  )
}
```

- [ ] **Paso 8: Correr y verificar que pasa**

Correr: `npm test -- horarios`
Esperado: PASA, 12 tests.

- [ ] **Paso 9: Escribir los tests de validación de turno**

`tests/unit/validar-turno.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validarTurno } from '../../src/lib/validar-turno'
import type { FranjaHoraria } from '../../src/lib/horarios'
import { localAUtc, sumarMinutos } from '../../src/lib/tiempo'

const LUNES = '2026-08-24'

const franjas: FranjaHoraria[] = [{ dia_semana: 1, desde: '09:00', hasta: '20:00' }]

function periodo(fecha: string, hora: string, duracionMin: number) {
  const inicio = localAUtc(fecha, hora)
  return { inicio, fin: sumarMinutos(inicio, duracionMin) }
}

const base = {
  inicio: localAUtc(LUNES, '15:00'),
  duracionMin: 50,
  franjas,
  bloqueos: [],
  turnosExistentes: [],
}

describe('validarTurno', () => {
  it('acepta un turno limpio', () => {
    expect(validarTurno(base)).toEqual({ ok: true })
  })

  it('rechaza fuera del horario de atención', () => {
    expect(validarTurno({ ...base, inicio: localAUtc(LUNES, '21:00') })).toEqual({
      ok: false,
      motivo: 'fuera_de_horario',
    })
  })

  it('rechaza si cae dentro de un bloqueo', () => {
    const bloqueos = [periodo(LUNES, '14:00', 240)]
    expect(validarTurno({ ...base, bloqueos })).toEqual({ ok: false, motivo: 'bloqueado' })
  })

  it('rechaza si se superpone con un turno existente', () => {
    const turnosExistentes = [periodo(LUNES, '15:30', 50)]
    expect(validarTurno({ ...base, turnosExistentes })).toEqual({
      ok: false,
      motivo: 'superpuesto',
    })
  })

  it('acepta pegado a un turno existente sin hueco', () => {
    const turnosExistentes = [periodo(LUNES, '15:50', 50)]
    expect(validarTurno({ ...base, turnosExistentes })).toEqual({ ok: true })
  })

  it('reporta primero fuera_de_horario cuando fallan varias cosas a la vez', () => {
    const resultado = validarTurno({
      ...base,
      inicio: localAUtc(LUNES, '21:00'),
      bloqueos: [periodo(LUNES, '20:00', 240)],
      turnosExistentes: [periodo(LUNES, '21:00', 50)],
    })
    expect(resultado).toEqual({ ok: false, motivo: 'fuera_de_horario' })
  })

  it('ignora un bloqueo que termina justo cuando arranca el turno', () => {
    const bloqueos = [periodo(LUNES, '13:00', 120)] // 13:00 a 15:00
    expect(validarTurno({ ...base, bloqueos })).toEqual({ ok: true })
  })
})
```

- [ ] **Paso 10: Correr y verificar que falla**

Correr: `npm test -- validar-turno`
Esperado: FALLA con `Failed to resolve import "../../src/lib/validar-turno"`.

- [ ] **Paso 11: Implementar la validación**

`src/lib/validar-turno.ts`:

```ts
import { dentroDeHorarioDeAtencion, type FranjaHoraria } from './horarios'
import { chocaConAlguno, type Periodo } from './solapamiento'
import { sumarMinutos } from './tiempo'

export type MotivoRechazo = 'fuera_de_horario' | 'bloqueado' | 'superpuesto'

export type ResultadoValidacion = { ok: true } | { ok: false; motivo: MotivoRechazo }

export const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  fuera_de_horario: 'Ese horario está fuera de tus horarios de atención.',
  bloqueado: 'Ese día está bloqueado en tu agenda.',
  superpuesto: 'Ya tenés otro turno en ese horario.',
}

export type ArgumentosValidacion = {
  inicio: Date
  duracionMin: number
  franjas: FranjaHoraria[]
  bloqueos: Periodo[]
  turnosExistentes: Periodo[]
}

/**
 * Contesta si un turno se puede agendar y, si no, por qué. El orden de los
 * chequeos define el mensaje que ve el profesional cuando falla más de una
 * cosa: primero lo estructural (horario), después lo circunstancial.
 */
export function validarTurno({
  inicio,
  duracionMin,
  franjas,
  bloqueos,
  turnosExistentes,
}: ArgumentosValidacion): ResultadoValidacion {
  if (!dentroDeHorarioDeAtencion(inicio, duracionMin, franjas)) {
    return { ok: false, motivo: 'fuera_de_horario' }
  }

  const periodo: Periodo = { inicio, fin: sumarMinutos(inicio, duracionMin) }

  if (chocaConAlguno(periodo, bloqueos)) {
    return { ok: false, motivo: 'bloqueado' }
  }

  if (chocaConAlguno(periodo, turnosExistentes)) {
    return { ok: false, motivo: 'superpuesto' }
  }

  return { ok: true }
}
```

- [ ] **Paso 12: Correr toda la suite unitaria**

Correr: `npm test`
Esperado: PASA. 5 archivos, 55 tests.

- [ ] **Paso 13: Commit**

```bash
git add src/lib/horarios.ts src/lib/solapamiento.ts src/lib/validar-turno.ts tests/unit/
git commit -m "feat: validación de turnos contra horarios, bloqueos y solapamientos"
```

---

## Tarea 5: Proyecto Supabase de desarrollo y clientes

**Archivos:**
- Crear: `.env.local`, `.env.local.example`, `src/lib/supabase/servidor.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`

- [ ] **Paso 1: Consultar el costo y crear el proyecto**

Herramientas MCP, en este orden:

1. `mcp__claude_ai_Supabase__get_cost` con `{ "type": "project", "organization_id": "psakzaxefzplduqsaxfl" }`
2. `mcp__claude_ai_Supabase__confirm_cost` con el tipo, monto y recurrencia que devolvió el paso anterior → guardar el `id` que devuelve
3. `mcp__claude_ai_Supabase__create_project` con:

```json
{
  "name": "turnofijo",
  "organization_id": "psakzaxefzplduqsaxfl",
  "region": "sa-east-1",
  "confirm_cost_id": "<el id del paso 2>"
}
```

**Si falla por límite de proyectos gratuitos:** la organización ya tiene `importflow` y `epic-sound-studio`, ambos en estado `INACTIVE` (pausados). El plan gratuito permite dos proyectos. **Parar y preguntarle al usuario** cuál de las tres opciones quiere: borrar `epic-sound-studio` si ya no lo usa, pasar la organización a plan Pro, o usar otra organización. No borrar nada por cuenta propia.

Anotar el `id` del proyecto nuevo — en el resto del plan se lo llama `<PROJECT_ID>`.

- [ ] **Paso 2: Esperar a que el proyecto esté sano**

Correr `mcp__claude_ai_Supabase__get_project` con `{ "id": "<PROJECT_ID>" }` hasta que `status` sea `ACTIVE_HEALTHY`. Tarda entre uno y tres minutos. No seguir hasta que lo esté: `apply_migration` falla contra un proyecto que todavía se está provisionando.

- [ ] **Paso 3: Apagar la confirmación de email en desarrollo**

En el dashboard: Authentication → Sign In / Providers → Email → desactivar **Confirm email**. Sin esto, cada usuario de prueba queda esperando un mail y no se puede loguear.

Anotar en el README que **hay que volver a prenderlo antes de tener usuarios reales**.

- [ ] **Paso 4: Escribir las variables de entorno**

Obtener los valores con `mcp__claude_ai_Supabase__get_project_url` y `mcp__claude_ai_Supabase__get_publishable_keys`, ambos con `{ "project_id": "<PROJECT_ID>" }`.

`.env.local.example` (se versiona, sin valores reales):

```bash
# Proyecto Supabase de desarrollo de Turno Fijo
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Solo para tests de integración, va en .env.test.local. NUNCA en el código de la app.
# Se copia del dashboard: Project Settings → API Keys → secret key
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.local` (NO se versiona): los dos primeros valores, con los datos reales.

`.env.test.local` (NO se versiona): las tres variables, con la clave secreta copiada del dashboard.

- [ ] **Paso 5: Escribir los clientes de Supabase**

No hace falta un cliente de navegador en 1a: toda la lectura y escritura pasa por Server
Components y Server Actions. Cuando aparezca algo que lo necesite, se agrega ahí.

`src/lib/supabase/servidor.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 * En Next 16 `cookies()` es asíncrono, por eso la función es `async`.
 */
export async function crearClienteServidor() {
  const almacenDeCookies = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenDeCookies.getAll()
        },
        setAll(cookiesAGuardar) {
          try {
            cookiesAGuardar.forEach(({ name, value, options }) =>
              almacenDeCookies.set(name, value, options),
            )
          } catch {
            // Llamado desde un Server Component: el middleware ya refresca la
            // sesión, así que se puede ignorar.
          }
        },
      },
    },
  )
}
```

Nunca usar `getSession()` en el servidor para decidir si hay usuario: no revalida el token.
Siempre `supabase.auth.getUser()`.

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_PUBLICAS = ['/login', '/registro', '/auth']

export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesAGuardar) {
          cookiesAGuardar.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookiesAGuardar.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() revalida el token contra Supabase. No reemplazar por getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = request.nextUrl.pathname
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p))

  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // La raíz entra acá también: en la Tarea 7 se borra src/app/page.tsx y la
  // resuelve el middleware. Sin esto, un usuario con sesión que entra a / ve un 404.
  if (user && (esPublica || ruta === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/agenda'
    return NextResponse.redirect(url)
  }

  return respuesta
}
```

`src/middleware.ts`:

```ts
import type { NextRequest } from 'next/server'
import { actualizarSesion } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return actualizarSesion(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Paso 6: Verificar que compila**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`. Todavía no existe `/login`, así que la app redirige a una 404 — se arregla en la Tarea 7.

- [ ] **Paso 7: Commit**

```bash
git add .env.local.example src/lib/supabase/ src/middleware.ts
git commit -m "feat: clientes de Supabase y middleware de sesión"
```

---

## Tarea 6: Migración 0001 — professionals, RLS y alta automática

Un profesional = un tenant = un usuario. `professionals.id` **es** `auth.uid()`: sin tabla de membresías, sin join extra, y la política RLS es una comparación directa.

**Archivos:**
- Crear: `supabase/migrations/0001_professionals.sql`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0001_professionals.sql`:

```sql
-- btree_gist hace falta para la restricción EXCLUDE de appointments (migración 0004):
-- permite mezclar el operador = sobre uuid con && sobre tstzrange en el mismo índice.
create extension if not exists btree_gist;

create table public.professionals (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nombre                text not null default '',
  especialidad          text not null default 'psicologia'
                          check (especialidad in ('psicologia', 'nutricion', 'otra')),
  email                 text not null,
  telefono_contacto     text,
  duracion_default_min  integer not null default 50
                          check (duracion_default_min between 5 and 480),
  timezone              text not null default 'America/Argentina/Buenos_Aires',
  creado_en             timestamptz not null default now()
);

comment on table public.professionals is
  'Un profesional = un tenant. El id es auth.uid(): no hay organizaciones en v1.';

alter table public.professionals enable row level security;

create policy professionals_select_propio on public.professionals
  for select using (id = auth.uid());

create policy professionals_update_propio on public.professionals
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Sin política de INSERT ni DELETE a propósito: la fila la crea el trigger de
-- abajo y se borra en cascada cuando se borra el usuario de auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.professionals (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con:

```json
{
  "project_id": "<PROJECT_ID>",
  "name": "0001_professionals",
  "query": "<el contenido completo del archivo>"
}
```

- [ ] **Paso 3: Verificar que quedó bien**

`mcp__claude_ai_Supabase__execute_sql` con:

```sql
select
  (select count(*) from pg_extension where extname = 'btree_gist') as btree_gist,
  (select relrowsecurity from pg_class where relname = 'professionals') as rls_activa,
  (select count(*) from pg_policies where tablename = 'professionals') as politicas,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created') as trigger_alta;
```

Esperado: `btree_gist = 1`, `rls_activa = true`, `politicas = 2`, `trigger_alta = 1`.

- [ ] **Paso 4: Revisar los avisos de seguridad**

Correr `mcp__claude_ai_Supabase__get_advisors` con `{ "project_id": "<PROJECT_ID>", "type": "security" }`.
Esperado: ningún aviso de tipo `rls_disabled_in_public`.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0001_professionals.sql
git commit -m "feat: tabla professionals con RLS y alta automática al registrarse"
```

---

## Tarea 7: Autenticación

**Archivos:**
- Crear: `src/componentes/ui/boton.tsx`, `src/componentes/ui/campo.tsx`
- Crear: `src/app/(auth)/acciones.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/registro/page.tsx`
- Crear: `src/app/(app)/layout.tsx`, `src/app/(app)/agenda/page.tsx`
- Borrar: `src/app/page.tsx`

- [ ] **Paso 1: Escribir los componentes de UI compartidos**

`src/componentes/ui/boton.tsx`:

```tsx
import { clsx } from 'clsx'

type Variante = 'primario' | 'secundario' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-zinc-900 text-white hover:bg-zinc-800',
  secundario: 'bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50',
  peligro: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
}

export function Boton({
  variante = 'primario',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium',
        'transition-colors disabled:opacity-50 disabled:pointer-events-none',
        ESTILOS[variante],
        className,
      )}
    />
  )
}
```

`src/componentes/ui/campo.tsx`:

```tsx
import { clsx } from 'clsx'

export function Campo({
  etiqueta,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{etiqueta}</span>
      <input
        {...props}
        className={clsx(
          'block w-full min-h-11 rounded-lg border px-3 text-base',
          'focus:outline-none focus:ring-2 focus:ring-zinc-900',
          error ? 'border-red-400' : 'border-zinc-300',
          className,
        )}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
```

- [ ] **Paso 2: Escribir las server actions de auth**

`src/app/(auth)/acciones.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type EstadoFormulario = { error?: string }

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Poné tu nombre.'),
  email: z.string().trim().toLowerCase().email('Ese email no parece válido.'),
  password: z.string().min(8, 'La contraseña tiene que tener al menos 8 caracteres.'),
})

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('Ese email no parece válido.'),
  password: z.string().min(1, 'Escribí tu contraseña.'),
})

export async function registrarse(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = esquemaRegistro.safeParse({
    nombre: datos.get('nombre'),
    email: datos.get('email'),
    password: datos.get('password'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signUp({
    email: parseado.data.email,
    password: parseado.data.password,
    options: { data: { nombre: parseado.data.nombre } },
  })

  if (error) {
    return { error: 'No se pudo crear la cuenta. Puede que ese email ya esté registrado.' }
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}

export async function iniciarSesion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = esquemaLogin.safeParse({
    email: datos.get('email'),
    password: datos.get('password'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword(parseado.data)

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

**Cuidado con `redirect()` dentro de `try`:** `redirect` funciona lanzando una excepción especial. Si se envuelve este código en `try/catch`, el `redirect` queda atrapado y la navegación no ocurre. Acá no hay `try`, y así tiene que quedar.

- [ ] **Paso 3: Escribir las pantallas de login y registro**

`src/app/(auth)/login/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(iniciarSesion, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Turno Fijo</h1>
      <p className="mb-6 text-sm text-zinc-600">Entrá a tu agenda.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        <Boton type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-medium underline">
          Creá una
        </Link>
      </p>
    </main>
  )
}
```

`src/app/(auth)/registro/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'

export default function RegistroPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(registrarse, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-zinc-600">Tu agenda, en dos minutos.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Nombre" name="nombre" autoComplete="name" required />
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        <Boton type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium underline">
          Entrá
        </Link>
      </p>
    </main>
  )
}
```

- [ ] **Paso 4: Escribir el layout de la app y una agenda provisoria**

`src/app/(app)/layout.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { cerrarSesion } from '../(auth)/acciones'

const NAVEGACION = [
  { href: '/agenda', texto: 'Agenda' },
  { href: '/pacientes', texto: 'Pacientes' },
  { href: '/configuracion', texto: 'Configuración' },
]

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // El middleware ya redirige, pero el layout no confía en eso: es la última
  // barrera antes de renderizar datos de un tenant.
  if (!user) redirect('/login')

  const { data: profesional } = await supabase
    .from('professionals')
    .select('nombre')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Turno Fijo</span>
          <nav className="flex gap-4 text-sm">
            {NAVEGACION.map((item) => (
              <Link key={item.href} href={item.href} className="text-zinc-600 hover:text-zinc-900">
                {item.texto}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-600">
            <span className="hidden sm:inline">{profesional?.nombre || user.email}</span>
            <form action={cerrarSesion}>
              <button type="submit" className="underline">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
```

`src/app/(app)/agenda/page.tsx` (provisoria, se reemplaza en la Tarea 16):

```tsx
export default function AgendaPage() {
  return <h1 className="text-xl font-semibold">Agenda</h1>
}
```

Borrar la home vieja: la ruta `/` ahora la resuelve el middleware.

```bash
rm src/app/page.tsx
```

- [ ] **Paso 5: Probar a mano**

Correr: `npm run dev`
En el navegador:
1. Ir a `http://localhost:3000` → redirige a `/login`.
2. Ir a `/registro`, crear una cuenta con un email de prueba → cae en `/agenda` y arriba a la derecha aparece el nombre.
3. Click en "Salir" → vuelve a `/login`.
4. Ir a mano a `/agenda` sin sesión → redirige a `/login`.
5. Entrar de nuevo con el mismo email y contraseña → `/agenda`.

Verificar que la fila del profesional se creó sola, con `mcp__claude_ai_Supabase__execute_sql`:

```sql
select id, email, nombre, duracion_default_min, timezone from public.professionals;
```

Esperado: una fila con el email y el nombre del registro, `duracion_default_min = 50`.

- [ ] **Paso 6: Commit**

```bash
git add src/app src/componentes
git commit -m "feat: registro, login, logout y rutas protegidas"
```

---

## Tarea 8: Test de integración de la tenancy

RLS es lo único que impide que un profesional vea los pacientes de otro. Que esté escrita en la migración no prueba que funcione. Este test crea **dos usuarios reales** contra el proyecto de desarrollo y verifica el aislamiento desde el lado del cliente, con la clave publicable — exactamente como lo ve el navegador.

**Archivos:**
- Crear: `tests/integration/setup.ts`, `tests/integration/ayudantes.ts`, `tests/integration/tenancy.test.ts`

- [ ] **Paso 1: Escribir el setup y los ayudantes**

`tests/integration/setup.ts`:

```ts
import { config } from 'dotenv'

config({ path: '.env.test.local' })

const REQUERIDAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

for (const clave of REQUERIDAS) {
  if (!process.env[clave]) {
    throw new Error(
      `Falta ${clave} en .env.test.local. Ver la Tarea 5 del plan: la clave secreta se copia del dashboard de Supabase.`,
    )
  }
}
```

`tests/integration/ayudantes.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const CLAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!

const SIN_PERSISTENCIA = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const

/** Cliente con la clave secreta: saltea RLS. Solo para preparar y limpiar datos. */
export const admin = createClient(URL, CLAVE_SECRETA, SIN_PERSISTENCIA)

export type ProfesionalDePrueba = {
  id: string
  email: string
  /** Cliente autenticado con la clave publicable: ve exactamente lo que ve el navegador. */
  cliente: SupabaseClient
}

const PASSWORD = 'turnofijo-test-1234'

export async function crearProfesionalDePrueba(): Promise<ProfesionalDePrueba> {
  const email = `test-${randomUUID()}@turnofijo.test`

  const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: 'Profesional de prueba' },
  })
  if (errorAlta || !creado.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${errorAlta?.message}`)
  }

  const cliente = createClient(URL, CLAVE_PUBLICA, SIN_PERSISTENCIA)
  const { error: errorLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD })
  if (errorLogin) {
    throw new Error(`No se pudo loguear el usuario de prueba: ${errorLogin.message}`)
  }

  return { id: creado.user.id, email, cliente }
}

/** Borra el usuario; todo lo suyo se va en cascada. */
export async function borrarProfesionalDePrueba(p: ProfesionalDePrueba) {
  await p.cliente.auth.signOut()
  await admin.auth.admin.deleteUser(p.id)
}

/** Cliente sin sesión, para verificar que un anónimo no ve nada. */
export function clienteAnonimo(): SupabaseClient {
  return createClient(URL, CLAVE_PUBLICA, SIN_PERSISTENCIA)
}
```

- [ ] **Paso 2: Escribir el test**

`tests/integration/tenancy.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  clienteAnonimo,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

describe('tenancy de professionals', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('el trigger crea la fila de professionals al registrarse', async () => {
    const { data, error } = await admin
      .from('professionals')
      .select('id, email, duracion_default_min')
      .eq('id', ana.id)
      .single()

    expect(error).toBeNull()
    expect(data?.email).toBe(ana.email)
    expect(data?.duracion_default_min).toBe(50)
  })

  it('cada profesional ve su propia fila', async () => {
    const { data } = await ana.cliente.from('professionals').select('id')
    expect(data).toEqual([{ id: ana.id }])
  })

  it('NO ve la fila del otro profesional aunque la pida por id', async () => {
    const { data } = await ana.cliente.from('professionals').select('id').eq('id', beto.id)
    expect(data).toEqual([])
  })

  it('NO puede modificar la fila del otro profesional', async () => {
    await ana.cliente.from('professionals').update({ nombre: 'Hackeado' }).eq('id', beto.id)

    const { data } = await admin.from('professionals').select('nombre').eq('id', beto.id).single()
    expect(data?.nombre).toBe('Profesional de prueba')
  })

  it('sí puede modificar la propia', async () => {
    await ana.cliente.from('professionals').update({ nombre: 'Ana Pérez' }).eq('id', ana.id)

    const { data } = await admin.from('professionals').select('nombre').eq('id', ana.id).single()
    expect(data?.nombre).toBe('Ana Pérez')
  })

  it('un cliente sin sesión no ve nada', async () => {
    const { data } = await clienteAnonimo().from('professionals').select('id')
    expect(data).toEqual([])
  })
})
```

- [ ] **Paso 3: Correr el test**

Correr: `npm run test:integration`
Esperado: PASA, 6 tests. Si falla el primero con `email not confirmed`, revisar el Paso 3 de la Tarea 5.

- [ ] **Paso 4: Commit**

```bash
git add tests/integration/
git commit -m "test: aislamiento entre tenants verificado contra Supabase real"
```

---

## Tarea 9: Migración 0002 — pacientes

`patients` **no tiene campos clínicos**. Es una restricción del diseño (§5), no un olvido: guardar notas de sesión cambia el régimen legal de los datos y exige cifrado y consentimiento explícito.

La unicidad `(id, professional_id)` parece redundante —`id` ya es clave primaria— pero es lo que permite que `appointments` use una **clave foránea compuesta** y que la base garantice que nadie agenda un turno con el paciente de otro profesional.

**Archivos:**
- Crear: `supabase/migrations/0002_patients.sql`
- Test: `tests/integration/pacientes.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0002_patients.sql`:

```sql
create table public.patients (
  id                     uuid primary key default gen_random_uuid(),
  professional_id        uuid not null references public.professionals(id) on delete cascade,
  nombre                 text not null check (length(trim(nombre)) > 0),
  telefono_e164          text not null check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email                  text,
  notas_administrativas  text,
  contactable            boolean not null default true,
  consentimiento_wa_en   timestamptz,
  archivado_en           timestamptz,
  creado_en              timestamptz not null default now(),

  -- Permite la clave foránea compuesta de appointments: garantiza en la base
  -- que un turno nunca apunte al paciente de otro profesional.
  unique (id, professional_id)
);

comment on table public.patients is
  'Datos de contacto. SIN campos clínicos: es una restricción explícita del diseño.';

create unique index patients_telefono_unico_por_profesional
  on public.patients (professional_id, telefono_e164);

create index patients_por_nombre on public.patients (professional_id, nombre);

alter table public.patients enable row level security;

create policy patients_todo_propio on public.patients
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0002_patients", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Escribir el test de integración**

`tests/integration/pacientes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

describe('pacientes: aislamiento y restricciones', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba
  let pacienteDeAna: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()

    const { data, error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María López', telefono_e164: '+5492984111111' })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    pacienteDeAna = data.id
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('Ana ve su paciente', async () => {
    const { data } = await ana.cliente.from('patients').select('nombre')
    expect(data).toEqual([{ nombre: 'María López' }])
  })

  it('Beto NO ve el paciente de Ana', async () => {
    const { data } = await beto.cliente.from('patients').select('id')
    expect(data).toEqual([])
  })

  it('Beto NO puede leer el paciente de Ana ni pidiéndolo por id', async () => {
    const { data } = await beto.cliente.from('patients').select('id').eq('id', pacienteDeAna)
    expect(data).toEqual([])
  })

  it('Beto NO puede borrar el paciente de Ana', async () => {
    await beto.cliente.from('patients').delete().eq('id', pacienteDeAna)
    const { count } = await admin
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('id', pacienteDeAna)
    expect(count).toBe(1)
  })

  it('Ana NO puede insertar un paciente a nombre de Beto', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Colado', telefono_e164: '+5492984222222' })
    expect(error).not.toBeNull()
  })

  it('rechaza un teléfono que no es E.164', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'Mal Número', telefono_e164: '2984123456' })
    expect(error?.message).toMatch(/telefono_e164/)
  })

  it('rechaza el mismo teléfono dos veces para el mismo profesional', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'Duplicada', telefono_e164: '+5492984111111' })
    expect(error?.code).toBe('23505')
  })

  it('permite el mismo teléfono en dos profesionales distintos', async () => {
    const { error } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'María López', telefono_e164: '+5492984111111' })
    expect(error).toBeNull()
  })

  it('rechaza un nombre vacío', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: '   ', telefono_e164: '+5492984333333' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Paso 4: Correr los tests de integración**

Correr: `npm run test:integration`
Esperado: PASA, 15 tests entre los dos archivos.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/0002_patients.sql tests/integration/pacientes.test.ts
git commit -m "feat: tabla patients con RLS, teléfono E.164 y unicidad por profesional"
```

---

## Tarea 10: Pacientes — tipos, acciones y pantalla

**Archivos:**
- Crear: `src/tipos/db.ts`, `src/componentes/ui/dialogo.tsx`
- Crear: `src/acciones/pacientes.ts`
- Crear: `src/componentes/pacientes/formulario-paciente.tsx`, `src/componentes/pacientes/lista-pacientes.tsx`
- Crear: `src/app/(app)/pacientes/page.tsx`

**Sobre los tipos:** se escriben a mano en `src/tipos/db.ts` en vez de generarlos con `generate_typescript_types`. El esquema lo controla este mismo plan, son cuatro tablas, y los tipos generados traen tres capas de genéricos que no aportan nada acá. Si el esquema crece, se cambia de opinión.

- [ ] **Paso 1: Escribir los tipos del dominio**

`src/tipos/db.ts`:

```ts
export type Paciente = {
  id: string
  professional_id: string
  nombre: string
  telefono_e164: string
  email: string | null
  notas_administrativas: string | null
  contactable: boolean
  consentimiento_wa_en: string | null
  archivado_en: string | null
  creado_en: string
}

export type FranjaHorariaFila = {
  id: string
  professional_id: string
  dia_semana: number
  /** `HH:MM:SS` — Postgres devuelve `time` con segundos. */
  desde: string
  hasta: string
}

export type Bloqueo = {
  id: string
  professional_id: string
  /** `tstzrange` sin parsear, como lo devuelve Postgres. */
  periodo: string
  motivo: string
}

export type EstadoTurno = 'programado' | 'confirmado' | 'cancelado' | 'asistio' | 'ausente'

export type Turno = {
  id: string
  professional_id: string
  patient_id: string
  series_id: string | null
  periodo: string
  estado: EstadoTurno
  cancelado_por: 'profesional' | 'paciente' | 'sistema' | null
}

export type TurnoConPaciente = Turno & {
  patients: { nombre: string; telefono_e164: string } | null
}

export type Profesional = {
  id: string
  nombre: string
  especialidad: 'psicologia' | 'nutricion' | 'otra'
  email: string
  telefono_contacto: string | null
  duracion_default_min: number
  timezone: string
}
```

- [ ] **Paso 2: Escribir el componente de diálogo**

`src/componentes/ui/dialogo.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}
```

- [ ] **Paso 3: Escribir las server actions de pacientes**

`src/acciones/pacientes.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { normalizarTelefonoAR } from '@/lib/telefono'

export type EstadoFormulario = { error?: string; ok?: boolean }

const esquema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(2, 'Poné el nombre del paciente.'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio: es por donde le vas a escribir.'),
  email: z.union([z.string().trim().email('Ese email no parece válido.'), z.literal('')]),
  notas_administrativas: z.string().trim().max(500).optional(),
})

export async function guardarPaciente(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const idCrudo = datos.get('id')
  const parseado = esquema.safeParse({
    id: idCrudo ? String(idCrudo) : undefined,
    nombre: datos.get('nombre'),
    telefono: datos.get('telefono'),
    email: datos.get('email') ?? '',
    notas_administrativas: datos.get('notas_administrativas') ?? '',
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const telefono_e164 = normalizarTelefonoAR(parseado.data.telefono)
  if (!telefono_e164) {
    return { error: 'Ese teléfono no se entiende. Ejemplo: 2984 12-3456 o +54 9 2984 123456.' }
  }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const fila = {
    professional_id: user.id,
    nombre: parseado.data.nombre,
    telefono_e164,
    email: parseado.data.email || null,
    notas_administrativas: parseado.data.notas_administrativas || null,
  }

  const { error } = parseado.data.id
    ? await supabase.from('patients').update(fila).eq('id', parseado.data.id)
    : await supabase.from('patients').insert(fila)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya tenés un paciente cargado con ese teléfono.' }
    }
    return { error: 'No se pudo guardar el paciente.' }
  }

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function archivarPaciente(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase.from('patients').update({ archivado_en: new Date().toISOString() }).eq('id', id)

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
}

export async function desarchivarPaciente(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase.from('patients').update({ archivado_en: null }).eq('id', id)

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
}
```

**Por qué archivar y no borrar:** un paciente con turnos pasados no se puede borrar sin perder el historial de asistencia, y `appointments.patient_id` tiene `on delete restrict`. Archivar lo saca de las listas y lo deja fuera del selector de turnos nuevos.

- [ ] **Paso 4: Escribir el formulario**

`src/componentes/pacientes/formulario-paciente.tsx`:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { guardarPaciente, type EstadoFormulario } from '@/acciones/pacientes'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'
import type { Paciente } from '@/tipos/db'

export function FormularioPaciente({
  paciente,
  onGuardado,
}: {
  paciente?: Paciente
  onGuardado: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    guardarPaciente,
    {},
  )

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  return (
    <form action={accion} className="space-y-4">
      {paciente && <input type="hidden" name="id" value={paciente.id} />}
      <Campo etiqueta="Nombre" name="nombre" defaultValue={paciente?.nombre ?? ''} required />
      <Campo
        etiqueta="Teléfono"
        name="telefono"
        inputMode="tel"
        placeholder="2984 12-3456"
        defaultValue={paciente?.telefono_e164 ?? ''}
        required
      />
      <Campo
        etiqueta="Email (opcional)"
        name="email"
        type="email"
        defaultValue={paciente?.email ?? ''}
      />
      <Campo
        etiqueta="Notas administrativas (opcional)"
        name="notas_administrativas"
        defaultValue={paciente?.notas_administrativas ?? ''}
        placeholder="Obra social, quién lo derivó, etc."
      />
      <p className="text-xs text-zinc-500">
        No cargues información clínica acá: Turno Fijo no guarda historia clínica.
      </p>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      <div className="flex justify-end gap-2">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  )
}
```

- [ ] **Paso 5: Escribir la lista**

`src/componentes/pacientes/lista-pacientes.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { archivarPaciente, desarchivarPaciente } from '@/acciones/pacientes'
import { formatearTelefonoParaMostrar } from '@/lib/telefono'
import { Boton } from '@/componentes/ui/boton'
import { Dialogo } from '@/componentes/ui/dialogo'
import { FormularioPaciente } from './formulario-paciente'
import type { Paciente } from '@/tipos/db'

export function ListaPacientes({ pacientes }: { pacientes: Paciente[] }) {
  const [enEdicion, setEnEdicion] = useState<Paciente | null>(null)
  const [creando, setCreando] = useState(false)

  const activos = pacientes.filter((p) => !p.archivado_en)
  const archivados = pacientes.filter((p) => p.archivado_en)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Boton onClick={() => setCreando(true)}>Nuevo paciente</Boton>
      </div>

      {activos.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Todavía no cargaste ningún paciente.
        </p>
      )}

      <ul className="divide-y divide-zinc-200">
        {activos.map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.nombre}</p>
              <p className="text-sm text-zinc-600">
                {formatearTelefonoParaMostrar(p.telefono_e164)}
                {!p.contactable && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    revisar teléfono
                  </span>
                )}
              </p>
            </div>
            <Boton variante="secundario" onClick={() => setEnEdicion(p)}>
              Editar
            </Boton>
            <form action={archivarPaciente}>
              <input type="hidden" name="id" value={p.id} />
              <Boton variante="peligro" type="submit">
                Archivar
              </Boton>
            </form>
          </li>
        ))}
      </ul>

      {archivados.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-zinc-600">
            Archivados ({archivados.length})
          </summary>
          <ul className="mt-2 divide-y divide-zinc-200">
            {archivados.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-3 text-zinc-500">
                <span className="flex-1 truncate">{p.nombre}</span>
                <form action={desarchivarPaciente}>
                  <input type="hidden" name="id" value={p.id} />
                  <Boton variante="secundario" type="submit">
                    Recuperar
                  </Boton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialogo abierto={creando} onCerrar={() => setCreando(false)} titulo="Nuevo paciente">
        <FormularioPaciente onGuardado={() => setCreando(false)} />
      </Dialogo>

      <Dialogo
        abierto={enEdicion !== null}
        onCerrar={() => setEnEdicion(null)}
        titulo="Editar paciente"
      >
        {enEdicion && (
          <FormularioPaciente
            key={enEdicion.id}
            paciente={enEdicion}
            onGuardado={() => setEnEdicion(null)}
          />
        )}
      </Dialogo>
    </div>
  )
}
```

**El `key={enEdicion.id}`** obliga a React a rehacer el formulario al cambiar de paciente. Sin eso, los `defaultValue` quedan con los datos del paciente anterior.

- [ ] **Paso 6: Escribir la página**

`src/app/(app)/pacientes/page.tsx`:

```tsx
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { ListaPacientes } from '@/componentes/pacientes/lista-pacientes'
import type { Paciente } from '@/tipos/db'

export default async function PacientesPage() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('patients')
    .select('*')
    .order('nombre', { ascending: true })

  return <ListaPacientes pacientes={(data ?? []) as Paciente[]} />
}
```

No hace falta filtrar por `professional_id`: RLS ya lo hace. Poner el filtro igual sería sugerir que RLS es opcional.

- [ ] **Paso 7: Probar a mano**

Correr: `npm run dev` y entrar a `/pacientes`.
1. "Nuevo paciente" → nombre `María López`, teléfono `2984 12-3456` → se guarda y aparece en la lista como `+54 9 2984 12-3456`.
2. Cargar otro con el mismo teléfono escrito distinto (`02984 15 123456`) → error *"Ya tenés un paciente cargado con ese teléfono"*. Esto prueba de punta a punta que la normalización funciona.
3. Cargar uno con teléfono `123` → error de teléfono inentendible.
4. Editar el primero, cambiarle el nombre → se actualiza.
5. Archivar → desaparece de la lista y aparece en "Archivados". Recuperar → vuelve.

- [ ] **Paso 8: Commit**

```bash
git add src/tipos src/acciones/pacientes.ts src/componentes src/app/\(app\)/pacientes
git commit -m "feat: alta, edición y archivado de pacientes"
```

---

## Tarea 11: Migración 0003 — horarios de atención y bloqueos

`reemplazar_horarios` existe para que guardar la grilla semanal sea atómico. El cliente de Supabase no tiene transacciones: un `delete` seguido de un `insert` que falla deja al profesional sin horarios cargados. El cuerpo de una función de Postgres es una transacción, así que el problema desaparece.

**Archivos:**
- Crear: `supabase/migrations/0003_working_hours_blocks.sql`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0003_working_hours_blocks.sql`:

```sql
create table public.working_hours (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  dia_semana       smallint not null check (dia_semana between 0 and 6),
  desde            time not null,
  hasta            time not null,
  constraint working_hours_rango_valido check (hasta > desde)
);

comment on table public.working_hours is
  'Franjas de atención por día. Puede haber más de una por día (mañana y tarde).';

create index working_hours_por_profesional
  on public.working_hours (professional_id, dia_semana);

alter table public.working_hours enable row level security;

create policy working_hours_todo_propio on public.working_hours
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create table public.blocks (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  periodo          tstzrange not null,
  motivo           text not null default '',
  creado_en        timestamptz not null default now(),
  constraint blocks_periodo_no_vacio check (not isempty(periodo))
);

comment on table public.blocks is
  'Vacaciones, feriados y ausencias puntuales. Se pueden solapar entre sí sin problema.';

create index blocks_por_periodo
  on public.blocks using gist (professional_id, periodo);

alter table public.blocks enable row level security;

create policy blocks_todo_propio on public.blocks
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Reemplaza la grilla semanal completa en una sola transacción.
-- security invoker: RLS sigue aplicando, así que nadie puede tocar la de otro.
create or replace function public.reemplazar_horarios(franjas jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  delete from public.working_hours where professional_id = auth.uid();

  insert into public.working_hours (professional_id, dia_semana, desde, hasta)
  select
    auth.uid(),
    (f ->> 'dia_semana')::smallint,
    (f ->> 'desde')::time,
    (f ->> 'hasta')::time
  from jsonb_array_elements(franjas) as f;
end;
$$;
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0003_working_hours_blocks", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Verificar**

`mcp__claude_ai_Supabase__execute_sql`:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('working_hours', 'blocks');
```

Esperado: dos filas, ambas con `rowsecurity = true`.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/0003_working_hours_blocks.sql
git commit -m "feat: tablas de horarios de atención y bloqueos con RLS"
```

---

## Tarea 12: Configuración — horarios de atención y duración por defecto

La grilla se edita como la piensa el profesional: siete días, cada uno con un turno mañana y uno tarde. La siesta no es un caso raro en Argentina, es la norma.

**Archivos:**
- Crear: `src/acciones/configuracion.ts`
- Crear: `src/componentes/configuracion/formulario-horarios.tsx`
- Crear: `src/app/(app)/configuracion/page.tsx`

- [ ] **Paso 1: Escribir las acciones**

`src/acciones/configuracion.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { aTstzrange, localAUtc } from '@/lib/tiempo'

export type EstadoFormulario = { error?: string; ok?: boolean }

const DIAS = [0, 1, 2, 3, 4, 5, 6] as const
const BLOQUES = ['manana', 'tarde'] as const

type FranjaNueva = { dia_semana: number; desde: string; hasta: string }

export async function guardarConfiguracion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const duracion = Number(datos.get('duracion_default_min'))
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { error: 'La duración por defecto tiene que estar entre 5 y 480 minutos.' }
  }

  const franjas: FranjaNueva[] = []

  for (const dia of DIAS) {
    for (const bloque of BLOQUES) {
      const desde = String(datos.get(`d${dia}_${bloque}_desde`) ?? '').trim()
      const hasta = String(datos.get(`d${dia}_${bloque}_hasta`) ?? '').trim()

      if (!desde && !hasta) continue
      if (!desde || !hasta) {
        return { error: `Faltan datos en una de las franjas: cargá desde y hasta, o dejá las dos vacías.` }
      }
      if (hasta <= desde) {
        return { error: `Una franja termina antes de empezar. Revisá los horarios.` }
      }
      franjas.push({ dia_semana: dia, desde, hasta })
    }
  }

  // Dos franjas del mismo día no se pueden pisar.
  for (const dia of DIAS) {
    const delDia = franjas.filter((f) => f.dia_semana === dia).sort((a, b) => (a.desde < b.desde ? -1 : 1))
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].desde < delDia[i - 1].hasta) {
        return { error: 'Tenés dos franjas del mismo día que se pisan.' }
      }
    }
  }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const { error: errorDuracion } = await supabase
    .from('professionals')
    .update({ duracion_default_min: duracion })
    .eq('id', user.id)
  if (errorDuracion) return { error: 'No se pudo guardar la duración por defecto.' }

  const { error: errorHorarios } = await supabase.rpc('reemplazar_horarios', { franjas })
  if (errorHorarios) return { error: 'No se pudieron guardar los horarios.' }

  revalidatePath('/configuracion')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function crearBloqueo(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const desde = String(datos.get('desde') ?? '')
  const hasta = String(datos.get('hasta') ?? '')
  const motivo = String(datos.get('motivo') ?? '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { error: 'Elegí las dos fechas.' }
  }
  if (hasta < desde) {
    return { error: 'La fecha de fin es anterior a la de inicio.' }
  }

  // El bloqueo cubre días completos: desde las 00:00 del primer día hasta las
  // 00:00 del día siguiente al último.
  const inicio = localAUtc(desde, '00:00')
  const finExclusivo = new Date(localAUtc(hasta, '00:00').getTime() + 24 * 60 * 60 * 1000)

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const { error } = await supabase.from('blocks').insert({
    professional_id: user.id,
    periodo: aTstzrange(inicio, finExclusivo),
    motivo,
  })
  if (error) return { error: 'No se pudo guardar el bloqueo.' }

  revalidatePath('/configuracion')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function borrarBloqueo(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()
  await supabase.from('blocks').delete().eq('id', id)
  revalidatePath('/configuracion')
  revalidatePath('/agenda')
}
```

**Un bloqueo no cancela los turnos que ya están agendados adentro.** Bloquear una semana de vacaciones cuando ya hay turnos cargados es un caso real y ambiguo — hay que preguntarle al profesional qué hacer con esos turnos, y eso es parte del flujo de reprogramación de la Etapa 1b. Por ahora el bloqueo solo impide agendar *nuevos* turnos ahí, y la Tarea 15 avisa cuántos turnos existentes quedaron dentro del bloqueo.

- [ ] **Paso 2: Escribir el formulario de horarios**

`src/componentes/configuracion/formulario-horarios.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { guardarConfiguracion, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import type { FranjaHorariaFila } from '@/tipos/db'

const DIAS: { numero: number; nombre: string }[] = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 0, nombre: 'Domingo' },
]

/** `09:00:00` → `09:00`, que es lo que espera un <input type="time">. */
function aHHMM(t: string | undefined): string {
  return t ? t.slice(0, 5) : ''
}

function franjasDelDia(franjas: FranjaHorariaFila[], dia: number) {
  const delDia = [...franjas]
    .filter((f) => f.dia_semana === dia)
    .sort((a, b) => (a.desde < b.desde ? -1 : 1))
  return { manana: delDia[0], tarde: delDia[1] }
}

export function FormularioHorarios({
  franjas,
  duracionDefault,
}: {
  franjas: FranjaHorariaFila[]
  duracionDefault: number
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    guardarConfiguracion,
    {},
  )

  return (
    <form action={accion} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Duración por defecto de una sesión (minutos)
          <input
            type="number"
            name="duracion_default_min"
            defaultValue={duracionDefault}
            min={5}
            max={480}
            step={5}
            className="mt-1 block w-32 min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Horarios de atención</h2>
        <p className="mb-3 text-sm text-zinc-600">
          Dejá las dos horas vacías para los días que no atendés.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2 font-medium">Día</th>
                <th className="py-2 font-medium">Mañana</th>
                <th className="py-2 font-medium">Tarde</th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map(({ numero, nombre }) => {
                const { manana, tarde } = franjasDelDia(franjas, numero)
                return (
                  <tr key={numero} className="border-t border-zinc-200">
                    <td className="py-2 pr-4 font-medium">{nombre}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <input type="time" name={`d${numero}_manana_desde`} defaultValue={aHHMM(manana?.desde)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                        <span className="text-zinc-400">a</span>
                        <input type="time" name={`d${numero}_manana_hasta`} defaultValue={aHHMM(manana?.hasta)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <input type="time" name={`d${numero}_tarde_desde`} defaultValue={aHHMM(tarde?.desde)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                        <span className="text-zinc-400">a</span>
                        <input type="time" name={`d${numero}_tarde_hasta`} defaultValue={aHHMM(tarde?.hasta)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-700">Guardado.</p>}

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar configuración'}
      </Boton>
    </form>
  )
}
```

- [ ] **Paso 3: Escribir la página de configuración**

`src/app/(app)/configuracion/page.tsx`:

```tsx
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { FormularioHorarios } from '@/componentes/configuracion/formulario-horarios'
import { PanelBloqueos } from '@/componentes/configuracion/panel-bloqueos'
import type { Bloqueo, FranjaHorariaFila, Profesional } from '@/tipos/db'

export default async function ConfiguracionPage() {
  const supabase = await crearClienteServidor()

  const [{ data: profesional }, { data: franjas }, { data: bloqueos }] = await Promise.all([
    supabase.from('professionals').select('*').single(),
    supabase.from('working_hours').select('*'),
    supabase.from('blocks').select('*').order('periodo', { ascending: true }),
  ])

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <FormularioHorarios
        franjas={(franjas ?? []) as FranjaHorariaFila[]}
        duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
      />
      <PanelBloqueos bloqueos={(bloqueos ?? []) as Bloqueo[]} />
    </div>
  )
}
```

- [ ] **Paso 4: Probar a mano**

Correr: `npm run dev` y entrar a `/configuracion`. La página va a fallar porque falta `PanelBloqueos` — se escribe en la Tarea 13. Si se quiere probar antes, comentar esa línea temporalmente.

Con la línea comentada:
1. Cargar lunes a viernes de `09:00` a `13:00` y de `15:00` a `20:00`, duración `50` → "Guardado".
2. Recargar la página → los valores siguen ahí.
3. Poner una franja con `hasta` menor que `desde` → error *"Una franja termina antes de empezar"*.
4. Poner mañana `09:00–14:00` y tarde `13:00–20:00` → error *"dos franjas del mismo día que se pisan"*.

Verificar en la base:

```sql
select dia_semana, desde, hasta from public.working_hours order by dia_semana, desde;
```

Esperado: diez filas, dos por cada día de lunes a viernes.

- [ ] **Paso 5: Commit**

```bash
git add src/acciones/configuracion.ts src/componentes/configuracion src/app/\(app\)/configuracion
git commit -m "feat: configuración de horarios de atención y duración por defecto"
```

---

## Tarea 13: Bloqueos — vacaciones, feriados y ausencias

**Archivos:**
- Crear: `src/componentes/configuracion/panel-bloqueos.tsx`

- [ ] **Paso 1: Escribir el panel**

`src/componentes/configuracion/panel-bloqueos.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { crearBloqueo, borrarBloqueo, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { parsearTstzrange, utcALocal } from '@/lib/tiempo'
import type { Bloqueo } from '@/tipos/db'

/** El período se guarda con fin exclusivo: el último día bloqueado es el anterior. */
function fechasDelBloqueo(periodo: string) {
  const { inicio, fin } = parsearTstzrange(periodo)
  const ultimoDia = new Date(fin.getTime() - 24 * 60 * 60 * 1000)
  return {
    desde: utcALocal(inicio).fecha,
    hasta: utcALocal(ultimoDia).fecha,
  }
}

export function PanelBloqueos({ bloqueos }: { bloqueos: Bloqueo[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearBloqueo, {})

  return (
    <section>
      <h2 className="mb-2 font-medium">Vacaciones, feriados y ausencias</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Los días bloqueados no aceptan turnos nuevos. Los turnos ya agendados no se cancelan solos.
      </p>

      <form action={accion} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-zinc-700">Desde</span>
          <input type="date" name="desde" required className="min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-zinc-700">Hasta</span>
          <input type="date" name="hasta" required className="min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <label className="text-sm flex-1 min-w-48">
          <span className="mb-1 block font-medium text-zinc-700">Motivo</span>
          <input name="motivo" placeholder="Vacaciones" className="w-full min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Agregando…' : 'Agregar'}
        </Boton>
      </form>

      {estado.error && <p className="mb-3 text-sm text-red-600">{estado.error}</p>}

      {bloqueos.length === 0 ? (
        <p className="text-sm text-zinc-500">No tenés días bloqueados.</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {bloqueos.map((b) => {
            const { desde, hasta } = fechasDelBloqueo(b.periodo)
            return (
              <li key={b.id} className="flex items-center gap-4 py-3 text-sm">
                <span className="font-medium">
                  {desde === hasta ? desde : `${desde} → ${hasta}`}
                </span>
                <span className="flex-1 text-zinc-600">{b.motivo || 'Sin motivo'}</span>
                <form action={borrarBloqueo}>
                  <input type="hidden" name="id" value={b.id} />
                  <Boton variante="peligro" type="submit">
                    Quitar
                  </Boton>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Paso 2: Descomentar `PanelBloqueos` en la página de configuración**

Si en la Tarea 12 se comentó la línea, restaurarla ahora.

- [ ] **Paso 3: Probar a mano**

En `/configuracion`:
1. Agregar un bloqueo del `2026-12-24` al `2027-01-06` con motivo `Vacaciones` → aparece en la lista como `2026-12-24 → 2027-01-06`.
2. Agregar uno de un solo día (mismo desde y hasta) → aparece con una sola fecha.
3. Poner `hasta` antes que `desde` → error.
4. Quitar un bloqueo → desaparece.

Verificar que el rango cubre el último día entero:

```sql
select motivo, lower(periodo) at time zone 'America/Argentina/Buenos_Aires' as arranca,
       upper(periodo) at time zone 'America/Argentina/Buenos_Aires' as termina
from public.blocks;
```

Esperado para el primer bloqueo: arranca `2026-12-24 00:00`, termina `2027-01-07 00:00` — el fin es exclusivo, por eso el 6 de enero queda bloqueado completo.

- [ ] **Paso 4: Commit**

```bash
git add src/componentes/configuracion/panel-bloqueos.tsx src/app/\(app\)/configuracion
git commit -m "feat: bloqueos de agenda por vacaciones, feriados y ausencias"
```

---

## Tarea 14: Migración 0004 — turnos y la garantía de no superposición

Acá vive la segunda de las dos garantías del diseño (§5). La restricción `EXCLUDE USING gist` hace **imposible** que un profesional tenga dos turnos pisados, sin importar qué haga el código de arriba: dos pestañas abiertas, un doble click, una condición de carrera entre dos requests. La validación en TypeScript de la Tarea 4 existe para dar un mensaje entendible; ésta existe para que el dato nunca quede mal.

La clave foránea compuesta `(patient_id, professional_id)` es la otra mitad: garantiza en la base que un turno nunca apunte al paciente de otro profesional, aunque alguien mande un `patient_id` cualquiera en el formulario.

**Archivos:**
- Crear: `supabase/migrations/0004_appointments.sql`
- Test: `tests/integration/turnos.test.ts`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0004_appointments.sql`:

```sql
create type public.appointment_estado as enum (
  'programado', 'confirmado', 'cancelado', 'asistio', 'ausente'
);

create type public.cancelado_por_tipo as enum ('profesional', 'paciente', 'sistema');

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  patient_id       uuid not null,
  -- La FK a series se agrega en la Etapa 1b, cuando exista la tabla.
  series_id        uuid,
  periodo          tstzrange not null,
  estado           public.appointment_estado not null default 'programado',
  cancelado_por    public.cancelado_por_tipo,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  constraint appointments_periodo_no_vacio check (not isempty(periodo)),

  -- El paciente tiene que ser del mismo profesional. Lo garantiza la base.
  constraint appointments_paciente_del_profesional
    foreign key (patient_id, professional_id)
    references public.patients (id, professional_id)
    on delete restrict,

  -- Nunca dos turnos superpuestos del mismo profesional. Los cancelados no cuentan.
  constraint appointments_sin_superposicion
    exclude using gist (professional_id with =, periodo with &&)
    where (estado <> 'cancelado')
);

comment on constraint appointments_sin_superposicion on public.appointments is
  'Garantía de esquema: ni un doble click ni dos pestañas abiertas pueden pisar dos turnos.';

create index appointments_por_inicio
  on public.appointments (professional_id, (lower(periodo)));

create index appointments_por_paciente
  on public.appointments (patient_id);

alter table public.appointments enable row level security;

create policy appointments_todo_propio on public.appointments
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger appointments_actualizado_en
  before update on public.appointments
  for each row execute function public.tocar_actualizado_en();
```

- [ ] **Paso 2: Aplicar la migración**

`mcp__claude_ai_Supabase__apply_migration` con `{ "project_id": "<PROJECT_ID>", "name": "0004_appointments", "query": "<contenido del archivo>" }`.

- [ ] **Paso 3: Verificar que la restricción existe**

`mcp__claude_ai_Supabase__execute_sql`:

```sql
select conname, contype
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname in ('appointments_sin_superposicion', 'appointments_paciente_del_profesional');
```

Esperado: dos filas. `appointments_sin_superposicion` con `contype = 'x'` (exclusión) y `appointments_paciente_del_profesional` con `contype = 'f'` (foránea).

- [ ] **Paso 4: Escribir el test de integración**

`tests/integration/turnos.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

/** `[inicio, inicio + duración)` en formato tstzrange, con hora local argentina. */
function periodo(fecha: string, hora: string, duracionMin: number): string {
  const inicio = new Date(`${fecha}T${hora}:00-03:00`)
  const fin = new Date(inicio.getTime() + duracionMin * 60_000)
  return `[${inicio.toISOString()},${fin.toISOString()})`
}

describe('appointments: garantías del esquema', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba
  let mariaDeAna: string
  let juanDeBeto: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()

    const { data: maria, error: e1 } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María', telefono_e164: '+5492984111111' })
      .select('id')
      .single()
    if (e1) throw new Error(e1.message)
    mariaDeAna = maria.id

    const { data: juan, error: e2 } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Juan', telefono_e164: '+5492984222222' })
      .select('id')
      .single()
    if (e2) throw new Error(e2.message)
    juanDeBeto = juan.id

    const { error: e3 } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:00', 50),
    })
    if (e3) throw new Error(e3.message)
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('la base RECHAZA un turno superpuesto', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:30', 50),
    })
    expect(error?.code).toBe('23P01')
  })

  it('ACEPTA un turno pegado, sin hueco', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:50', 50),
    })
    expect(error).toBeNull()
  })

  it('ACEPTA superponerse con un turno cancelado', async () => {
    const { data: cancelado } = await ana.cliente
      .from('appointments')
      .insert({
        professional_id: ana.id,
        patient_id: mariaDeAna,
        periodo: periodo('2026-09-02', '10:00', 50),
      })
      .select('id')
      .single()

    await ana.cliente
      .from('appointments')
      .update({ estado: 'cancelado', cancelado_por: 'paciente' })
      .eq('id', cancelado!.id)

    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-02', '10:00', 50),
    })
    expect(error).toBeNull()
  })

  it('dos profesionales SÍ pueden tener turnos en el mismo horario', async () => {
    const { error } = await beto.cliente.from('appointments').insert({
      professional_id: beto.id,
      patient_id: juanDeBeto,
      periodo: periodo('2026-09-01', '15:00', 50),
    })
    expect(error).toBeNull()
  })

  it('RECHAZA agendar con el paciente de otro profesional', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: juanDeBeto,
      periodo: periodo('2026-09-03', '09:00', 50),
    })
    expect(error).not.toBeNull()
  })

  it('Beto NO ve los turnos de Ana', async () => {
    const { data } = await beto.cliente.from('appointments').select('id, patient_id')
    expect(data?.every((t) => t.patient_id === juanDeBeto)).toBe(true)
  })

  it('NO deja borrar un paciente que tiene turnos', async () => {
    const { error } = await ana.cliente.from('patients').delete().eq('id', mariaDeAna)
    expect(error?.code).toBe('23503')
  })

  it('el trigger actualiza actualizado_en al modificar', async () => {
    const { data: antes } = await admin
      .from('appointments')
      .select('id, actualizado_en')
      .eq('professional_id', ana.id)
      .limit(1)
      .single()

    await new Promise((r) => setTimeout(r, 1100))
    await ana.cliente.from('appointments').update({ estado: 'confirmado' }).eq('id', antes!.id)

    const { data: despues } = await admin
      .from('appointments')
      .select('actualizado_en')
      .eq('id', antes!.id)
      .single()

    expect(new Date(despues!.actualizado_en).getTime()).toBeGreaterThan(
      new Date(antes!.actualizado_en).getTime(),
    )
  })
})
```

- [ ] **Paso 5: Correr los tests de integración**

Correr: `npm run test:integration`
Esperado: PASA, 23 tests entre los tres archivos.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/0004_appointments.sql tests/integration/turnos.test.ts
git commit -m "feat: tabla appointments con exclusión de superposiciones garantizada por la base"
```

---

## Tarea 15: Server actions de turnos

Todas las operaciones sobre turnos pasan por acá. La validación en TypeScript devuelve el motivo entendible; el error `23P01` de Postgres se traduce al mismo mensaje, porque entre que se valida y se inserta puede haberse creado otro turno.

**Archivos:**
- Crear: `src/acciones/turnos.ts`
- Modificar: `src/acciones/configuracion.ts` (aviso de turnos dentro de un bloqueo nuevo)
- Modificar: `src/componentes/configuracion/panel-bloqueos.tsx` (mostrar ese aviso)

- [ ] **Paso 1: Escribir las acciones de turnos**

`src/acciones/turnos.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { aTstzrange, localAUtc, sumarMinutos, parsearTstzrange } from '@/lib/tiempo'
import type { FranjaHoraria } from '@/lib/horarios'
import type { Periodo } from '@/lib/solapamiento'
import { validarTurno, MENSAJES_RECHAZO } from '@/lib/validar-turno'
import type { EstadoTurno } from '@/tipos/db'

export type EstadoFormulario = { error?: string; ok?: boolean }

const esquema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid('Elegí un paciente.'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elegí una hora.'),
  duracion_min: z.coerce.number().int().min(5).max(480),
})

/** Turnos vigentes (no cancelados) que pisan el período, opcionalmente sin uno. */
async function turnosQueChocan(
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

async function bloqueosQueChocan(supabase: SupabaseClient, periodo: Periodo): Promise<Periodo[]> {
  const { data } = await supabase
    .from('blocks')
    .select('periodo')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  return (data ?? []).map((b) => parsearTstzrange(b.periodo as string))
}

async function franjasDeAtencion(supabase: SupabaseClient): Promise<FranjaHoraria[]> {
  const { data } = await supabase.from('working_hours').select('dia_semana, desde, hasta')
  return (data ?? []).map((f) => ({
    dia_semana: f.dia_semana as number,
    desde: String(f.desde).slice(0, 5),
    hasta: String(f.hasta).slice(0, 5),
  }))
}

/** Valida y guarda. Si viene `id`, mueve ese turno; si no, crea uno nuevo. */
export async function guardarTurno(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const idCrudo = datos.get('id')
  const parseado = esquema.safeParse({
    id: idCrudo ? String(idCrudo) : undefined,
    patient_id: datos.get('patient_id'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    duracion_min: datos.get('duracion_min'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const { id, patient_id, fecha, hora, duracion_min } = parseado.data

  let inicio: Date
  try {
    inicio = localAUtc(fecha, hora)
  } catch {
    return { error: 'Esa fecha y hora no son válidas.' }
  }
  const periodo: Periodo = { inicio, fin: sumarMinutos(inicio, duracion_min) }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const [franjas, bloqueos, turnosExistentes] = await Promise.all([
    franjasDeAtencion(supabase),
    bloqueosQueChocan(supabase, periodo),
    turnosQueChocan(supabase, periodo, id),
  ])

  const validacion = validarTurno({
    inicio,
    duracionMin: duracion_min,
    franjas,
    bloqueos,
    turnosExistentes,
  })
  if (!validacion.ok) {
    return { error: MENSAJES_RECHAZO[validacion.motivo] }
  }

  const fila = {
    professional_id: user.id,
    patient_id,
    periodo: aTstzrange(periodo.inicio, periodo.fin),
  }

  const { error } = id
    ? await supabase.from('appointments').update(fila).eq('id', id)
    : await supabase.from('appointments').insert(fila)

  if (error) {
    // La base es la última línea de defensa: entre la validación de arriba y
    // este insert pudo entrar otro turno.
    if (error.code === '23P01') return { error: MENSAJES_RECHAZO.superpuesto }
    if (error.code === '23503') return { error: 'Ese paciente no existe o no es tuyo.' }
    return { error: 'No se pudo guardar el turno.' }
  }

  revalidatePath('/agenda')
  return { ok: true }
}

export async function cancelarTurno(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase
    .from('appointments')
    .update({ estado: 'cancelado', cancelado_por: 'profesional' })
    .eq('id', id)

  revalidatePath('/agenda')
}

export async function marcarAsistencia(datos: FormData) {
  const id = String(datos.get('id'))
  const estado = String(datos.get('estado')) as EstadoTurno

  if (estado !== 'asistio' && estado !== 'ausente') return

  const supabase = await crearClienteServidor()
  await supabase.from('appointments').update({ estado }).eq('id', id)

  revalidatePath('/agenda')
}

/** Devuelve un turno cancelado al estado programado, si el horario sigue libre. */
export async function reactivarTurno(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase
    .from('appointments')
    .update({ estado: 'programado', cancelado_por: null })
    .eq('id', id)

  revalidatePath('/agenda')
}
```

**Sobre el filtro `ov`:** es el operador de solapamiento de rangos de Postgres, expuesto por PostgREST. Trae solo las filas que pisan el período que se está por guardar, en vez de traer el día entero y filtrar en JavaScript.

**Sobre `reactivarTurno`:** si el horario se ocupó mientras el turno estaba cancelado, la restricción `EXCLUDE` rechaza el `update` y el turno queda cancelado. El error no se muestra: la agenda se recarga y el profesional ve que sigue cancelado. Es una operación de rescate poco frecuente; darle una pantalla propia sería sobreingeniería en v1.

- [ ] **Paso 2: Verificar que compila**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`.

- [ ] **Paso 3: Avisar cuántos turnos quedan dentro de un bloqueo nuevo**

En `src/acciones/configuracion.ts`, cambiar el tipo del estado:

```ts
export type EstadoFormulario = { error?: string; ok?: boolean; aviso?: string }
```

Y reemplazar el final de `crearBloqueo` — desde el `const { error } = await supabase.from('blocks').insert(...)` hasta el `return { ok: true }` — por:

```ts
  const { error } = await supabase.from('blocks').insert({
    professional_id: user.id,
    periodo: aTstzrange(inicio, finExclusivo),
    motivo,
  })
  if (error) return { error: 'No se pudo guardar el bloqueo.' }

  // El bloqueo no cancela turnos ya agendados, pero el profesional tiene que
  // enterarse de que quedaron adentro.
  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', aTstzrange(inicio, finExclusivo))

  revalidatePath('/configuracion')
  revalidatePath('/agenda')

  if (count && count > 0) {
    return {
      ok: true,
      aviso: `Ojo: quedaron ${count} turno${count === 1 ? '' : 's'} agendado${count === 1 ? '' : 's'} adentro de ese bloqueo. No se cancelaron solos.`,
    }
  }

  return { ok: true }
```

- [ ] **Paso 4: Mostrar el aviso en el panel de bloqueos**

En `src/componentes/configuracion/panel-bloqueos.tsx`, debajo de la línea del error:

```tsx
      {estado.error && <p className="mb-3 text-sm text-red-600">{estado.error}</p>}
      {estado.aviso && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{estado.aviso}</p>
      )}
```

- [ ] **Paso 5: Commit**

```bash
git add src/acciones/turnos.ts src/acciones/configuracion.ts src/componentes/configuracion/panel-bloqueos.tsx
git commit -m "feat: acciones de turnos con validación y aviso de bloqueos con turnos adentro"
```

---

## Tarea 16: Agenda semanal

La pantalla de armado, pensada para escritorio (§8). Siete columnas, los turnos de cada día ordenados por hora, y un botón por día para agregar. Mover un turno es abrirlo y cambiarle fecha y hora: el arrastrar y soltar no entra en v1.

**Archivos:**
- Modificar: `src/lib/tiempo.ts` (agregar `sumarDias`, `lunesDeLaSemana`, `hoyLocal`)
- Modificar: `tests/unit/tiempo.test.ts`
- Crear: `src/componentes/agenda/agenda-semanal.tsx`, `src/componentes/agenda/formulario-turno.tsx`
- Modificar: `src/app/(app)/agenda/page.tsx` (reemplaza la versión provisoria de la Tarea 7)

- [ ] **Paso 1: Escribir los tests de navegación de semanas**

Agregar al final de `tests/unit/tiempo.test.ts`:

```ts
import { sumarDias, lunesDeLaSemana } from '../../src/lib/tiempo'

describe('sumarDias', () => {
  it('suma días dentro del mismo mes', () => {
    expect(sumarDias('2026-08-24', 3)).toBe('2026-08-27')
  })

  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('resta días cruzando el fin de mes', () => {
    expect(sumarDias('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('cruza el año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('lunesDeLaSemana', () => {
  it('devuelve el mismo día si ya es lunes', () => {
    expect(lunesDeLaSemana('2026-08-24')).toBe('2026-08-24')
  })

  it('retrocede desde un miércoles', () => {
    expect(lunesDeLaSemana('2026-08-26')).toBe('2026-08-24')
  })

  it('el domingo pertenece a la semana que arranca el lunes anterior', () => {
    expect(lunesDeLaSemana('2026-08-30')).toBe('2026-08-24')
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Correr: `npm test -- tiempo`
Esperado: FALLA con `No "sumarDias" export is defined on the module`.

- [ ] **Paso 3: Agregar las funciones**

Al final de `src/lib/tiempo.ts`:

```ts
/** Suma (o resta) días a una fecha local `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${fecha}`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana a la que pertenece la fecha. La semana laboral arranca el lunes. */
export function lunesDeLaSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${fecha}`)
  const retroceso = (d.getUTCDay() + 6) % 7
  return sumarDias(fecha, -retroceso)
}

/** Fecha de hoy en hora argentina, `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return utcALocal(new Date()).fecha
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

Correr: `npm test`
Esperado: PASA, 62 tests.

- [ ] **Paso 5: Escribir el formulario de turno**

`src/componentes/agenda/formulario-turno.tsx`:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { guardarTurno, type EstadoFormulario } from '@/acciones/turnos'
import { Boton } from '@/componentes/ui/boton'
import type { Paciente } from '@/tipos/db'

export type TurnoEnEdicion = {
  id?: string
  patient_id?: string
  fecha: string
  hora: string
  duracion_min: number
}

export function FormularioTurno({
  turno,
  pacientes,
  onGuardado,
}: {
  turno: TurnoEnEdicion
  pacientes: Paciente[]
  onGuardado: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarTurno, {})

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  return (
    <form action={accion} className="space-y-4">
      {turno.id && <input type="hidden" name="id" value={turno.id} />}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">Paciente</span>
        <select
          name="patient_id"
          defaultValue={turno.patient_id ?? ''}
          required
          className="block w-full min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base"
        >
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
          <span className="mb-1 block text-sm font-medium text-zinc-700">Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={turno.fecha}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Hora</span>
          <input
            type="time"
            name="hora"
            step={300}
            defaultValue={turno.hora}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Minutos</span>
          <input
            type="number"
            name="duracion_min"
            min={5}
            max={480}
            step={5}
            defaultValue={turno.duracion_min}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
      </div>

      {pacientes.length === 0 && (
        <p className="text-sm text-amber-800">
          Todavía no cargaste pacientes. Andá a Pacientes y cargá uno primero.
        </p>
      )}
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente || pacientes.length === 0}>
          {pendiente ? 'Guardando…' : turno.id ? 'Mover turno' : 'Agendar'}
        </Boton>
      </div>
    </form>
  )
}
```

- [ ] **Paso 6: Escribir la agenda semanal**

`src/componentes/agenda/agenda-semanal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cancelarTurno, marcarAsistencia, reactivarTurno } from '@/acciones/turnos'
import { parsearTstzrange, utcALocal, sumarDias } from '@/lib/tiempo'
import { Boton } from '@/componentes/ui/boton'
import { Dialogo } from '@/componentes/ui/dialogo'
import { FormularioTurno, type TurnoEnEdicion } from './formulario-turno'
import type { EstadoTurno, Paciente, TurnoConPaciente } from '@/tipos/db'

const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLOR_ESTADO: Record<EstadoTurno, string> = {
  programado: 'bg-zinc-100 text-zinc-900',
  confirmado: 'bg-green-100 text-green-900',
  cancelado: 'bg-zinc-50 text-zinc-400 line-through',
  asistio: 'bg-blue-100 text-blue-900',
  ausente: 'bg-red-100 text-red-900',
}

type TurnoDeVista = {
  id: string
  fecha: string
  hora: string
  duracion_min: number
  patient_id: string
  nombrePaciente: string
  estado: EstadoTurno
}

function aVista(t: TurnoConPaciente): TurnoDeVista {
  const { inicio, fin } = parsearTstzrange(t.periodo)
  const local = utcALocal(inicio)
  return {
    id: t.id,
    fecha: local.fecha,
    hora: local.hora,
    duracion_min: Math.round((fin.getTime() - inicio.getTime()) / 60_000),
    patient_id: t.patient_id,
    nombrePaciente: t.patients?.nombre ?? 'Paciente',
    estado: t.estado,
  }
}

export function AgendaSemanal({
  lunes,
  turnos,
  pacientes,
  duracionDefault,
}: {
  lunes: string
  turnos: TurnoConPaciente[]
  pacientes: Paciente[]
  duracionDefault: number
}) {
  const [nuevoEn, setNuevoEn] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<TurnoDeVista | null>(null)
  const [moviendo, setMoviendo] = useState<TurnoDeVista | null>(null)

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const vista = turnos.map(aVista)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Link href={`/agenda?semana=${sumarDias(lunes, -7)}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            ← Semana anterior
          </Link>
          <Link href="/agenda" className="rounded-lg border border-zinc-300 px-3 py-2">
            Hoy
          </Link>
          <Link href={`/agenda?semana=${sumarDias(lunes, 7)}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            Semana siguiente →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {dias.map((fecha, i) => {
          const delDia = vista
            .filter((t) => t.fecha === fecha)
            .sort((a, b) => (a.hora < b.hora ? -1 : 1))

          return (
            <div key={fecha} className="rounded-lg border border-zinc-200 p-2">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-medium">{NOMBRES_DIA[i]}</span>
                <span className="text-xs text-zinc-500">{fecha.slice(8)}/{fecha.slice(5, 7)}</span>
              </div>

              <ul className="space-y-1">
                {delDia.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setAbierto(t)}
                      className={`w-full rounded px-2 py-1.5 text-left text-sm ${COLOR_ESTADO[t.estado]}`}
                    >
                      <span className="font-medium">{t.hora}</span>{' '}
                      <span className="truncate">{t.nombrePaciente}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setNuevoEn(fecha)}
                className="mt-2 w-full rounded border border-dashed border-zinc-300 py-1.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
              >
                + Turno
              </button>
            </div>
          )
        })}
      </div>

      <Dialogo abierto={nuevoEn !== null} onCerrar={() => setNuevoEn(null)} titulo="Nuevo turno">
        {nuevoEn && (
          <FormularioTurno
            key={nuevoEn}
            turno={{ fecha: nuevoEn, hora: '', duracion_min: duracionDefault }}
            pacientes={pacientes}
            onGuardado={() => setNuevoEn(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        abierto={moviendo !== null}
        onCerrar={() => setMoviendo(null)}
        titulo="Mover turno"
      >
        {moviendo && (
          <FormularioTurno
            key={moviendo.id}
            turno={{
              id: moviendo.id,
              patient_id: moviendo.patient_id,
              fecha: moviendo.fecha,
              hora: moviendo.hora,
              duracion_min: moviendo.duracion_min,
            }}
            pacientes={pacientes}
            onGuardado={() => setMoviendo(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        abierto={abierto !== null}
        onCerrar={() => setAbierto(null)}
        titulo={abierto ? abierto.nombrePaciente : ''}
      >
        {abierto && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              {abierto.fecha} a las {abierto.hora} · {abierto.duracion_min} min ·{' '}
              <span className="font-medium">{abierto.estado}</span>
            </p>

            {abierto.estado === 'cancelado' ? (
              <form action={reactivarTurno} onSubmit={() => setAbierto(null)}>
                <input type="hidden" name="id" value={abierto.id} />
                <Boton type="submit" variante="secundario" className="w-full">
                  Reactivar turno
                </Boton>
              </form>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <form action={marcarAsistencia} onSubmit={() => setAbierto(null)} className="flex-1">
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="asistio" />
                    <Boton type="submit" className="w-full">
                      Asistió
                    </Boton>
                  </form>
                  <form action={marcarAsistencia} onSubmit={() => setAbierto(null)} className="flex-1">
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="ausente" />
                    <Boton type="submit" variante="secundario" className="w-full">
                      No vino
                    </Boton>
                  </form>
                </div>

                <Boton
                  variante="secundario"
                  className="w-full"
                  onClick={() => {
                    setMoviendo(abierto)
                    setAbierto(null)
                  }}
                >
                  Mover
                </Boton>

                <form action={cancelarTurno} onSubmit={() => setAbierto(null)}>
                  <input type="hidden" name="id" value={abierto.id} />
                  <Boton type="submit" variante="peligro" className="w-full">
                    Cancelar turno
                  </Boton>
                </form>
              </div>
            )}
          </div>
        )}
      </Dialogo>
    </div>
  )
}
```

- [ ] **Paso 7: Escribir la página de agenda**

Reemplazar `src/app/(app)/agenda/page.tsx` entero:

```tsx
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { AgendaSemanal } from '@/componentes/agenda/agenda-semanal'
import { aTstzrange, hoyLocal, localAUtc, lunesDeLaSemana, sumarDias } from '@/lib/tiempo'
import type { Paciente, Profesional, TurnoConPaciente } from '@/tipos/db'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { semana } = await searchParams
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? '') ? semana! : hoyLocal()
  const lunes = lunesDeLaSemana(referencia)

  const desde = localAUtc(lunes, '00:00')
  const hasta = localAUtc(sumarDias(lunes, 7), '00:00')

  const supabase = await crearClienteServidor()

  const [{ data: turnos }, { data: pacientes }, { data: profesional }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, patients(nombre, telefono_e164)')
      .filter('periodo', 'ov', aTstzrange(desde, hasta)),
    supabase.from('patients').select('*').is('archivado_en', null).order('nombre'),
    supabase.from('professionals').select('*').single(),
  ])

  return (
    <AgendaSemanal
      lunes={lunes}
      turnos={(turnos ?? []) as TurnoConPaciente[]}
      pacientes={(pacientes ?? []) as Paciente[]}
      duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
    />
  )
}
```

- [ ] **Paso 8: Verificar que compila y probar a mano**

Correr: `npm run build`
Esperado: `✓ Compiled successfully`.

Correr: `npm run dev` y entrar a `/agenda` con horarios ya cargados (Tarea 12) y al menos un paciente (Tarea 10):

1. "+ Turno" en un lunes → paciente `María`, hora `15:00`, 50 minutos → aparece en la columna.
2. Agregar otro a las `15:30` → error *"Ya tenés otro turno en ese horario"*.
3. Agregar otro a las `15:50` → entra: los turnos pegados se permiten.
4. Agregar uno a las `21:00` → error *"fuera de tus horarios de atención"*.
5. Agregar uno dentro de un bloqueo de vacaciones → error *"Ese día está bloqueado"*.
6. Click en un turno → "Asistió" → cambia de color y el estado pasa a `asistio`.
7. Click en otro → "Mover" → cambiar al jueves 10:00 → se va a la columna del jueves.
8. Click en otro → "Cancelar turno" → queda tachado y gris.
9. Agendar un turno nuevo en el horario del cancelado → entra: la exclusión no cuenta los cancelados.
10. "Semana siguiente" y "Semana anterior" → cambia la semana y la URL lleva `?semana=`.

- [ ] **Paso 9: Commit**

```bash
git add src/lib/tiempo.ts tests/unit/tiempo.test.ts src/componentes/agenda src/app/\(app\)/agenda
git commit -m "feat: agenda semanal con alta, movimiento, cancelación y asistencia de turnos"
```

---

## Tarea 17: README, humo y cierre de la etapa

**Archivos:**
- Crear: `README.md`
- Crear: `docs/superpowers/checklists/2026-08-24-humo-etapa-1a.md`

- [ ] **Paso 1: Escribir el README**

`README.md`:

````markdown
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
````

- [ ] **Paso 2: Escribir la checklist de humo**

`docs/superpowers/checklists/2026-08-24-humo-etapa-1a.md`:

```markdown
# Humo — Etapa 1a

Correr entero contra una cuenta nueva, en un navegador sin sesión previa. Diez minutos.

## Cuenta
- [ ] Registrarse con un email nuevo → cae en `/agenda` con el nombre arriba a la derecha
- [ ] Salir → vuelve a `/login`
- [ ] Entrar a `/agenda` sin sesión → redirige a `/login`
- [ ] Entrar de nuevo → `/agenda`

## Configuración
- [ ] Cargar lunes a viernes 09:00–13:00 y 15:00–20:00, duración 50 → "Guardado"
- [ ] Recargar → los valores siguen
- [ ] Franja con `hasta` antes que `desde` → error
- [ ] Bloquear una semana futura con motivo "Vacaciones" → aparece en la lista

## Pacientes
- [ ] Cargar `María López`, teléfono `2984 12-3456` → se guarda como `+54 9 2984 12-3456`
- [ ] Cargar otro con `02984 15 123456` → error de teléfono duplicado
- [ ] Cargar `Juan Pérez` con otro teléfono → entra
- [ ] Editar el nombre de María → se actualiza
- [ ] Archivar a Juan → sale de la lista; recuperarlo → vuelve

## Agenda
- [ ] Agendar María el lunes 15:00, 50 min → aparece
- [ ] Agendar Juan el lunes 15:30 → error de superposición
- [ ] Agendar Juan el lunes 15:50 → entra
- [ ] Agendar a las 21:00 → error de horario de atención
- [ ] Agendar dentro de la semana bloqueada → error de bloqueo
- [ ] Marcar "Asistió" en el turno de María → cambia de color
- [ ] Mover el turno de Juan al jueves 10:00 → cambia de columna
- [ ] Cancelar un turno → queda tachado
- [ ] Agendar otro en el horario del cancelado → entra
- [ ] Navegar a la semana siguiente y volver con "Hoy"

## Aislamiento
- [ ] `npm run test:integration` en verde: ningún profesional ve datos de otro
```

- [ ] **Paso 3: Correr todo antes de cerrar**

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

Esperado: los cuatro en verde. 62 tests unitarios, 23 de integración, sin errores de lint, build exitoso.

**No declarar la etapa terminada sin haber visto esas cuatro salidas.** Si alguno falla, el trabajo no está hecho.

- [ ] **Paso 4: Recorrer la checklist de humo entera**

A mano, en el navegador. Marcar cada casillero. Si algo falla, arreglarlo antes de cerrar.

- [ ] **Paso 5: Commit final**

```bash
git add README.md docs/superpowers/checklists/
git commit -m "docs: README y checklist de humo de la etapa 1a"
```

- [ ] **Paso 6: Sentarse con un profesional**

No es un paso de software y es el más importante de la etapa. El diseño (§12) dice que al
terminar la Etapa 1 un profesional ya puede usar esto como agenda. Antes de arrancar 1b:
cargarle los horarios reales y tres o cuatro pacientes reales a alguien de General Roca, y
mirar dónde se traba. Lo que aparezca ahí manda sobre lo que diga el plan siguiente.

---

## Qué queda para el plan 1b

- `series` con turnos materializados y horizonte rodante de 8 semanas
- El job que extiende las series indefinidas
- Reprogramación con la pregunta *"¿solo este, o de acá en adelante?"*
- Pantalla del día optimizada para celular, con los botones grandes de asistió / ausente
- La FK de `appointments.series_id` a `series`
