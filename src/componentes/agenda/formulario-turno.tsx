'use client'

import { useActionState, useEffect } from 'react'
import { guardarTurno, type EstadoFormulario } from '@/acciones/turnos'
import { Boton } from '@/componentes/ui/boton'
import type { Paciente } from '@/tipos/db'

export type TurnoEnEdicion = {
  id?: string
  patient_id?: string
  fecha: string
  hora: string
  duracion_min: number
}

export function FormularioTurno({
  turno,
  pacientes,
  onGuardado,
}: {
  turno: TurnoEnEdicion
  pacientes: Paciente[]
  onGuardado: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarTurno, {})

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  return (
    <form action={accion} className="space-y-4">
      {turno.id && <input type="hidden" name="id" value={turno.id} />}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">Paciente</span>
        <select
          name="patient_id"
          defaultValue={turno.patient_id ?? ''}
          required
          className="block w-full min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base"
        >
          <option value="" disabled>
            Elegí un paciente
          </option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={turno.fecha}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Hora</span>
          <input
            type="time"
            name="hora"
            step={300}
            defaultValue={turno.hora}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Minutos</span>
          <input
            type="number"
            name="duracion_min"
            min={5}
            max={480}
            step={5}
            defaultValue={turno.duracion_min}
            required
            className="block w-full min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
      </div>

      {pacientes.length === 0 && (
        <p className="text-sm text-amber-800">
          Todavía no cargaste pacientes. Andá a Pacientes y cargá uno primero.
        </p>
      )}
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente || pacientes.length === 0}>
          {pendiente ? 'Guardando…' : turno.id ? 'Mover turno' : 'Agendar'}
        </Boton>
      </div>
    </form>
  )
}
