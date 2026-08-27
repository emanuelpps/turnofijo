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
