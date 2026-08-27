import { describe, it, expect } from 'vitest'
import { dentroDeHorarioDeAtencion, franjasDelDia } from '../../src/lib/horarios'
import type { FranjaHoraria } from '../../src/lib/horarios'
import { localAUtc } from '../../src/lib/tiempo'

// 2026-08-24 es lunes (día 1)
const LUNES = '2026-08-24'
const MARTES = '2026-08-25'

const franjas: FranjaHoraria[] = [
  { dia_semana: 1, desde: '09:00', hasta: '13:00' },
  { dia_semana: 1, desde: '15:00', hasta: '20:00' },
  { dia_semana: 2, desde: '09:00', hasta: '13:00' },
]

describe('dentroDeHorarioDeAtencion', () => {
  it('acepta un turno completamente adentro de una franja', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), 50, franjas)).toBe(true)
  })

  it('acepta un turno que termina justo en el borde de la franja', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '19:10'), 50, franjas)).toBe(true)
  })

  it('rechaza un turno que se pasa del cierre', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '19:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que arranca antes de la apertura', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '08:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que cae en el hueco del mediodía', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '13:30'), 50, franjas)).toBe(false)
  })

  it('rechaza un turno que atraviesa el hueco entre dos franjas del mismo día', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '12:30'), 180, franjas)).toBe(false)
  })

  it('rechaza un día sin franjas cargadas', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc('2026-08-30', '10:00'), 50, franjas)).toBe(false)
  })

  it('usa el día local: 22:30 del lunes sigue siendo lunes aunque en UTC sea martes', () => {
    const conNoche: FranjaHoraria[] = [{ dia_semana: 1, desde: '21:00', hasta: '23:00' }]
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '22:00'), 50, conNoche)).toBe(true)
  })

  it('rechaza un turno que cruzaría la medianoche', () => {
    const nocturna: FranjaHoraria[] = [{ dia_semana: 1, desde: '21:00', hasta: '23:59' }]
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '23:30'), 60, nocturna)).toBe(false)
  })

  it('rechaza duración cero o negativa', () => {
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), 0, franjas)).toBe(false)
    expect(dentroDeHorarioDeAtencion(localAUtc(LUNES, '15:00'), -30, franjas)).toBe(false)
  })
})

describe('franjasDelDia', () => {
  it('devuelve solo las franjas del día pedido, ordenadas', () => {
    expect(franjasDelDia(localAUtc(LUNES, '10:00'), franjas)).toEqual([
      { dia_semana: 1, desde: '09:00', hasta: '13:00' },
      { dia_semana: 1, desde: '15:00', hasta: '20:00' },
    ])
  })

  it('devuelve una sola franja para el martes', () => {
    expect(franjasDelDia(localAUtc(MARTES, '10:00'), franjas)).toHaveLength(1)
  })
})
