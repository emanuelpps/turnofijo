'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'
import { Isotipo } from '@/componentes/marca/logo'

export default function RegistroPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(registrarse, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Isotipo size={40} className="mb-5" />

      <h1
        className="text-[2rem] font-extrabold tracking-[-0.022em]"
        style={{ fontVariationSettings: '"wdth" 122' }}
      >
        Crear cuenta
      </h1>
      <p className="mt-2 mb-7 text-tinta-sup">Tu semana, armada en dos minutos.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Nombre" name="nombre" autoComplete="name" required />
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          ayuda="Al menos 8 caracteres."
          required
        />
        {estado.error && (
          <p role="alert" className="text-sm text-falta">
            {estado.error}
          </p>
        )}
        <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
          {pendiente ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-tinta-sup">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium text-birome underline underline-offset-2">
          Entrá
        </Link>
      </p>
    </main>
  )
}
