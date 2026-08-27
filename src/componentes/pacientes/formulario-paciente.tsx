'use client'

import { useActionState, useEffect } from 'react'
import { guardarPaciente, type EstadoFormulario } from '@/acciones/pacientes'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'
import type { Paciente } from '@/tipos/db'

export function FormularioPaciente({
  paciente,
  onGuardado,
}: {
  paciente?: Paciente
  onGuardado: () => void
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    guardarPaciente,
    {},
  )

  useEffect(() => {
    if (estado.ok) onGuardado()
  }, [estado.ok, onGuardado])

  return (
    <form action={accion} className="space-y-4">
      {paciente && <input type="hidden" name="id" value={paciente.id} />}
      <Campo etiqueta="Nombre" name="nombre" defaultValue={paciente?.nombre ?? ''} required />
      <Campo
        etiqueta="Teléfono"
        name="telefono"
        inputMode="tel"
        placeholder="2984 12-3456"
        defaultValue={paciente?.telefono_e164 ?? ''}
        required
      />
      <Campo
        etiqueta="Email (opcional)"
        name="email"
        type="email"
        defaultValue={paciente?.email ?? ''}
      />
      <Campo
        etiqueta="Notas administrativas (opcional)"
        name="notas_administrativas"
        defaultValue={paciente?.notas_administrativas ?? ''}
        placeholder="Obra social, quién lo derivó, etc."
      />
      <p className="text-xs text-zinc-500">
        No cargues información clínica acá: Turno Fijo no guarda historia clínica.
      </p>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      <div className="flex justify-end gap-2">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  )
}
