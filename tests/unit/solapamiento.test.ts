import { describe, it, expect } from 'vitest'
import { seSolapan, chocaConAlguno } from '../../src/lib/solapamiento'
import { localAUtc, sumarMinutos } from '../../src/lib/tiempo'

function periodo(hora: string, duracionMin: number) {
  const inicio = localAUtc('2026-08-24', hora)
  return { inicio, fin: sumarMinutos(inicio, duracionMin) }
}

describe('seSolapan', () => {
  it('detecta superposición parcial', () => {
    expect(seSolapan(periodo('15:00', 50), periodo('15:30', 50))).toBe(true)
  })

  it('detecta contención completa', () => {
    expect(seSolapan(periodo('15:00', 90), periodo('15:20', 20))).toBe(true)
  })

  it('NO considera solapados dos turnos pegados: el rango es [inicio, fin)', () => {
    expect(seSolapan(periodo('15:00', 50), periodo('15:50', 50))).toBe(false)
  })

  it('no se solapan si están separados', () => {
    expect(seSolapan(periodo('09:00', 50), periodo('18:00', 50))).toBe(false)
  })

  it('es simétrica', () => {
    const a = periodo('15:00', 50)
    const b = periodo('15:30', 50)
    expect(seSolapan(a, b)).toBe(seSolapan(b, a))
  })
})

describe('chocaConAlguno', () => {
  it('es falso con la lista vacía', () => {
    expect(chocaConAlguno(periodo('15:00', 50), [])).toBe(false)
  })

  it('encuentra el choque aunque esté al final de la lista', () => {
    const otros = [periodo('09:00', 50), periodo('11:00', 50), periodo('15:20', 50)]
    expect(chocaConAlguno(periodo('15:00', 50), otros)).toBe(true)
  })

  it('es falso si ninguno choca', () => {
    const otros = [periodo('09:00', 50), periodo('16:00', 50)]
    expect(chocaConAlguno(periodo('15:00', 50), otros)).toBe(false)
  })
})
