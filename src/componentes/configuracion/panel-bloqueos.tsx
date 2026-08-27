'use client'

import { useActionState } from 'react'
import { crearBloqueo, borrarBloqueo, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { CONTROL, CONTROL_ANCHO } from '@/componentes/ui/estilos'
import { parsearTstzrange, utcALocal } from '@/lib/tiempo'
import { fechaLarga } from '@/lib/formato'
import type { Bloqueo } from '@/tipos/db'

/** El período se guarda con fin exclusivo: el último día bloqueado es el anterior. */
function fechasDelBloqueo(periodo: string) {
  const { inicio, fin } = parsearTstzrange(periodo)
  const ultimoDia = new Date(fin.getTime() - 24 * 60 * 60 * 1000)
  return {
    desde: utcALocal(inicio).fecha,
    hasta: utcALocal(ultimoDia).fecha,
  }
}

export function PanelBloqueos({ bloqueos }: { bloqueos: Bloqueo[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearBloqueo, {})

  return (
    <section>
      <h2 className="text-lg font-bold">Vacaciones, feriados y ausencias</h2>
      <p className="mt-0.5 mb-4 text-sm text-lapiz">
        Los días bloqueados no aceptan turnos nuevos. Los turnos ya agendados no se cancelan solos.
      </p>

      <form action={accion} className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bloqueo-desde" className="mb-1 block text-sm font-medium text-tinta-sup">
            Desde
          </label>
          <input id="bloqueo-desde" type="date" name="desde" required className={CONTROL} />
        </div>
        <div>
          <label htmlFor="bloqueo-hasta" className="mb-1 block text-sm font-medium text-tinta-sup">
            Hasta
          </label>
          <input id="bloqueo-hasta" type="date" name="hasta" required className={CONTROL} />
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="bloqueo-motivo" className="mb-1 block text-sm font-medium text-tinta-sup">
            Motivo
          </label>
          <input
            id="bloqueo-motivo"
            name="motivo"
            placeholder="Vacaciones"
            className={CONTROL_ANCHO}
          />
        </div>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Agregando…' : 'Agregar'}
        </Boton>
      </form>

      {estado.error && (
        <p role="alert" className="mb-4 rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="mb-4 rounded-marca bg-espera-sup px-3 py-2 text-sm text-espera">
          {estado.aviso}
        </p>
      )}

      {bloqueos.length === 0 ? (
        <p className="rounded-marca border border-dashed border-renglon px-4 py-6 text-center text-sm text-lapiz">
          No tenés días bloqueados.
        </p>
      ) : (
        <ul className="divide-y divide-renglon rounded-marca border border-renglon">
          {bloqueos.map((b) => {
            const { desde, hasta } = fechasDelBloqueo(b.periodo)
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-semibold text-tinta">
                    {desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} al ${fechaLarga(hasta)}`}
                  </p>
                  <p className="text-sm text-lapiz">{b.motivo || 'Sin motivo'}</p>
                </div>
                <form action={borrarBloqueo}>
                  <input type="hidden" name="id" value={b.id} />
                  <Boton variante="peligro" type="submit">
                    Quitar
                  </Boton>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
