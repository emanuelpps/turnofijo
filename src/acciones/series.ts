'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { bloqueosQueChocan, franjasDeAtencion, turnosQueChocan } from '@/lib/agenda-datos'
import { localAUtc, sumarDias } from '@/lib/tiempo'
import { validarTurno, type MotivoRechazo } from '@/lib/validar-turno'

/** Ocho semanas: el horizonte rodante del diseño (§5). */
const DIAS_DE_HORIZONTE = 56

export type OcurrenciaPrevia = {
  fecha: string
  hora: string
  libre: boolean
  motivo?: MotivoRechazo
}

export type EstadoSerie = {
  error?: string
  ocurrencias?: OcurrenciaPrevia[]
  creada?: boolean
  cantidadCreada?: number
}

const esquema = z.object({
  patient_id: z.string().uuid('Elegí un paciente.'),
  dia_semana: z.coerce.number().int().min(0).max(6),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elegí una hora.'),
  duracion_min: z.coerce.number().int().min(5).max(480),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']),
  indefinida: z.coerce.boolean(),
  sesiones_totales: z.coerce.number().int().min(1).max(200).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí desde cuándo.'),
})

type Parametros = z.infer<typeof esquema>

function leerFormulario(datos: FormData) {
  return esquema.safeParse({
    patient_id: datos.get('patient_id'),
    dia_semana: datos.get('dia_semana'),
    hora: datos.get('hora'),
    duracion_min: datos.get('duracion_min'),
    frecuencia: datos.get('frecuencia'),
    indefinida: datos.get('indefinida') === 'on',
    sesiones_totales: datos.get('sesiones_totales') || undefined,
    desde: datos.get('desde'),
  })
}

/**
 * Calcula las ocurrencias y valida cada una contra horarios, bloqueos y turnos
 * existentes. No escribe nada.
 */
async function previsualizar(p: Parametros): Promise<OcurrenciaPrevia[] | { error: string }> {
  const supabase = await crearClienteServidor()
  const sesiones = p.indefinida ? null : (p.sesiones_totales ?? null)

  if (!p.indefinida && sesiones === null) {
    return { error: 'Decime cuántas sesiones, o marcá que es indefinida.' }
  }

  const horizonte = sumarDias(p.desde, DIAS_DE_HORIZONTE)

  const { data: fechas, error } = await supabase.rpc('generar_ocurrencias', {
    p_desde: p.desde,
    p_dia_semana: p.dia_semana,
    p_frecuencia: p.frecuencia,
    p_sesiones_totales: sesiones,
    p_hasta: horizonte,
  })
  if (error) return { error: 'No se pudieron calcular las fechas de la serie.' }

  const listaFechas = ((fechas ?? []) as string[]).map((f) => f.slice(0, 10))
  if (listaFechas.length === 0) {
    return { error: 'Con esos datos no cae ninguna sesión. Revisá el día y la fecha de inicio.' }
  }

  // Una sola consulta por tabla para toda la serie, no una por ocurrencia.
  const rangoCompleto = {
    inicio: localAUtc(p.desde, '00:00'),
    fin: localAUtc(sumarDias(horizonte, 1), '00:00'),
  }

  const [franjas, bloqueos, turnos] = await Promise.all([
    franjasDeAtencion(supabase),
    bloqueosQueChocan(supabase, rangoCompleto),
    turnosQueChocan(supabase, rangoCompleto),
  ])

  return listaFechas.map((fecha) => {
    const inicio = localAUtc(fecha, p.hora)
    const validacion = validarTurno({
      inicio,
      duracionMin: p.duracion_min,
      franjas,
      bloqueos,
      turnosExistentes: turnos,
    })
    return validacion.ok
      ? { fecha, hora: p.hora, libre: true }
      : { fecha, hora: p.hora, libre: false, motivo: validacion.motivo }
  })
}

/**
 * Un solo action para los dos botones del formulario. Sin `confirmar`, muestra
 * la vista previa; con `confirmar`, crea. La vista previa se recalcula del lado
 * del servidor antes de escribir: lo que mandó el navegador no se usa para decidir.
 */
export async function previsualizarOCrearSerie(
  _estado: EstadoSerie,
  datos: FormData,
): Promise<EstadoSerie> {
  const parseado = leerFormulario(datos)
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message }
  }
  const p = parseado.data

  const previa = await previsualizar(p)
  if ('error' in previa) return { error: previa.error }

  if (datos.get('confirmar') !== '1') {
    return { ocurrencias: previa }
  }

  const libres = previa.filter((o) => o.libre)
  if (libres.length === 0) {
    return {
      ocurrencias: previa,
      error: 'Ninguna de esas fechas está libre. Probá otro día u horario.',
    }
  }

  const supabase = await crearClienteServidor()
  const inicios = libres.map((o) => localAUtc(o.fecha, o.hora).toISOString())
  const ultima = libres[libres.length - 1].fecha

  const { error } = await supabase.rpc('crear_serie', {
    p_patient_id: p.patient_id,
    p_dia_semana: p.dia_semana,
    p_hora_local: p.hora,
    p_duracion_min: p.duracion_min,
    p_frecuencia: p.frecuencia,
    p_sesiones_totales: p.indefinida ? null : (p.sesiones_totales ?? null),
    p_desde: p.desde,
    p_horizonte_hasta: ultima,
    p_inicios: inicios,
  })

  if (error) {
    if (error.code === '23P01') {
      return { error: 'Alguien ocupó uno de esos horarios recién. Volvé a ver la vista previa.' }
    }
    return { error: 'No se pudo crear la serie.' }
  }

  revalidatePath('/agenda')
  revalidatePath('/hoy')
  return { creada: true, cantidadCreada: libres.length }
}

export async function cancelarSerie(datos: FormData) {
  const id = String(datos.get('serie_id'))
  const supabase = await crearClienteServidor()

  await supabase.rpc('cancelar_serie', { p_serie_id: id })

  revalidatePath('/agenda')
  revalidatePath('/hoy')
}

export async function reprogramarDesde(
  _estado: { error?: string; ok?: boolean; creadas?: number },
  datos: FormData,
): Promise<{ error?: string; ok?: boolean; creadas?: number }> {
  const appointment_id = String(datos.get('appointment_id'))
  const fecha = String(datos.get('fecha'))
  const hora = String(datos.get('hora'))

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: 'Elegí una fecha y una hora.' }
  }

  const nuevoDiaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('reprogramar_serie_desde', {
    p_appointment_id: appointment_id,
    p_nuevo_dia_semana: nuevoDiaSemana,
    p_nueva_hora: hora,
    p_desde: fecha,
  })

  if (error) return { error: 'No se pudo reprogramar la serie.' }

  revalidatePath('/agenda')
  revalidatePath('/hoy')

  const creadas = Array.isArray(data) ? (data[0]?.creadas ?? 0) : 0
  return { ok: true, creadas }
}
