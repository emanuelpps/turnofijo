'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { aTstzrange, localAUtc, parsearTstzrange } from '@/lib/tiempo'
import { dentroDeHorarioDeAtencion } from '@/lib/horarios'

export type EstadoFormulario = { error?: string; ok?: boolean; aviso?: string }

const DIAS = [0, 1, 2, 3, 4, 5, 6] as const
const BLOQUES = ['manana', 'tarde'] as const

type FranjaNueva = { dia_semana: number; desde: string; hasta: string }

export async function guardarConfiguracion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const duracion = Number(datos.get('duracion_default_min'))
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { error: 'La duración por defecto tiene que estar entre 5 y 480 minutos.' }
  }

  const franjas: FranjaNueva[] = []

  for (const dia of DIAS) {
    for (const bloque of BLOQUES) {
      const desde = String(datos.get(`d${dia}_${bloque}_desde`) ?? '').trim()
      const hasta = String(datos.get(`d${dia}_${bloque}_hasta`) ?? '').trim()

      if (!desde && !hasta) continue
      if (!desde || !hasta) {
        return { error: `Faltan datos en una de las franjas: cargá desde y hasta, o dejá las dos vacías.` }
      }
      if (hasta <= desde) {
        return { error: `Una franja termina antes de empezar. Revisá los horarios.` }
      }
      franjas.push({ dia_semana: dia, desde, hasta })
    }
  }

  // Dos franjas del mismo día no se pueden pisar.
  for (const dia of DIAS) {
    const delDia = franjas.filter((f) => f.dia_semana === dia).sort((a, b) => (a.desde < b.desde ? -1 : 1))
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].desde < delDia[i - 1].hasta) {
        return { error: 'Tenés dos franjas del mismo día que se pisan.' }
      }
    }
  }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const { error: errorDuracion } = await supabase
    .from('professionals')
    .update({ duracion_default_min: duracion })
    .eq('id', user.id)
  if (errorDuracion) return { error: 'No se pudo guardar la duración por defecto.' }

  const { error: errorHorarios } = await supabase.rpc('reemplazar_horarios', { franjas })
  if (errorHorarios) return { error: 'No se pudieron guardar los horarios.' }

  revalidatePath('/configuracion')
  revalidatePath('/agenda')

  // Achicar un horario no cancela los turnos que ya estaban adentro. Igual que
  // con los bloqueos, el profesional tiene que enterarse acá y no por un turno
  // que aparece a una hora que ya no atiende.
  const { data: futuros } = await supabase
    .from('appointments')
    .select('periodo')
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', `[${new Date().toISOString()},)`)

  const afuera = (futuros ?? []).filter((t) => {
    const { inicio, fin } = parsearTstzrange(t.periodo as string)
    const duracionMin = Math.round((fin.getTime() - inicio.getTime()) / 60_000)
    return !dentroDeHorarioDeAtencion(inicio, duracionMin, franjas)
  }).length

  if (afuera > 0) {
    return {
      ok: true,
      aviso:
        afuera === 1
          ? 'Ojo: 1 turno que ya tenías agendado queda fuera de estos horarios. No se canceló.'
          : `Ojo: ${afuera} turnos que ya tenías agendados quedan fuera de estos horarios. No se cancelaron.`,
    }
  }

  return { ok: true }
}

/**
 * El nombre se toma del registro y hasta acá no había forma de corregirlo:
 * un error de tipeo al crear la cuenta quedaba para siempre en la pantalla.
 */
export async function guardarPerfil(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombre = String(datos.get('nombre') ?? '').trim()
  const especialidad = String(datos.get('especialidad') ?? '')

  if (nombre.length < 2) {
    return { error: 'Poné tu nombre.' }
  }
  if (!['psicologia', 'nutricion', 'otra'].includes(especialidad)) {
    return { error: 'Elegí una especialidad.' }
  }

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const { error } = await supabase
    .from('professionals')
    .update({ nombre, especialidad })
    .eq('id', user.id)

  if (error) return { error: 'No se pudieron guardar tus datos.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function crearBloqueo(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const desde = String(datos.get('desde') ?? '')
  const hasta = String(datos.get('hasta') ?? '')
  const motivo = String(datos.get('motivo') ?? '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { error: 'Elegí las dos fechas.' }
  }
  if (hasta < desde) {
    return { error: 'La fecha de fin es anterior a la de inicio.' }
  }

  // El bloqueo cubre días completos: desde las 00:00 del primer día hasta las
  // 00:00 del día siguiente al último.
  const inicio = localAUtc(desde, '00:00')
  const finExclusivo = new Date(localAUtc(hasta, '00:00').getTime() + 24 * 60 * 60 * 1000)

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Se cerró tu sesión. Entrá de nuevo.' }

  const { error } = await supabase.from('blocks').insert({
    professional_id: user.id,
    periodo: aTstzrange(inicio, finExclusivo),
    motivo,
  })
  if (error) return { error: 'No se pudo guardar el bloqueo.' }

  // El bloqueo no cancela turnos ya agendados, pero el profesional tiene que
  // enterarse de que quedaron adentro.
  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', aTstzrange(inicio, finExclusivo))

  revalidatePath('/configuracion')
  revalidatePath('/agenda')

  if (count && count > 0) {
    return {
      ok: true,
      aviso:
        count === 1
          ? 'Ojo: quedó 1 turno agendado adentro de ese bloqueo. No se canceló solo.'
          : `Ojo: quedaron ${count} turnos agendados adentro de ese bloqueo. No se cancelaron solos.`,
    }
  }

  return { ok: true }
}

export async function borrarBloqueo(datos: FormData) {
  const id = String(datos.get('id'))
  const supabase = await crearClienteServidor()
  await supabase.from('blocks').delete().eq('id', id)
  revalidatePath('/configuracion')
  revalidatePath('/agenda')
}
