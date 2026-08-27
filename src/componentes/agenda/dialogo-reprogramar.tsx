'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { reprogramarDesde } from '@/acciones/series'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL_ANCHO } from '@/componentes/ui/estilos'
import { FormularioTurno } from './formulario-turno'
import type { Paciente } from '@/tipos/db'

type EstadoReprogramar = { error?: string; ok?: boolean; creadas?: number }

export type TurnoAReprogramar = {
  id: string
  patient_id: string
  fecha: string
  hora: string
  duracion_min: number
}

export function DialogoReprogramar({
  turno,
  pacientes,
  onListo,
}: {
  turno: TurnoAReprogramar
  pacientes: Paciente[]
  onListo: () => void
}) {
  const [alcance, setAlcance] = useState<'preguntar' | 'solo_este' | 'en_adelante'>('preguntar')
  const [estado, accion, pendiente] = useActionState<EstadoReprogramar, FormData>(
    reprogramarDesde,
    {},
  )

  // Este diálogo convive montado con el de alta y el de mover suelto.
  const base = useId()
  const idFecha = `${base}-fecha`
  const idHora = `${base}-hora`

  useEffect(() => {
    if (estado.ok) onListo()
  }, [estado.ok, onListo])

  if (alcance === 'preguntar') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-tinta-sup">
          Este turno es parte de una serie. ¿Qué querés cambiar?
        </p>
        <Boton
          variante="secundario"
          tamano="grande"
          className="w-full"
          onClick={() => setAlcance('solo_este')}
        >
          Solo este turno
        </Boton>
        <Boton
          variante="secundario"
          tamano="grande"
          className="w-full"
          onClick={() => setAlcance('en_adelante')}
        >
          Este y todos los que siguen
        </Boton>
        <p className="text-xs text-lapiz">
          &quot;Solo este&quot; para cuando se enfermó una semana. &quot;Todos los que siguen&quot;
          para cuando cambió el horario para siempre.
        </p>
      </div>
    )
  }

  if (alcance === 'solo_este') {
    return (
      <FormularioTurno
        turno={{
          id: turno.id,
          patient_id: turno.patient_id,
          fecha: turno.fecha,
          hora: turno.hora,
          duracion_min: turno.duracion_min,
        }}
        pacientes={pacientes}
        onGuardado={onListo}
      />
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="appointment_id" value={turno.id} />

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor={idFecha} className="mb-1 block text-sm font-medium text-tinta-sup">
            Nueva fecha
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
            className={CONTROL_ANCHO}
          />
        </div>
      </div>

      <p className="rounded-marca bg-espera-sup p-3 text-xs text-espera-texto">
        Los turnos de esta serie que ya pasaron no se tocan. Los que vienen se rehacen con el día y
        la hora nuevos, salteando los que choquen con otro turno o con un bloqueo.
      </p>

      {estado.error && <p className="text-sm text-falta-texto">{estado.error}</p>}

      <div className="flex justify-between gap-3">
        <Boton variante="secundario" onClick={() => setAlcance('preguntar')}>
          Volver
        </Boton>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Reprogramando…' : 'Reprogramar la serie'}
        </Boton>
      </div>
    </form>
  )
}
