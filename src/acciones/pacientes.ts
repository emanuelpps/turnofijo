'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { normalizarTelefonoAR } from '@/lib/telefono'

export type EstadoFormulario = { error?: string; ok?: boolean }

const esquema = z.object({
  id: z.string().uuid('No se pudo identificar el paciente. Recargá la página.').optional(),
  nombre: z.string().trim().min(2, 'Poné el nombre del paciente.'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio: es por donde le vas a escribir.'),
  email: z.union([z.string().trim().email('Ese email no parece válido.'), z.literal('')]),
  notas_administrativas: z
    .string()
    .trim()
    .max(500, 'Las notas no pueden pasar de 500 caracteres.')
    .optional(),
})

export async function guardarPaciente(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const idCrudo = datos.get('id')
  const parseado = esquema.safeParse({
    id: idCrudo ? String(idCrudo) : undefined,
    nombre: datos.get('nombre'),
    telefono: datos.get('telefono'),
    email: datos.get('email') ?? '',
    notas_administrativas: datos.get('notas_administrativas') ?? '',
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const telefono_e164 = normalizarTelefonoAR(parseado.data.telefono)
  if (!telefono_e164) {
    return { error: 'Ese teléfono no se entiende. Ejemplo: 2984 12-3456 o +54 9 2984 123456.' }
  }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const fila = {
    professional_id: user.id,
    nombre: parseado.data.nombre,
    telefono_e164,
    email: parseado.data.email || null,
    notas_administrativas: parseado.data.notas_administrativas || null,
  }

  const { error } = parseado.data.id
    ? await supabase.from('patients').update(fila).eq('id', parseado.data.id)
    : await supabase.from('patients').insert(fila)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya tenés un paciente cargado con ese teléfono.' }
    }
    return { error: 'No se pudo guardar el paciente.' }
  }

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function archivarPaciente(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase.from('patients').update({ archivado_en: new Date().toISOString() }).eq('id', id)

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
}

export async function desarchivarPaciente(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase.from('patients').update({ archivado_en: null }).eq('id', id)

  revalidatePath('/pacientes')
  revalidatePath('/agenda')
}
