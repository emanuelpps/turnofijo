'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// "Hoy" va primero: es la pantalla que se abre diez veces por jornada.
const SECCIONES = [
  { href: '/hoy', texto: 'Hoy' },
  { href: '/agenda', texto: 'Agenda' },
  { href: '/pacientes', texto: 'Pacientes' },
  { href: '/configuracion', texto: 'Configuración' },
]

export function Navegacion() {
  const ruta = usePathname()

  return (
    <nav aria-label="Secciones" className="flex gap-1 text-sm">
      {SECCIONES.map((seccion) => {
        const activa = ruta === seccion.href || ruta.startsWith(`${seccion.href}/`)
        return (
          <Link
            key={seccion.href}
            href={seccion.href}
            aria-current={activa ? 'page' : undefined}
            className={[
              'rounded-marca px-3 py-2 font-medium transition-colors',
              activa
                ? 'bg-birome-sup text-birome'
                : 'text-tinta-sup hover:bg-papel-alt hover:text-tinta',
            ].join(' ')}
          >
            {seccion.texto}
          </Link>
        )
      })}
    </nav>
  )
}
