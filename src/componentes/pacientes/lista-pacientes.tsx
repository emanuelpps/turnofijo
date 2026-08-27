'use client'

import { useState } from 'react'
import { archivarPaciente, desarchivarPaciente } from '@/acciones/pacientes'
import { formatearTelefonoParaMostrar } from '@/lib/telefono'
import { Boton } from '@/componentes/ui/boton'
import { Dialogo } from '@/componentes/ui/dialogo'
import { FormularioPaciente } from './formulario-paciente'
import type { Paciente } from '@/tipos/db'

export function ListaPacientes({ pacientes }: { pacientes: Paciente[] }) {
  const [enEdicion, setEnEdicion] = useState<Paciente | null>(null)
  const [creando, setCreando] = useState(false)

  const activos = pacientes.filter((p) => !p.archivado_en)
  const archivados = pacientes.filter((p) => p.archivado_en)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-[1.75rem] font-bold tracking-[-0.018em] sm:text-[2rem]"
            style={{ fontVariationSettings: '"wdth" 118' }}
          >
            Pacientes
          </h1>
          <p className="mt-0.5 text-sm text-lapiz">
            {activos.length === 0
              ? 'Ninguno cargado todavía'
              : `${activos.length} en tu agenda`}
          </p>
        </div>
        <Boton onClick={() => setCreando(true)}>Nuevo paciente</Boton>
      </div>

      {activos.length === 0 ? (
        <div className="rounded-marca border border-dashed border-renglon px-6 py-12 text-center">
          <p className="font-semibold text-tinta">Todavía no cargaste ningún paciente.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-lapiz">
            Cargá uno y ya vas a poder darle su turno en la agenda.
          </p>
          <Boton className="mt-4" onClick={() => setCreando(true)}>
            Cargar el primero
          </Boton>
        </div>
      ) : (
        <ul className="divide-y divide-renglon rounded-marca border border-renglon">
          {activos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-40 flex-1">
                <p className="truncate font-semibold text-tinta">{p.nombre}</p>
                <p className="tabular text-sm text-lapiz">
                  {formatearTelefonoParaMostrar(p.telefono_e164)}
                  {!p.contactable && (
                    <span className="etiqueta ml-2 rounded bg-espera-sup px-1.5 py-0.5 text-espera">
                      Revisar teléfono
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={() => setEnEdicion(p)}>
                  Editar
                </Boton>
                <form action={archivarPaciente}>
                  <input type="hidden" name="id" value={p.id} />
                  <Boton variante="peligro" type="submit">
                    Archivar
                  </Boton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {archivados.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-lapiz hover:text-tinta">
            Archivados ({archivados.length})
          </summary>
          <ul className="mt-2 divide-y divide-renglon rounded-marca border border-renglon">
            {archivados.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="min-w-40 flex-1 truncate text-lapiz">{p.nombre}</span>
                <form action={desarchivarPaciente}>
                  <input type="hidden" name="id" value={p.id} />
                  <Boton variante="secundario" type="submit">
                    Recuperar
                  </Boton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialogo abierto={creando} onCerrar={() => setCreando(false)} titulo="Nuevo paciente">
        <FormularioPaciente onGuardado={() => setCreando(false)} />
      </Dialogo>

      <Dialogo
        abierto={enEdicion !== null}
        onCerrar={() => setEnEdicion(null)}
        titulo="Editar paciente"
      >
        {enEdicion && (
          <FormularioPaciente
            key={enEdicion.id}
            paciente={enEdicion}
            onGuardado={() => setEnEdicion(null)}
          />
        )}
      </Dialogo>
    </div>
  )
}
