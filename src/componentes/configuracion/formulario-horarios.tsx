'use client'

import { useActionState } from 'react'
import { guardarConfiguracion, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL } from '@/componentes/ui/estilos'
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

const HORA = `tabular w-[6.5rem] ${CONTROL}`

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
    <form action={accion} className="space-y-7">
      <section>
        <h2 className="text-lg font-bold">Duración de una sesión</h2>
        <p className="mt-0.5 mb-2 text-sm text-lapiz">
          Es la que se propone al agendar. Después la podés cambiar turno por turno.
        </p>
        <label htmlFor="duracion_default_min" className="sr-only">
          Duración por defecto en minutos
        </label>
        <div className="flex items-center gap-2">
          <input
            id="duracion_default_min"
            type="number"
            name="duracion_default_min"
            defaultValue={duracionDefault}
            min={5}
            max={480}
            step={5}
            className={`tabular w-24 ${CONTROL}`}
          />
          <span className="text-sm text-lapiz">minutos</span>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Horarios de atención</h2>
        <p className="mt-0.5 mb-3 text-sm text-lapiz">
          Dejá las dos horas vacías para los días que no atendés.
        </p>

        <div className="overflow-x-auto rounded-marca border border-renglon">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-renglon">
                <th className="etiqueta px-4 py-2 text-left">Día</th>
                <th className="etiqueta px-4 py-2 text-left">Mañana</th>
                <th className="etiqueta px-4 py-2 text-left">Tarde</th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map(({ numero, nombre }) => {
                const { manana, tarde } = franjasDelDia(franjas, numero)
                return (
                  <tr key={numero} className="border-t border-renglon first:border-t-0">
                    <th scope="row" className="px-4 py-2 text-left font-semibold text-tinta">
                      {nombre}
                    </th>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${nombre}, mañana, desde`}
                          name={`d${numero}_manana_desde`}
                          defaultValue={aHHMM(manana?.desde)}
                          className={HORA}
                        />
                        <span className="text-lapiz">a</span>
                        <input
                          type="time"
                          aria-label={`${nombre}, mañana, hasta`}
                          name={`d${numero}_manana_hasta`}
                          defaultValue={aHHMM(manana?.hasta)}
                          className={HORA}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${nombre}, tarde, desde`}
                          name={`d${numero}_tarde_desde`}
                          defaultValue={aHHMM(tarde?.desde)}
                          className={HORA}
                        />
                        <span className="text-lapiz">a</span>
                        <input
                          type="time"
                          aria-label={`${nombre}, tarde, hasta`}
                          name={`d${numero}_tarde_hasta`}
                          defaultValue={aHHMM(tarde?.hasta)}
                          className={HORA}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta-texto">
          {estado.error}
        </p>
      )}
      {estado.ok && !estado.aviso && (
        <p role="status" className="rounded-marca bg-vino-sup px-3 py-2 text-sm text-vino-texto">
          Guardado.
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="rounded-marca bg-espera-sup px-3 py-2 text-sm text-espera-texto">
          {estado.aviso}
        </p>
      )}

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar configuración'}
      </Boton>
    </form>
  )
}
