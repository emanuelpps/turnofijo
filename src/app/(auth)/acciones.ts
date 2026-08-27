'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type EstadoFormulario = { error?: string }

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Poné tu nombre.'),
  email: z.string().trim().toLowerCase().email('Ese email no parece válido.'),
  password: z.string().min(8, 'La contraseña tiene que tener al menos 8 caracteres.'),
})

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('Ese email no parece válido.'),
  password: z.string().min(1, 'Escribí tu contraseña.'),
})

export async function registrarse(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = esquemaRegistro.safeParse({
    nombre: datos.get('nombre'),
    email: datos.get('email'),
    password: datos.get('password'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signUp({
    email: parseado.data.email,
    password: parseado.data.password,
    options: { data: { nombre: parseado.data.nombre } },
  })

  if (error) {
    return { error: 'No se pudo crear la cuenta. Puede que ese email ya esté registrado.' }
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}

export async function iniciarSesion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseado = esquemaLogin.safeParse({
    email: datos.get('email'),
    password: datos.get('password'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword(parseado.data)

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
