import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  admin,
  crearProfesionalDePrueba,
  borrarProfesionalDePrueba,
  type ProfesionalDePrueba,
} from './ayudantes'

/** `[inicio, inicio + duración)` en formato tstzrange, con hora local argentina. */
function periodo(fecha: string, hora: string, duracionMin: number): string {
  const inicio = new Date(`${fecha}T${hora}:00-03:00`)
  const fin = new Date(inicio.getTime() + duracionMin * 60_000)
  return `[${inicio.toISOString()},${fin.toISOString()})`
}

describe('appointments: garantías del esquema', () => {
  let ana: ProfesionalDePrueba
  let beto: ProfesionalDePrueba
  let mariaDeAna: string
  let juanDeBeto: string

  beforeAll(async () => {
    ana = await crearProfesionalDePrueba()
    beto = await crearProfesionalDePrueba()

    const { data: maria, error: e1 } = await ana.cliente
      .from('patients')
      .insert({ professional_id: ana.id, nombre: 'María', telefono_e164: '+5492984111111' })
      .select('id')
      .single()
    if (e1) throw new Error(e1.message)
    mariaDeAna = maria.id

    const { data: juan, error: e2 } = await beto.cliente
      .from('patients')
      .insert({ professional_id: beto.id, nombre: 'Juan', telefono_e164: '+5492984222222' })
      .select('id')
      .single()
    if (e2) throw new Error(e2.message)
    juanDeBeto = juan.id

    const { error: e3 } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:00', 50),
    })
    if (e3) throw new Error(e3.message)
  })

  afterAll(async () => {
    await borrarProfesionalDePrueba(ana)
    await borrarProfesionalDePrueba(beto)
  })

  it('la base RECHAZA un turno superpuesto', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:30', 50),
    })
    expect(error?.code).toBe('23P01')
  })

  it('ACEPTA un turno pegado, sin hueco', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-01', '15:50', 50),
    })
    expect(error).toBeNull()
  })

  it('ACEPTA superponerse con un turno cancelado', async () => {
    const { data: cancelado } = await ana.cliente
      .from('appointments')
      .insert({
        professional_id: ana.id,
        patient_id: mariaDeAna,
        periodo: periodo('2026-09-02', '10:00', 50),
      })
      .select('id')
      .single()

    await ana.cliente
      .from('appointments')
      .update({ estado: 'cancelado', cancelado_por: 'paciente' })
      .eq('id', cancelado!.id)

    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: mariaDeAna,
      periodo: periodo('2026-09-02', '10:00', 50),
    })
    expect(error).toBeNull()
  })

  it('dos profesionales SÍ pueden tener turnos en el mismo horario', async () => {
    const { error } = await beto.cliente.from('appointments').insert({
      professional_id: beto.id,
      patient_id: juanDeBeto,
      periodo: periodo('2026-09-01', '15:00', 50),
    })
    expect(error).toBeNull()
  })

  it('RECHAZA agendar con el paciente de otro profesional', async () => {
    const { error } = await ana.cliente.from('appointments').insert({
      professional_id: ana.id,
      patient_id: juanDeBeto,
      periodo: periodo('2026-09-03', '09:00', 50),
    })
    expect(error).not.toBeNull()
  })

  it('Beto NO ve los turnos de Ana', async () => {
    const { data } = await beto.cliente.from('appointments').select('id, patient_id')
    expect(data?.every((t) => t.patient_id === juanDeBeto)).toBe(true)
  })

  it('NO deja borrar un paciente que tiene turnos', async () => {
    const { error } = await ana.cliente.from('patients').delete().eq('id', mariaDeAna)
    expect(error?.code).toBe('23503')
  })

  it('el trigger actualiza actualizado_en al modificar', async () => {
    const { data: antes } = await admin
      .from('appointments')
      .select('id, actualizado_en')
      .eq('professional_id', ana.id)
      .limit(1)
      .single()

    await new Promise((r) => setTimeout(r, 1100))
    await ana.cliente.from('appointments').update({ estado: 'confirmado' }).eq('id', antes!.id)

    const { data: despues } = await admin
      .from('appointments')
      .select('actualizado_en')
      .eq('id', antes!.id)
      .single()

    expect(new Date(despues!.actualizado_en).getTime()).toBeGreaterThan(
      new Date(antes!.actualizado_en).getTime(),
    )
  })
})
