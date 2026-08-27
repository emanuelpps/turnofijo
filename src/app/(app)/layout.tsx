import Link from 'next/link'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { cerrarSesion } from '../(auth)/acciones'
import { Logotipo } from '@/componentes/marca/logo'
import { Navegacion } from '@/componentes/navegacion'

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
      <header className="border-b border-renglon bg-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/agenda" aria-label="Turno Fijo, ir a la agenda">
            <Logotipo />
          </Link>

          <Navegacion />

          <div className="ml-auto flex items-center gap-3 text-sm text-tinta-sup">
            <span className="hidden sm:inline">{profesional?.nombre || user.email}</span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="rounded-marca px-2 py-2 font-medium text-lapiz hover:text-tinta"
              >
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
