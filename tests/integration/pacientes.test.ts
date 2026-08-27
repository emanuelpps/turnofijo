import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

describe('pacientes: aislamiento y restricciones', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba
  let pacienteDeAna: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()

    const { data, error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María López', telefono_e164: '+5492984111111' })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    pacienteDeAna = data.id
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('Ana ve su paciente', async () => {
    const { data } = await ana.cliente.from('patients').select('nombre')
    expect(data).toEqual([{ nombre: 'María López' }])
  })

  it('Beto NO ve el paciente de Ana', async () => {
    const { data } = await beto.cliente.from('patients').select('id')
    expect(data).toEqual([])
  })

  it('Beto NO puede leer el paciente de Ana ni pidiéndolo por id', async () => {
    const { data } = await beto.cliente.from('patients').select('id').eq('id', pacienteDeAna)
    expect(data).toEqual([])
  })

  it('Beto NO puede borrar el paciente de Ana', async () => {
    await beto.cliente.from('patients').delete().eq('id', pacienteDeAna)
    const { count } = await admin
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('id', pacienteDeAna)
    expect(count).toBe(1)
  })

  it('Ana NO puede insertar un paciente a nombre de Beto', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Colado', telefono_e164: '+5492984222222' })
    expect(error).not.toBeNull()
  })

  it('rechaza un teléfono que no es E.164', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'Mal Número', telefono_e164: '2984123456' })
    expect(error?.message).toMatch(/telefono_e164/)
  })

  it('rechaza el mismo teléfono dos veces para el mismo profesional', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'Duplicada', telefono_e164: '+5492984111111' })
    expect(error?.code).toBe('23505')
  })

  it('permite el mismo teléfono en dos profesionales distintos', async () => {
    const { error } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'María López', telefono_e164: '+5492984111111' })
    expect(error).toBeNull()
  })

  it('rechaza un nombre vacío', async () => {
    const { error } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: '   ', telefono_e164: '+5492984333333' })
    expect(error).not.toBeNull()
  })
})
