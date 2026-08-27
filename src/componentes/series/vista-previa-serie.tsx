'use client'

import type { OcurrenciaPrevia } from '@/acciones/series'
import { diaCorto, diaYMes } from '@/lib/formato'

const MOTIVOS: Record<string, string> = {
  fuera_de_horario: 'fuera de tu horario',
  bloqueado: 'día bloqueado',
  superpuesto: 'ya tenés otro turno',
}

export function VistaPreviaSerie({ ocurrencias }: { ocurrencias: OcurrenciaPrevia[] }) {
  const libres = ocurrencias.filter((o) => o.libre).length
  const chocan = ocurrencias.length - libres

  return (
    <div className="rounded-marca border border-renglon">
      <div className="border-b border-renglon px-3 py-2 text-sm text-tinta-sup">
        <span className="font-medium text-tinta">{libres} sesiones</span> se van a agendar
        {chocan > 0 && <span className="text-espera-texto"> · {chocan} se saltean</span>}
      </div>
      <ul className="max-h-56 divide-y divide-renglon overflow-y-auto text-sm">
        {ocurrencias.map((o) => (
          <li key={o.fecha} className="flex items-center gap-2 px-3 py-1.5">
            <span className={o.libre ? 'tabular' : 'tabular text-lapiz line-through'}>
              {diaCorto(o.fecha)} {diaYMes(o.fecha)} · {o.hora}
            </span>
            {!o.libre && o.motivo && (
              <span className="ml-auto text-xs text-espera-texto">{MOTIVOS[o.motivo]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
