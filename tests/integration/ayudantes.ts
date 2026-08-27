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
