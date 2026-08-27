import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

function inicio(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString()
}

describe('crear_serie', () => {
  let ana: ProfesionalDePrueba
  let maria: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    const { data, error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María', telefono_e164: '+5492984111111' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    maria = data.id
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
  })

  const parametrosBase = {
    p_dia_semana: 2,
    p_hora_local: '15:00',
    p_duracion_min: 50,
    p_frecuencia: 'semanal',
    p_sesiones_totales: 4,
    p_desde: '2026-08-24',
    p_horizonte_hasta: '2026-09-15',
  }

  it('crea la serie y sus cuatro turnos', async () => {
    const { data: serieId, error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_inicios: [
        inicio('2026-08-25', '15:00'),
        inicio('2026-09-01', '15:00'),
        inicio('2026-09-08', '15:00'),
        inicio('2026-09-15', '15:00'),
      ],
    })

    expect(error).toBeNull()
    expect(serieId).toBeTruthy()

    const { count } = await ana.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', serieId as string)

    expect(count).toBe(4)
  })

  it('NO deja nada creado si un turno choca (todo o nada)', async () => {
    const { count: seriesAntes } = await ana.cliente
      .from('series')
      .select('id', { count: 'exact', head: true })

    const { error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_hora_local: '15:00',
      p_inicios: [
        inicio('2026-10-06', '15:00'),
        // Éste pisa el turno del 2026-09-01 creado en el test anterior.
        inicio('2026-09-01', '15:20'),
      ],
    })

    expect(error?.code).toBe('23P01')

    const { count: seriesDespues } = await ana.cliente
      .from('series')
      .select('id', { count: 'exact', head: true })

    expect(seriesDespues).toBe(seriesAntes)

    const { count: sueltos } = await ana.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .filter('periodo', 'ov', `[${inicio('2026-10-06', '15:00')},${inicio('2026-10-06', '16:00')})`)

    expect(sueltos).toBe(0)
  })

  it('rechaza una serie sin ningún turno', async () => {
    const { error } = await ana.cliente.rpc('crear_serie', {
      ...parametrosBase,
      p_patient_id: maria,
      p_inicios: [],
    })
    expect(error).not.toBeNull()
  })

  it('los turnos de la serie quedan enlazados a ella', async () => {
    const { data } = await ana.cliente
      .from('appointments')
      .select('series_id')
      .not('series_id', 'is', null)
      .limit(1)
      .single()

    expect(data?.series_id).toBeTruthy()
  })
})

describe('horizonte rodante', () => {
  let beto: ProfesionalDePrueba
  let juan: string
  let serieId: string

  beforeAll(async () => {
    beto = await crearProfesionalDePrueba()

    const { data: paciente, error } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Juan', telefono_e164: '+5492984555555' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    juan = paciente.id

    // Serie indefinida materializada a mano con solo dos turnos.
    const { data, error: errorSerie } = await beto.cliente.rpc('crear_serie', {
      p_patient_id: juan,
      p_dia_semana: 3,
      p_hora_local: '09:00',
      p_duracion_min: 30,
      p_frecuencia: 'semanal',
      p_sesiones_totales: null,
      p_desde: '2027-03-03',
      p_horizonte_hasta: '2027-03-10',
      p_inicios: [
        new Date('2027-03-03T09:00:00-03:00').toISOString(),
        new Date('2027-03-10T09:00:00-03:00').toISOString(),
      ],
    })
    if (errorSerie) throw new Error(errorSerie.message)
    serieId = data as unknown as string
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(beto)
  })

  it('un profesional NO puede llamar a materializar_serie', async () => {
    const { error } = await beto.cliente.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(error).not.toBeNull()
  })

  it('extiende la serie hasta el horizonte pedido', async () => {
    const { data: creadas, error } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(error).toBeNull()
    // Del 17/3 al 28/4 hay 7 miércoles.
    expect(creadas).toBe(7)
  })

  it('es idempotente: correrlo de nuevo no crea nada', async () => {
    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-04-28',
    })
    expect(creadas).toBe(0)
  })

  it('saltea las fechas que caen en un bloqueo', async () => {
    await beto.cliente.from('blocks').insert({
      professional_id: beto.id,
      periodo: `[${new Date('2027-05-05T00:00:00-03:00').toISOString()},${new Date('2027-05-06T00:00:00-03:00').toISOString()})`,
      motivo: 'Feriado',
    })

    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-05-12',
    })
    // 5/5 bloqueado: la única que entra es el 12/5.
    expect(creadas).toBe(1)

    const { count } = await beto.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', serieId)
      .filter(
        'periodo',
        'ov',
        `[${new Date('2027-05-05T00:00:00-03:00').toISOString()},${new Date('2027-05-06T00:00:00-03:00').toISOString()})`,
      )
    expect(count).toBe(0)
  })

  it('no toca una serie cancelada', async () => {
    await beto.cliente.from('series').update({ estado: 'cancelada' }).eq('id', serieId)

    const { data: creadas } = await admin.rpc('materializar_serie', {
      p_serie_id: serieId,
      p_hasta: '2027-06-30',
    })
    expect(creadas).toBe(0)
  })
})

describe('reprogramar de acá en adelante y cancelar serie', () => {
  let carla: ProfesionalDePrueba
  let otro: ProfesionalDePrueba
  let paciente: string
  let serieId: string
  let turnos: { id: string; periodo: string }[]

  beforeAll(async () => {
    carla = await crearProfesionalDePrueba()
    otro = await crearProfesionalDePrueba()

    const { data: p, error } = await carla.cliente
      .from('patients')
      .insert({ professional_id: carla.id, nombre: 'Sofía', telefono_e164: '+5492984777777' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    paciente = p.id

    // Cuatro jueves de 2028, 10:00.
    const fechas = ['2028-03-02', '2028-03-09', '2028-03-16', '2028-03-23']
    const { data: id, error: e } = await carla.cliente.rpc('crear_serie', {
      p_patient_id: paciente,
      p_dia_semana: 4,
      p_hora_local: '10:00',
      p_duracion_min: 50,
      p_frecuencia: 'semanal',
      p_sesiones_totales: 4,
      p_desde: '2028-03-02',
      p_horizonte_hasta: '2028-03-23',
      p_inicios: fechas.map((f) => inicio(f, '10:00')),
    })
    if (e) throw new Error(e.message)
    serieId = id as unknown as string

    const { data: creados } = await carla.cliente
      .from('appointments')
      .select('id, periodo')
      .eq('series_id', serieId)
      .order('periodo')
    turnos = (creados ?? []) as { id: string; periodo: string }[]
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(carla)
    await borrarProfesionalDePrueba(otro)
  })

  it('otro profesional NO puede reprogramar una serie ajena', async () => {
    const { error } = await otro.cliente.rpc('reprogramar_serie_desde', {
      p_appointment_id: turnos[0].id,
      p_nuevo_dia_semana: 2,
      p_nueva_hora: '18:00',
      p_desde: '2028-03-14',
    })
    expect(error).not.toBeNull()
  })

  it('marca el primer turno como asistido y ese no se toca nunca más', async () => {
    await carla.cliente.from('appointments').update({ estado: 'asistio' }).eq('id', turnos[0].id)

    const { error } = await carla.cliente.rpc('reprogramar_serie_desde', {
      p_appointment_id: turnos[1].id,
      p_nuevo_dia_semana: 2, // martes
      p_nueva_hora: '18:00',
      p_desde: '2028-03-14',
    })
    expect(error).toBeNull()

    const { data: viejo } = await carla.cliente
      .from('appointments')
      .select('estado')
      .eq('id', turnos[0].id)
      .single()
    expect(viejo?.estado).toBe('asistio')
  })

  it('la serie vieja queda finalizada', async () => {
    const { data } = await carla.cliente.from('series').select('estado').eq('id', serieId).single()
    expect(data?.estado).toBe('finalizada')
  })

  it('los turnos futuros pasan al día y la hora nuevos', async () => {
    const { data } = await carla.cliente
      .from('series')
      .select('id, dia_semana, hora_local, sesiones_totales')
      .eq('estado', 'activa')
      .eq('professional_id', carla.id)
      .single()

    expect(data?.dia_semana).toBe(2)
    expect(String(data?.hora_local).slice(0, 5)).toBe('18:00')
    // Quedaba una sesión consumida (la que asistió): restan 3.
    expect(data?.sesiones_totales).toBe(3)

    const { count } = await carla.cliente
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', data!.id)
    expect(count).toBe(3)
  })

  it('cancelar_serie cancela los futuros y marca la serie', async () => {
    const { data: activa } = await carla.cliente
      .from('series')
      .select('id')
      .eq('estado', 'activa')
      .eq('professional_id', carla.id)
      .single()

    const { data: cancelados, error } = await carla.cliente.rpc('cancelar_serie', {
      p_serie_id: activa!.id,
    })
    expect(error).toBeNull()
    expect(cancelados).toBe(3)

    const { data: serie } = await carla.cliente
      .from('series')
      .select('estado')
      .eq('id', activa!.id)
      .single()
    expect(serie?.estado).toBe('cancelada')
  })

  it('el turno asistido sigue intacto después de cancelar la serie', async () => {
    const { data } = await carla.cliente
      .from('appointments')
      .select('estado')
      .eq('id', turnos[0].id)
      .single()
    expect(data?.estado).toBe('asistio')
  })
})
