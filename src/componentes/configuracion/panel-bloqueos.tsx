'use client'

import { useActionState } from 'react'
import { crearBloqueo, borrarBloqueo, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { parsearTstzrange, utcALocal } from '@/lib/tiempo'
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
      <h2 className="mb-2 font-medium">Vacaciones, feriados y ausencias</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Los días bloqueados no aceptan turnos nuevos. Los turnos ya agendados no se cancelan solos.
      </p>

      <form action={accion} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-zinc-700">Desde</span>
          <input type="date" name="desde" required className="min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-zinc-700">Hasta</span>
          <input type="date" name="hasta" required className="min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <label className="text-sm flex-1 min-w-48">
          <span className="mb-1 block font-medium text-zinc-700">Motivo</span>
          <input name="motivo" placeholder="Vacaciones" className="w-full min-h-11 rounded-lg border border-zinc-300 px-3" />
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Agregando…' : 'Agregar'}
        </Boton>
      </form>

      {estado.error && <p className="mb-3 text-sm text-red-600">{estado.error}</p>}

      {bloqueos.length === 0 ? (
        <p className="text-sm text-zinc-500">No tenés días bloqueados.</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {bloqueos.map((b) => {
            const { desde, hasta } = fechasDelBloqueo(b.periodo)
            return (
              <li key={b.id} className="flex items-center gap-4 py-3 text-sm">
                <span className="font-medium">
                  {desde === hasta ? desde : `${desde} → ${hasta}`}
                </span>
                <span className="flex-1 text-zinc-600">{b.motivo || 'Sin motivo'}</span>
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
