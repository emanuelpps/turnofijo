'use client'

import { useActionState, useEffect, useId, useState } from 'react'
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

/** Valor centinela del select para dar de alta un paciente sin salir de acá. */
const NUEVO = '__nuevo__'

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
  const idNombre = `${base}-nombre`
  const idTelefono = `${base}-telefono`
  const idFecha = `${base}-fecha`
  const idHora = `${base}-hora`
  const idDuracion = `${base}-duracion`

  // Un paciente archivado sigue teniendo sus turnos en la agenda, pero no
  // aparece en la lista. Sin esta opción, mover uno de esos turnos era
  // imposible: el select caía en vacío y el navegador bloqueaba el envío.
  const archivado = !!turno.patient_id && !pacientes.some((p) => p.id === turno.patient_id)

  // Sin pacientes cargados, el único camino posible es dar de alta uno: no
  // tiene sentido mostrar una lista vacía y mandar a otra pantalla.
  const [elegido, setElegido] = useState<string>(() => {
    if (turno.patient_id) return turno.patient_id
    return pacientes.length === 0 ? NUEVO : ''
  })

  const esNuevo = elegido === NUEVO

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  return (
    <form action={accion} className="space-y-4">
      {turno.id && <input type="hidden" name="id" value={turno.id} />}
      {esNuevo && <input type="hidden" name="paciente_nuevo" value="1" />}

      <div>
        <label htmlFor={idPaciente} className="mb-1 block text-sm font-medium text-tinta-sup">
          Paciente
        </label>
        <select
          id={idPaciente}
          name="patient_id"
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          required
          className={CONTROL_ANCHO}
        >
          <option value="" disabled>
            Elegí un paciente
          </option>
          <option value={NUEVO}>+ Paciente nuevo</option>
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

      {esNuevo && (
        <div className="space-y-3 rounded-marca border border-renglon bg-papel-alt p-3">
          <div>
            <label htmlFor={idNombre} className="mb-1 block text-sm font-medium text-tinta-sup">
              Nombre
            </label>
            <input
              id={idNombre}
              name="paciente_nombre"
              required
              autoComplete="off"
              className={CONTROL_ANCHO}
            />
          </div>
          <div>
            <label htmlFor={idTelefono} className="mb-1 block text-sm font-medium text-tinta-sup">
              Teléfono
            </label>
            <input
              id={idTelefono}
              name="paciente_telefono"
              inputMode="tel"
              placeholder="2984 12-3456"
              required
              autoComplete="off"
              aria-describedby={`${idTelefono}-ayuda`}
              className={CONTROL_ANCHO}
            />
            <span id={`${idTelefono}-ayuda`} className="mt-1 block text-sm text-lapiz">
              Con código de área, sin el 0 ni el 15. Si ya lo tenés cargado, se usa esa ficha.
            </span>
          </div>
        </div>
      )}

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
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta-texto">
          {estado.error}
        </p>
      )}

      <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
        {pendiente ? 'Guardando…' : turno.id ? 'Mover turno' : 'Agendar'}
      </Boton>
    </form>
  )
}
