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
