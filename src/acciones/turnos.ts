'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { aTstzrange, localAUtc, sumarMinutos } from '@/lib/tiempo'
import type { Periodo } from '@/lib/solapamiento'
import { turnosQueChocan, bloqueosQueChocan, franjasDeAtencion } from '@/lib/agenda-datos'
import { validarTurno, MENSAJES_RECHAZO } from '@/lib/validar-turno'
import { normalizarTelefonoAR } from '@/lib/telefono'
import type { EstadoTurno } from '@/tipos/db'

export type EstadoFormulario = { error?: string; ok?: boolean }

const esquema = z.object({
  id: z.string().uuid('No se pudo identificar el turno. Recargá la página.').optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elegí una hora.'),
  duracion_min: z.coerce
    .number({ message: 'La duración tiene que ser un número de minutos.' })
    .int('La duración tiene que ser un número entero de minutos.')
    .min(5, 'El turno más corto es de 5 minutos.')
    .max(480, 'El turno más largo es de 8 horas.'),
})

/**
 * El paciente del turno: o uno ya cargado, o uno nuevo que se da de alta acá
 * mismo. Que el paciente llame y haya que salir a otra pantalla para cargarlo
 * antes de poder darle el turno es fricción pura.
 *
 * Si el teléfono ya está en la agenda se reusa esa ficha en vez de fallar por
 * duplicado: si cargás el mismo número, es el mismo paciente. Eso además hace
 * que reintentar después de un choque de horarios no rompa nada.
 */
async function resolverPaciente(
  supabase: SupabaseClient,
  professionalId: string,
  datos: FormData,
): Promise<{ patientId: string } | { error: string }> {
  if (String(datos.get('paciente_nuevo') ?? '') !== '1') {
    const id = String(datos.get('patient_id') ?? '')
    if (!z.string().uuid().safeParse(id).success) return { error: 'Elegí un paciente.' }
    return { patientId: id }
  }

  const nombre = String(datos.get('paciente_nombre') ?? '').trim()
  if (nombre.length < 2) return { error: 'Poné el nombre del paciente.' }

  const telefono = normalizarTelefonoAR(String(datos.get('paciente_telefono') ?? ''))
  if (!telefono) {
    return { error: 'Ese teléfono no se entiende. Ejemplo: 2984 12-3456 o +54 9 2984 123456.' }
  }

  const { data: existente } = await supabase
    .from('patients')
    .select('id, archivado_en')
    .eq('telefono_e164', telefono)
    .maybeSingle()

  if (existente) {
    // Le estás dando un turno: claramente vuelve a estar activo.
    if (existente.archivado_en) {
      await supabase.from('patients').update({ archivado_en: null }).eq('id', existente.id)
    }
    return { patientId: existente.id as string }
  }

  const { data: creado, error } = await supabase
    .from('patients')
    .insert({ professional_id: professionalId, nombre, telefono_e164: telefono })
    .select('id')
    .single()

  if (error || !creado) return { error: 'No se pudo cargar el paciente.' }
  return { patientId: creado.id as string }
}

/** Valida y guarda. Si viene `id`, mueve ese turno; si no, crea uno nuevo. */
export async function guardarTurno(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const idCrudo = datos.get('id')
  const parseado = esquema.safeParse({
    id: idCrudo ? String(idCrudo) : undefined,
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    duracion_min: datos.get('duracion_min'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const { id, fecha, hora, duracion_min } = parseado.data

  let inicio: Date
  try {
    inicio = localAUtc(fecha, hora)
  } catch {
    return { error: 'Esa fecha y hora no son válidas.' }
  }
  const periodo: Periodo = { inicio, fin: sumarMinutos(inicio, duracion_min) }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const [franjas, bloqueos, turnosExistentes] = await Promise.all([
    franjasDeAtencion(supabase),
    bloqueosQueChocan(supabase, periodo),
    turnosQueChocan(supabase, periodo, id),
  ])

  // Sin horarios cargados TODO cae fuera de horario, y "está fuera de tus
  // horarios de atención" deja al profesional nuevo sin saber qué hacer.
  if (franjas.length === 0) {
    return {
      error: 'Todavía no cargaste tus horarios de atención. Andá a Configuración y cargalos.',
    }
  }

  const validacion = validarTurno({
    inicio,
    duracionMin: duracion_min,
    franjas,
    bloqueos,
    turnosExistentes,
  })
  if (!validacion.ok) {
    return { error: MENSAJES_RECHAZO[validacion.motivo] }
  }

  // Recién acá, con el horario ya validado: si el paciente es nuevo y el turno
  // no entraba, no queremos haberlo dado de alta para nada.
  const paciente = await resolverPaciente(supabase, user.id, datos)
  if ('error' in paciente) return { error: paciente.error }

  const fila = {
    professional_id: user.id,
    patient_id: paciente.patientId,
    periodo: aTstzrange(periodo.inicio, periodo.fin),
  }

  const { error } = id
    ? await supabase.from('appointments').update(fila).eq('id', id)
    : await supabase.from('appointments').insert(fila)

  if (error) {
    // La base es la última línea de defensa: entre la validación de arriba y
    // este insert pudo entrar otro turno.
    if (error.code === '23P01') return { error: MENSAJES_RECHAZO.superpuesto }
    if (error.code === '23503') return { error: 'Ese paciente no existe o no es tuyo.' }
    return { error: 'No se pudo guardar el turno.' }
  }

  revalidatePath('/agenda')
  revalidatePath('/pacientes')
  return { ok: true }
}

export async function cancelarTurno(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase
    .from('appointments')
    .update({ estado: 'cancelado', cancelado_por: 'profesional' })
    .eq('id', id)

  revalidatePath('/agenda')
}

export async function marcarAsistencia(datos: FormData) {
  const id = String(datos.get('id'))
  const estado = String(datos.get('estado')) as EstadoTurno

  if (estado !== 'asistio' && estado !== 'ausente') return

  const supabase = await crearClienteServidor()
  await supabase.from('appointments').update({ estado }).eq('id', id)

  revalidatePath('/agenda')
}

/**
 * Devuelve un turno cancelado al estado programado.
 *
 * Puede fallar: mientras estuvo cancelado, ese horario pudo ocuparse con otro
 * turno, y la restricción EXCLUDE rechaza el update. Antes esto se descartaba
 * en silencio y el profesional apretaba el botón sin que pasara nada.
 */
export async function reactivarTurno(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  const { error } = await supabase
    .from('appointments')
    .update({ estado: 'programado', cancelado_por: null })
    .eq('id', id)

  if (error) {
    if (error.code === '23P01') {
      return { error: 'Ese horario ya se ocupó con otro turno. Movelo a otro horario.' }
    }
    return { error: 'No se pudo reactivar el turno.' }
  }

  revalidatePath('/agenda')
  return { ok: true }
}
