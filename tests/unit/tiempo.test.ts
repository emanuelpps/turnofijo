import { describe, it, expect } from 'vitest'
import {
  localAUtc,
  utcALocal,
  minutosLocales,
  diaSemanaLocal,
  sumarMinutos,
  aTstzrange,
  parsearTstzrange,
  sumarDias,
  lunesDeLaSemana,
} from '../../src/lib/tiempo'

describe('localAUtc', () => {
  it('convierte hora local argentina a UTC sumando 3 horas', () => {
    expect(localAUtc('2026-08-24', '15:00').toISOString()).toBe('2026-08-24T18:00:00.000Z')
  })

  it('cruza al día siguiente en UTC cuando la hora local es tarde', () => {
    expect(localAUtc('2026-08-24', '22:30').toISOString()).toBe('2026-08-25T01:30:00.000Z')
  })

  it('no aplica horario de verano en enero (Argentina no tiene)', () => {
    expect(localAUtc('2027-01-15', '09:00').toISOString()).toBe('2027-01-15T12:00:00.000Z')
  })

  it('rechaza una hora inválida', () => {
    expect(() => localAUtc('2026-08-24', '99:99')).toThrow()
  })
})

describe('utcALocal', () => {
  it('es la inversa de localAUtc', () => {
    const d = localAUtc('2026-08-24', '15:00')
    expect(utcALocal(d)).toEqual({ fecha: '2026-08-24', hora: '15:00' })
  })

  it('devuelve el día local anterior cuando el instante UTC ya pasó a la madrugada', () => {
    expect(utcALocal(new Date('2026-08-25T01:30:00.000Z'))).toEqual({
      fecha: '2026-08-24',
      hora: '22:30',
    })
  })
})

describe('minutosLocales y diaSemanaLocal', () => {
  it('devuelve los minutos desde la medianoche local', () => {
    expect(minutosLocales(localAUtc('2026-08-24', '15:30'))).toBe(930)
  })

  it('devuelve el día de la semana local, 0 = domingo', () => {
    // 2026-08-24 es lunes
    expect(diaSemanaLocal(localAUtc('2026-08-24', '15:00'))).toBe(1)
  })

  it('usa el día local, no el UTC, cerca de la medianoche', () => {
    // 22:30 del lunes local = 01:30 UTC del martes
    expect(diaSemanaLocal(localAUtc('2026-08-24', '22:30'))).toBe(1)
  })
})

describe('sumarMinutos', () => {
  it('suma minutos sin tocar el resto', () => {
    const d = localAUtc('2026-08-24', '15:00')
    expect(utcALocal(sumarMinutos(d, 50)).hora).toBe('15:50')
  })
})

describe('aTstzrange y parsearTstzrange', () => {
  it('arma un rango semiabierto en formato Postgres', () => {
    const inicio = localAUtc('2026-08-24', '15:00')
    const fin = sumarMinutos(inicio, 50)
    expect(aTstzrange(inicio, fin)).toBe('[2026-08-24T18:00:00.000Z,2026-08-24T18:50:00.000Z)')
  })

  it('parsea el formato que devuelve Postgres', () => {
    const r = parsearTstzrange('["2026-08-24 18:00:00+00","2026-08-24 18:50:00+00")')
    expect(r.inicio.toISOString()).toBe('2026-08-24T18:00:00.000Z')
    expect(r.fin.toISOString()).toBe('2026-08-24T18:50:00.000Z')
  })

  it('parsea también el formato ISO que genera aTstzrange', () => {
    const r = parsearTstzrange('[2026-08-24T18:00:00.000Z,2026-08-24T18:50:00.000Z)')
    expect(r.fin.toISOString()).toBe('2026-08-24T18:50:00.000Z')
  })

  it('falla ruidosamente si el rango no se reconoce', () => {
    expect(() => parsearTstzrange('cualquier cosa')).toThrow()
  })
})

describe('sumarDias', () => {
  it('suma días dentro del mismo mes', () => {
    expect(sumarDias('2026-08-24', 3)).toBe('2026-08-27')
  })

  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('resta días cruzando el fin de mes', () => {
    expect(sumarDias('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('cruza el año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('lunesDeLaSemana', () => {
  it('devuelve el mismo día si ya es lunes', () => {
    expect(lunesDeLaSemana('2026-08-24')).toBe('2026-08-24')
  })

  it('retrocede desde un miércoles', () => {
    expect(lunesDeLaSemana('2026-08-26')).toBe('2026-08-24')
  })

  it('el domingo pertenece a la semana que arranca el lunes anterior', () => {
    expect(lunesDeLaSemana('2026-08-30')).toBe('2026-08-24')
  })
})
