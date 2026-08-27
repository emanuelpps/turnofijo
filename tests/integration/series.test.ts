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
