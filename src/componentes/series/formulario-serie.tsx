'use client'

import { useActionState, useEffect, useState } from 'react'
import { previsualizarOCrearSerie, type EstadoSerie } from '@/acciones/series'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL_ANCHO } from '@/componentes/ui/estilos'
import { VistaPreviaSerie } from './vista-previa-serie'
import type { Paciente } from '@/tipos/db'

const DIAS = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 0, nombre: 'Domingo' },
]

const ETIQUETA = 'mb-1 block text-sm font-medium text-tinta-sup'

export function FormularioSerie({
  pacientes,
  fechaInicial,
  diaInicial,
  duracionDefault,
  onCreada,
}: {
  pacientes: Paciente[]
  fechaInicial: string
  diaInicial: number
  duracionDefault: number
  onCreada: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoSerie, FormData>(
    previsualizarOCrearSerie,
    {},
  )
  const [indefinida, setIndefinida] = useState(false)

  useEffect(() => {
    if (estado.creada) onCreada()
  }, [estado.creada, onCreada])

  return (
    <form action={accion} className="space-y-4">
      <label className="block">
        <span className={ETIQUETA}>Paciente</span>
        <select name="patient_id" required defaultValue="" className={CONTROL_ANCHO}>
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

      <div className="flex flex-wrap gap-3">
        <label className="min-w-32 flex-1">
          <span className={ETIQUETA}>Día</span>
          <select name="dia_semana" defaultValue={String(diaInicial)} className={CONTROL_ANCHO}>
            {DIAS.map((d) => (
              <option key={d.numero} value={d.numero}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="w-28">
          <span className={ETIQUETA}>Hora</span>
          <input
            type="time"
            name="hora"
            step={300}
            required
            className={`tabular ${CONTROL_ANCHO}`}
          />
        </label>
        <label className="w-24">
          <span className={ETIQUETA}>Minutos</span>
          <input
            type="number"
            name="duracion_min"
            min={5}
            max={480}
            step={5}
            defaultValue={duracionDefault}
            required
            className={`tabular ${CONTROL_ANCHO}`}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="min-w-40 flex-1">
          <span className={ETIQUETA}>Frecuencia</span>
          <select name="frecuencia" defaultValue="semanal" className={CONTROL_ANCHO}>
            <option value="semanal">Todas las semanas</option>
            <option value="quincenal">Cada 15 días</option>
            <option value="mensual">Cada 4 semanas</option>
          </select>
        </label>
        <label className="min-w-36 flex-1">
          <span className={ETIQUETA}>Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={fechaInicial}
            required
            className={CONTROL_ANCHO}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-32">
          <span className={ETIQUETA}>Sesiones</span>
          <input
            type="number"
            name="sesiones_totales"
            min={1}
            max={200}
            defaultValue={10}
            disabled={indefinida}
            className={`tabular ${CONTROL_ANCHO} disabled:bg-papel-alt disabled:text-lapiz`}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-tinta-sup">
          <input
            type="checkbox"
            name="indefinida"
            checked={indefinida}
            onChange={(e) => setIndefinida(e.target.checked)}
            className="size-4 accent-birome"
          />
          Sin fecha de fin
        </label>
      </div>

      {estado.ocurrencias && <VistaPreviaSerie ocurrencias={estado.ocurrencias} />}
      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta-texto">
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? 'Calculando…' : 'Ver vista previa'}
        </Boton>
        {estado.ocurrencias && estado.ocurrencias.some((o) => o.libre) && (
          <Boton type="submit" name="confirmar" value="1" disabled={pendiente}>
            Crear {estado.ocurrencias.filter((o) => o.libre).length} sesiones
          </Boton>
        )}
      </div>

      <p className="text-sm text-lapiz">
        Si es indefinida, se agendan las próximas 8 semanas y el sistema las va extendiendo solo.
      </p>
    </form>
  )
}
