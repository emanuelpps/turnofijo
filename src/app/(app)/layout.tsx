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
