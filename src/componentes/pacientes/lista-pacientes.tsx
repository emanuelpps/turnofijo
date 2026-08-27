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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Boton onClick={() => setCreando(true)}>Nuevo paciente</Boton>
      </div>

      {activos.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Todavía no cargaste ningún paciente.
        </p>
      )}

      <ul className="divide-y divide-zinc-200">
        {activos.map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.nombre}</p>
              <p className="text-sm text-zinc-600">
                {formatearTelefonoParaMostrar(p.telefono_e164)}
                {!p.contactable && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    revisar teléfono
                  </span>
                )}
              </p>
            </div>
            <Boton variante="secundario" onClick={() => setEnEdicion(p)}>
              Editar
            </Boton>
            <form action={archivarPaciente}>
              <input type="hidden" name="id" value={p.id} />
              <Boton variante="peligro" type="submit">
                Archivar
              </Boton>
            </form>
          </li>
        ))}
      </ul>

      {archivados.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-zinc-600">
            Archivados ({archivados.length})
          </summary>
          <ul className="mt-2 divide-y divide-zinc-200">
            {archivados.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-3 text-zinc-500">
                <span className="flex-1 truncate">{p.nombre}</span>
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
