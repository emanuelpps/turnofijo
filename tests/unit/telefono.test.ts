import { describe, it, expect } from 'vitest'
import { normalizarTelefonoAR, formatearTelefonoParaMostrar } from '../../src/lib/telefono'

describe('normalizarTelefonoAR', () => {
  it('acepta un número nacional de 10 dígitos', () => {
    expect(normalizarTelefonoAR('2984123456')).toBe('+5492984123456')
  })

  it('acepta Buenos Aires con código de área de 2 dígitos', () => {
    expect(normalizarTelefonoAR('1145678901')).toBe('+5491145678901')
  })

  it('saca el 0 inicial y el 15 después del código de área', () => {
    expect(normalizarTelefonoAR('02984 15-123456')).toBe('+5492984123456')
  })

  it('saca el 0 y el 15 con código de área de 2 dígitos', () => {
    expect(normalizarTelefonoAR('011 15 4567-8901')).toBe('+5491145678901')
  })

  it('acepta el formato internacional completo con 9', () => {
    expect(normalizarTelefonoAR('+54 9 2984 12-3456')).toBe('+5492984123456')
  })

  it('acepta el internacional sin el 9 y se lo agrega', () => {
    expect(normalizarTelefonoAR('+54 2984 123456')).toBe('+5492984123456')
  })

  it('ignora espacios, guiones, puntos y paréntesis', () => {
    expect(normalizarTelefonoAR(' (0298) 4.12-34.56 ')).toBe('+5492984123456')
  })

  it('es idempotente sobre un número ya normalizado', () => {
    expect(normalizarTelefonoAR('+5492984123456')).toBe('+5492984123456')
  })

  it('devuelve null si tiene menos de 10 dígitos', () => {
    expect(normalizarTelefonoAR('412-3456')).toBeNull()
  })

  it('devuelve null si tiene de más y no es por el 15', () => {
    expect(normalizarTelefonoAR('298412345678')).toBeNull()
  })

  it('devuelve null con texto vacío', () => {
    expect(normalizarTelefonoAR('   ')).toBeNull()
  })

  it('devuelve null para un número de otro país', () => {
    expect(normalizarTelefonoAR('+1 415 555 2671')).toBeNull()
  })
})

describe('formatearTelefonoParaMostrar', () => {
  it('muestra el E.164 en formato legible', () => {
    expect(formatearTelefonoParaMostrar('+5492984123456')).toBe('+54 9 2984 12-3456')
  })

  it('devuelve el original si no matchea el patrón esperado', () => {
    expect(formatearTelefonoParaMostrar('+34600123456')).toBe('+34600123456')
  })
})
