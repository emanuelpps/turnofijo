'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoFormulario } from '../acciones'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'

export default function RegistroPage() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(registrarse, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-zinc-600">Tu agenda, en dos minutos.</p>

      <form action={accion} className="space-y-4">
        <Campo etiqueta="Nombre" name="nombre" autoComplete="name" required />
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        <Boton type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium underline">
          Entrá
        </Link>
      </p>
    </main>
  )
}
