'use client'

import { useActionState } from 'react'
import { guardarConfiguracion, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import type { FranjaHorariaFila } from '@/tipos/db'

const DIAS: { numero: number; nombre: string }[] = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 0, nombre: 'Domingo' },
]

/** `09:00:00` → `09:00`, que es lo que espera un <input type="time">. */
function aHHMM(t: string | undefined): string {
  return t ? t.slice(0, 5) : ''
}

function franjasDelDia(franjas: FranjaHorariaFila[], dia: number) {
  const delDia = [...franjas]
    .filter((f) => f.dia_semana === dia)
    .sort((a, b) => (a.desde < b.desde ? -1 : 1))
  return { manana: delDia[0], tarde: delDia[1] }
}

export function FormularioHorarios({
  franjas,
  duracionDefault,
}: {
  franjas: FranjaHorariaFila[]
  duracionDefault: number
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    guardarConfiguracion,
    {},
  )

  return (
    <form action={accion} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Duración por defecto de una sesión (minutos)
          <input
            type="number"
            name="duracion_default_min"
            defaultValue={duracionDefault}
            min={5}
            max={480}
            step={5}
            className="mt-1 block w-32 min-h-11 rounded-lg border border-zinc-300 px-3"
          />
        </label>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Horarios de atención</h2>
        <p className="mb-3 text-sm text-zinc-600">
          Dejá las dos horas vacías para los días que no atendés.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2 font-medium">Día</th>
                <th className="py-2 font-medium">Mañana</th>
                <th className="py-2 font-medium">Tarde</th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map(({ numero, nombre }) => {
                const { manana, tarde } = franjasDelDia(franjas, numero)
                return (
                  <tr key={numero} className="border-t border-zinc-200">
                    <td className="py-2 pr-4 font-medium">{nombre}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <input type="time" name={`d${numero}_manana_desde`} defaultValue={aHHMM(manana?.desde)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                        <span className="text-zinc-400">a</span>
                        <input type="time" name={`d${numero}_manana_hasta`} defaultValue={aHHMM(manana?.hasta)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <input type="time" name={`d${numero}_tarde_desde`} defaultValue={aHHMM(tarde?.desde)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                        <span className="text-zinc-400">a</span>
                        <input type="time" name={`d${numero}_tarde_hasta`} defaultValue={aHHMM(tarde?.hasta)} className="min-h-11 rounded-lg border border-zinc-300 px-2" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-700">Guardado.</p>}

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar configuración'}
      </Boton>
    </form>
  )
}
