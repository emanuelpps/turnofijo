import { describe, it, expect } from 'vitest'
import { diaCorto, fechaLarga, diaYMes } from '../../src/lib/formato'

// 2026-08-24 es lunes.
describe('diaCorto', () => {
  it('abrevia el día de la semana', () => {
    expect(diaCorto('2026-08-24')).toBe('Lun')
    expect(diaCorto('2026-08-30')).toBe('Dom')
  })

  it('no se corre de día por la zona horaria', () => {
    // Si se parseara como hora local del servidor, un servidor en UTC+X
    // devolvería el día anterior o el siguiente.
    expect(diaCorto('2026-01-01')).toBe('Jue')
  })
})

describe('diaYMes', () => {
  it('devuelve el número de día y el mes con cero adelante', () => {
    expect(diaYMes('2026-08-24')).toBe('24/08')
    expect(diaYMes('2027-01-06')).toBe('06/01')
  })
})

describe('fechaLarga', () => {
  it('escribe la fecha como la diría una persona', () => {
    expect(fechaLarga('2026-08-24')).toBe('lunes 24 de agosto')
  })

  it('cruza el fin de año sin correrse', () => {
    expect(fechaLarga('2026-12-31')).toBe('jueves 31 de diciembre')
  })
})
