'use client'

import { useActionState, useId, useState } from 'react'
import { guardarConfiguracion, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL } from '@/componentes/ui/estilos'
import type { FranjaHorariaFila } from '@/tipos/db'

const DIAS: { numero: number; nombre: string; corto: string }[] = [
  { numero: 1, nombre: 'Lunes', corto: 'Lun' },
  { numero: 2, nombre: 'Martes', corto: 'Mar' },
  { numero: 3, nombre: 'Miércoles', corto: 'Mié' },
  { numero: 4, nombre: 'Jueves', corto: 'Jue' },
  { numero: 5, nombre: 'Viernes', corto: 'Vie' },
  { numero: 6, nombre: 'Sábado', corto: 'Sáb' },
  { numero: 0, nombre: 'Domingo', corto: 'Dom' },
]

const HABILES = [1, 2, 3, 4, 5]

type Franja = { desde: string; hasta: string }
type DiaCargado = { manana: Franja; tarde: Franja }

const VACIA: Franja = { desde: '', hasta: '' }

/** `09:00:00` → `09:00`, que es lo que espera un <input type="time">. */
function aHHMM(t: string | undefined): string {
  return t ? t.slice(0, 5) : ''
}

function estadoInicial(franjas: FranjaHorariaFila[]): Record<number, DiaCargado> {
  const porDia: Record<number, DiaCargado> = {}
  for (const { numero } of DIAS) {
    const delDia = franjas
      .filter((f) => f.dia_semana === numero)
      .sort((a, b) => (a.desde < b.desde ? -1 : 1))
    porDia[numero] = {
      manana: { desde: aHHMM(delDia[0]?.desde), hasta: aHHMM(delDia[0]?.hasta) },
      tarde: { desde: aHHMM(delDia[1]?.desde), hasta: aHHMM(delDia[1]?.hasta) },
    }
  }
  return porDia
}

function tieneAlgo(d: DiaCargado): boolean {
  return !!(d.manana.desde || d.manana.hasta || d.tarde.desde || d.tarde.hasta)
}

const HORA = `tabular w-[6.5rem] ${CONTROL}`

/**
 * Cargar la semana día por día son 28 campos, y casi todos los profesionales
 * atienden lo mismo de lunes a viernes. Este bloque llena la grilla de una
 * vez; después se ajusta a mano el día que sea distinto.
 *
 * No guarda: solo completa el formulario, así el profesional ve qué quedó
 * antes de confirmar.
 */
function CargaRapida({ onAplicar }: { onAplicar: (dias: number[], valores: DiaCargado) => void }) {
  const base = useId()
  const [manana, setManana] = useState<Franja>({ desde: '09:00', hasta: '13:00' })
  const [tarde, setTarde] = useState<Franja>({ desde: '15:00', hasta: '20:00' })
  const [dias, setDias] = useState<number[]>(HABILES)

  const nadaCargado = !manana.desde && !manana.hasta && !tarde.desde && !tarde.hasta

  return (
    <div className="rounded-marca border border-renglon bg-papel-alt p-4">
      <h3 className="font-semibold text-tinta">Cargar varios días de una vez</h3>
      <p className="mt-0.5 mb-3 text-sm text-lapiz">
        Poné el horario, marcá los días y se copia a todos. Después podés cambiar el que sea
        distinto.
      </p>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <span className="etiqueta mb-1 block">Mañana</span>
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              aria-label="Carga rápida, mañana, desde"
              value={manana.desde}
              onChange={(e) => setManana({ ...manana, desde: e.target.value })}
              className={HORA}
            />
            <span className="text-lapiz">a</span>
            <input
              type="time"
              aria-label="Carga rápida, mañana, hasta"
              value={manana.hasta}
              onChange={(e) => setManana({ ...manana, hasta: e.target.value })}
              className={HORA}
            />
          </div>
        </div>
        <div>
          <span className="etiqueta mb-1 block">Tarde</span>
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              aria-label="Carga rápida, tarde, desde"
              value={tarde.desde}
              onChange={(e) => setTarde({ ...tarde, desde: e.target.value })}
              className={HORA}
            />
            <span className="text-lapiz">a</span>
            <input
              type="time"
              aria-label="Carga rápida, tarde, hasta"
              value={tarde.hasta}
              onChange={(e) => setTarde({ ...tarde, hasta: e.target.value })}
              className={HORA}
            />
          </div>
        </div>
      </div>

      <fieldset className="mb-3">
        <legend className="etiqueta mb-1.5">Días</legend>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d) => {
            const elegido = dias.includes(d.numero)
            return (
              <label
                key={d.numero}
                className={[
                  'cursor-pointer rounded-marca border px-3 py-2 text-sm font-medium transition-colors',
                  elegido
                    ? 'border-birome bg-birome-sup text-birome'
                    : 'border-renglon bg-papel text-tinta-sup hover:border-lapiz',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={elegido}
                  onChange={() =>
                    setDias((previos) =>
                      previos.includes(d.numero)
                        ? previos.filter((n) => n !== d.numero)
                        : [...previos, d.numero],
                    )
                  }
                />
                {d.corto}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          id={`${base}-aplicar`}
          variante="secundario"
          disabled={dias.length === 0 || nadaCargado}
          onClick={() => onAplicar(dias, { manana, tarde })}
        >
          Copiar a los días marcados
        </Boton>
        {dias.length === 0 && <span className="text-sm text-lapiz">Marcá al menos un día.</span>}
      </div>
    </div>
  )
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
  const [horarios, setHorarios] = useState(() => estadoInicial(franjas))

  function cambiar(dia: number, bloque: 'manana' | 'tarde', campo: 'desde' | 'hasta', valor: string) {
    setHorarios((previos) => ({
      ...previos,
      [dia]: { ...previos[dia], [bloque]: { ...previos[dia][bloque], [campo]: valor } },
    }))
  }

  function aplicarA(dias: number[], valores: DiaCargado) {
    setHorarios((previos) => {
      const siguiente = { ...previos }
      for (const dia of dias) {
        siguiente[dia] = { manana: { ...valores.manana }, tarde: { ...valores.tarde } }
      }
      return siguiente
    })
  }

  function limpiar(dia: number) {
    setHorarios((previos) => ({ ...previos, [dia]: { manana: { ...VACIA }, tarde: { ...VACIA } } }))
  }

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

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Horarios de atención</h2>
          <p className="mt-0.5 text-sm text-lapiz">
            Dejá las dos horas vacías para los días que no atendés.
          </p>
        </div>

        <CargaRapida onAplicar={aplicarA} />

        <div className="overflow-x-auto rounded-marca border border-renglon">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-renglon">
                <th className="etiqueta px-4 py-2 text-left">Día</th>
                <th className="etiqueta px-4 py-2 text-left">Mañana</th>
                <th className="etiqueta px-4 py-2 text-left">Tarde</th>
                <th className="px-4 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map(({ numero, nombre }) => {
                const dia = horarios[numero]
                return (
                  <tr key={numero} className="border-t border-renglon first:border-t-0">
                    <th scope="row" className="px-4 py-2 text-left font-semibold text-tinta">
                      {nombre}
                    </th>
                    {(['manana', 'tarde'] as const).map((bloque) => (
                      <td key={bloque} className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            aria-label={`${nombre}, ${bloque === 'manana' ? 'mañana' : 'tarde'}, desde`}
                            name={`d${numero}_${bloque}_desde`}
                            value={dia[bloque].desde}
                            onChange={(e) => cambiar(numero, bloque, 'desde', e.target.value)}
                            className={HORA}
                          />
                          <span className="text-lapiz">a</span>
                          <input
                            type="time"
                            aria-label={`${nombre}, ${bloque === 'manana' ? 'mañana' : 'tarde'}, hasta`}
                            name={`d${numero}_${bloque}_hasta`}
                            value={dia[bloque].hasta}
                            onChange={(e) => cambiar(numero, bloque, 'hasta', e.target.value)}
                            className={HORA}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      {tieneAlgo(dia) && (
                        <button
                          type="button"
                          onClick={() => limpiar(numero)}
                          className="rounded-marca px-2 py-1 text-sm font-medium text-lapiz hover:text-falta-texto"
                        >
                          Limpiar
                          <span className="sr-only"> el {nombre}</span>
                        </button>
                      )}
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
