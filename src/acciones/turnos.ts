'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { aTstzrange, localAUtc, sumarMinutos, parsearTstzrange } from '@/lib/tiempo'
import type { FranjaHoraria } from '@/lib/horarios'
import type { Periodo } from '@/lib/solapamiento'
import { validarTurno, MENSAJES_RECHAZO } from '@/lib/validar-turno'
import type { EstadoTurno } from '@/tipos/db'

export type EstadoFormulario = { error?: string; ok?: boolean }

const esquema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid('Elegí un paciente.'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elegí una hora.'),
  duracion_min: z.coerce.number().int().min(5).max(480),
})

/** Turnos vigentes (no cancelados) que pisan el período, opcionalmente sin uno. */
async function turnosQueChocan(
  supabase: SupabaseClient,
  periodo: Periodo,
  excluirId?: string,
): Promise<Periodo[]> {
  let consulta = supabase
    .from('appointments')
    .select('id, periodo')
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  if (excluirId) consulta = consulta.neq('id', excluirId)

  const { data } = await consulta
  return (data ?? []).map((t) => parsearTstzrange(t.periodo as string))
}

async function bloqueosQueChocan(supabase: SupabaseClient, periodo: Periodo): Promise<Periodo[]> {
  const { data } = await supabase
    .from('blocks')
    .select('periodo')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  return (data ?? []).map((b) => parsearTstzrange(b.periodo as string))
}

async function franjasDeAtencion(supabase: SupabaseClient): Promise<FranjaHoraria[]> {
  const { data } = await supabase.from('working_hours').select('dia_semana, desde, hasta')
  return (data ?? []).map((f) => ({
    dia_semana: f.dia_semana as number,
    desde: String(f.desde).slice(0, 5),
    hasta: String(f.hasta).slice(0, 5),
  }))
}

/** Valida y guarda. Si viene `id`, mueve ese turno; si no, crea uno nuevo. */
export async function guardarTurno(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const idCrudo = datos.get('id')
  const parseado = esquema.safeParse({
    id: idCrudo ? String(idCrudo) : undefined,
    patient_id: datos.get('patient_id'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    duracion_min: datos.get('duracion_min'),
  })
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }

  const { id, patient_id, fecha, hora, duracion_min } = parseado.data

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

  const fila = {
    professional_id: user.id,
    patient_id,
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

/** Devuelve un turno cancelado al estado programado, si el horario sigue libre. */
export async function reactivarTurno(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()

  await supabase
    .from('appointments')
    .update({ estado: 'programado', cancelado_por: null })
    .eq('id', id)

  revalidatePath('/agenda')
}
