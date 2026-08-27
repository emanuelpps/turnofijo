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
