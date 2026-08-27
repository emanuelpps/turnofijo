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
