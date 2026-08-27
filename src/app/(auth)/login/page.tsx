'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'
import { Isotipo } from '@/componentes/marca/logo'

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(iniciarSesion, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Isotipo size={40} className="mb-5" />

      <h1
        className="text-[2rem] font-extrabold tracking-[-0.022em]"
        style={{ fontVariationSettings: '"wdth" 122' }}
      >
        Turno Fijo
      </h1>
      <p className="mt-2 mb-7 text-tinta-sup">Entrá a tu agenda.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {estado.error && (
          <p role="alert" className="text-sm text-falta-texto">
            {estado.error}
          </p>
        )}
        <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
          {pendiente ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-tinta-sup">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-medium text-birome underline underline-offset-2">
          Creá una
        </Link>
      </p>
    </main>
  )
}
