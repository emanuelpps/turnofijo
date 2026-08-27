'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId } from 'react'
import { guardarTurno, type EstadoFormulario } from '@/acciones/turnos'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL_ANCHO } from '@/componentes/ui/estilos'
import type { Paciente } from '@/tipos/db'

export type TurnoEnEdicion = {
  id?: string
  patient_id?: string
  /** Solo se usa si el paciente está archivado y no viene en la lista. */
  nombrePaciente?: string
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

  // Único por instancia: la agenda deja montados el formulario de alta y el de
  // mover, y con ids fijos las etiquetas apuntarían siempre al primero.
  const base = useId()
  const idPaciente = `${base}-paciente`
  const idFecha = `${base}-fecha`
  const idHora = `${base}-hora`
  const idDuracion = `${base}-duracion`

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  if (pacientes.length === 0 && !turno.id) {
    return (
      <div className="space-y-4">
        <p className="text-tinta-sup">
          Para agendar un turno primero necesitás tener un paciente cargado.
        </p>
        <Link href="/pacientes" className="block">
          <Boton tamano="grande" className="w-full">
            Cargar un paciente
          </Boton>
        </Link>
      </div>
    )
  }

  // Un paciente archivado sigue teniendo sus turnos en la agenda, pero no
  // aparece en la lista. Sin esta opción, mover uno de esos turnos era
  // imposible: el select caía en vacío y el navegador bloqueaba el envío.
  const archivado = turno.patient_id && !pacientes.some((p) => p.id === turno.patient_id)

  return (
    <form action={accion} className="space-y-4">
      {turno.id && <input type="hidden" name="id" value={turno.id} />}

      <div>
        <label htmlFor={idPaciente} className="mb-1 block text-sm font-medium text-tinta-sup">
          Paciente
        </label>
        <select
          id={idPaciente}
          name="patient_id"
          defaultValue={turno.patient_id ?? ''}
          required
          className={CONTROL_ANCHO}
        >
          <option value="" disabled>
            Elegí un paciente
          </option>
          {archivado && (
            <option value={turno.patient_id}>
              {turno.nombrePaciente ?? 'Paciente'} (archivado)
            </option>
          )}
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-36 flex-1">
          <label htmlFor={idFecha} className="mb-1 block text-sm font-medium text-tinta-sup">
            Fecha
          </label>
          <input
            id={idFecha}
            type="date"
            name="fecha"
            defaultValue={turno.fecha}
            required
            className={CONTROL_ANCHO}
          />
        </div>
        <div className="w-28">
          <label htmlFor={idHora} className="mb-1 block text-sm font-medium text-tinta-sup">
            Hora
          </label>
          <input
            id={idHora}
            type="time"
            name="hora"
            step={300}
            defaultValue={turno.hora}
            required
            className={`tabular ${CONTROL_ANCHO}`}
          />
        </div>
        <div className="w-24">
          <label htmlFor={idDuracion} className="mb-1 block text-sm font-medium text-tinta-sup">
            Minutos
          </label>
          <input
            id={idDuracion}
            type="number"
            name="duracion_min"
            min={5}
            max={480}
            step={5}
            defaultValue={turno.duracion_min}
            required
            className={`tabular ${CONTROL_ANCHO}`}
          />
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta">
          {estado.error}
        </p>
      )}

      <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
        {pendiente ? 'Guardando…' : turno.id ? 'Mover turno' : 'Agendar'}
      </Boton>
    </form>
  )
}
