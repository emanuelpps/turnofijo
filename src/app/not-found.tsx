import Link from 'next/link'
import { Isotipo } from '@/componentes/marca/logo'
import { Boton } from '@/componentes/ui/boton'

export const metadata = { title: 'Página no encontrada' }

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
      <Isotipo size={36} className="mx-auto mb-5" />
      <h1 className="text-[1.75rem] font-bold" style={{ fontVariationSettings: '"wdth" 118' }}>
        Acá no hay nada
      </h1>
      <p className="mt-2 mb-7 text-tinta-sup">
        La página que buscabas no existe o cambió de lugar.
      </p>
      <Link href="/agenda">
        <Boton tamano="grande" className="w-full">
          Volver a tu agenda
        </Boton>
      </Link>
    </main>
  )
}
