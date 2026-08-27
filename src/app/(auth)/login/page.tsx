'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(iniciarSesion, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Turno Fijo</h1>
      <p className="mb-6 text-sm text-zinc-600">Entrá a tu agenda.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        <Boton type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-medium underline">
          Creá una
        </Link>
      </p>
    </main>
  )
}
