import { describe, it, expect } from 'vitest'
import { admin } from './ayudantes'

async function ocurrencias(args: {
  desde: string
  diaSemana: number
  frecuencia: 'semanal' | 'quincenal' | 'mensual'
  sesiones: number | null
  hasta: string
}): Promise<string[]> {
  const { data, error } = await admin.rpc('generar_ocurrencias', {
    p_desde: args.desde,
    p_dia_semana: args.diaSemana,
    p_frecuencia: args.frecuencia,
    p_sesiones_totales: args.sesiones,
    p_hasta: args.hasta,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}

// 2026-08-24 es lunes. Martes = 2.
const LUNES = '2026-08-24'

describe('generar_ocurrencias', () => {
  it('genera 4 martes seguidos', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 4, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('arranca el mismo día si desde ya cae en el día de la semana pedido', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 1, frecuencia: 'semanal', sesiones: 2, hasta: '2026-12-31' })
    expect(r[0]).toBe(LUNES)
  })

  it('salta al día correcto cuando desde cae después en la semana', async () => {
    // Miércoles 26, pidiendo martes → el martes siguiente
    const r = await ocurrencias({ desde: '2026-08-26', diaSemana: 2, frecuencia: 'semanal', sesiones: 1, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-09-01'])
  })

  it('quincenal avanza de a 14 días', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'quincenal', sesiones: 3, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-08', '2026-09-22'])
  })

  it('mensual avanza de a 28 días y mantiene el día de la semana', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'mensual', sesiones: 3, hasta: '2026-12-31' }),
    ).toEqual(['2026-08-25', '2026-09-22', '2026-10-20'])
  })

  it('una serie indefinida corta en el horizonte', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: null, hasta: '2026-09-15' })
    expect(r).toEqual(['2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('el horizonte manda aunque falten sesiones', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 40, hasta: '2026-09-08' })
    expect(r).toHaveLength(3)
  })

  it('devuelve vacío si el horizonte queda antes de la primera ocurrencia', async () => {
    expect(
      await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 4, hasta: '2026-08-24' }),
    ).toEqual([])
  })

  it('cruza el fin de año sin romperse', async () => {
    const r = await ocurrencias({ desde: '2026-12-21', diaSemana: 1, frecuencia: 'semanal', sesiones: 3, hasta: '2027-12-31' })
    expect(r).toEqual(['2026-12-21', '2026-12-28', '2027-01-04'])
  })

  it('cruza febrero de un año bisiesto', async () => {
    const r = await ocurrencias({ desde: '2028-02-21', diaSemana: 1, frecuencia: 'semanal', sesiones: 3, hasta: '2028-12-31' })
    expect(r).toEqual(['2028-02-21', '2028-02-28', '2028-03-06'])
  })

  it('una sola sesión devuelve una sola fecha', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 2, frecuencia: 'semanal', sesiones: 1, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-08-25'])
  })

  it('el domingo es el día 0 y funciona igual', async () => {
    const r = await ocurrencias({ desde: LUNES, diaSemana: 0, frecuencia: 'semanal', sesiones: 2, hasta: '2026-12-31' })
    expect(r).toEqual(['2026-08-30', '2026-09-06'])
  })
})
