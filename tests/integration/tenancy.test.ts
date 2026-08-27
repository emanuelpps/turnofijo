import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  clienteAnonimo,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

describe('tenancy de professionals', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('el trigger crea la fila de professionals al registrarse', async () => {
    const { data, error } = await admin
      .from('professionals')
      .select('id, email, duracion_default_min')
      .eq('id', ana.id)
      .single()

    expect(error).toBeNull()
    expect(data?.email).toBe(ana.email)
    expect(data?.duracion_default_min).toBe(50)
  })

  it('cada profesional ve su propia fila', async () => {
    const { data } = await ana.cliente.from('professionals').select('id')
    expect(data).toEqual([{ id: ana.id }])
  })

  it('NO ve la fila del otro profesional aunque la pida por id', async () => {
    const { data } = await ana.cliente.from('professionals').select('id').eq('id', beto.id)
    expect(data).toEqual([])
  })

  it('NO puede modificar la fila del otro profesional', async () => {
    await ana.cliente.from('professionals').update({ nombre: 'Hackeado' }).eq('id', beto.id)

    const { data } = await admin.from('professionals').select('nombre').eq('id', beto.id).single()
    expect(data?.nombre).toBe('Profesional de prueba')
  })

  it('sí puede modificar la propia', async () => {
    await ana.cliente.from('professionals').update({ nombre: 'Ana Pérez' }).eq('id', ana.id)

    const { data } = await admin.from('professionals').select('nombre').eq('id', ana.id).single()
    expect(data?.nombre).toBe('Ana Pérez')
  })

  it('un cliente sin sesión no ve nada', async () => {
    const { data } = await clienteAnonimo().from('professionals').select('id')
    expect(data).toEqual([])
  })
})
