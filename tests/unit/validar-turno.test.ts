import { describe, it, expect } from 'vitest'
import { validarTurno } from '../../src/lib/validar-turno'
import type { FranjaHoraria } from '../../src/lib/horarios'
import { localAUtc, sumarMinutos } from '../../src/lib/tiempo'

const LUNES = '2026-08-24'

const franjas: FranjaHoraria[] = [{ dia_semana: 1, desde: '09:00', hasta: '20:00' }]

function periodo(fecha: string, hora: string, duracionMin: number) {
  const inicio = localAUtc(fecha, hora)
  return { inicio, fin: sumarMinutos(inicio, duracionMin) }
}

const base = {
  inicio: localAUtc(LUNES, '15:00'),
  duracionMin: 50,
  franjas,
  bloqueos: [],
  turnosExistentes: [],
}

describe('validarTurno', () => {
  it('acepta un turno limpio', () => {
    expect(validarTurno(base)).toEqual({ ok: true })
  })

  it('rechaza fuera del horario de atención', () => {
    expect(validarTurno({ ...base, inicio: localAUtc(LUNES, '21:00') })).toEqual({
      ok: false,
      motivo: 'fuera_de_horario',
    })
  })

  it('rechaza si cae dentro de un bloqueo', () => {
    const bloqueos = [periodo(LUNES, '14:00', 240)]
    expect(validarTurno({ ...base, bloqueos })).toEqual({ ok: false, motivo: 'bloqueado' })
  })

  it('rechaza si se superpone con un turno existente', () => {
    const turnosExistentes = [periodo(LUNES, '15:30', 50)]
    expect(validarTurno({ ...base, turnosExistentes })).toEqual({
      ok: false,
      motivo: 'superpuesto',
    })
  })

  it('acepta pegado a un turno existente sin hueco', () => {
    const turnosExistentes = [periodo(LUNES, '15:50', 50)]
    expect(validarTurno({ ...base, turnosExistentes })).toEqual({ ok: true })
  })

  it('reporta primero fuera_de_horario cuando fallan varias cosas a la vez', () => {
    const resultado = validarTurno({
      ...base,
      inicio: localAUtc(LUNES, '21:00'),
      bloqueos: [periodo(LUNES, '20:00', 240)],
      turnosExistentes: [periodo(LUNES, '21:00', 50)],
    })
    expect(resultado).toEqual({ ok: false, motivo: 'fuera_de_horario' })
  })

  it('ignora un bloqueo que termina justo cuando arranca el turno', () => {
    const bloqueos = [periodo(LUNES, '13:00', 120)] // 13:00 a 15:00
    expect(validarTurno({ ...base, bloqueos })).toEqual({ ok: true })
  })
})
