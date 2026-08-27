'use client'

import { useActionState, useId } from 'react'
import { guardarPerfil, type EstadoFormulario } from '@/acciones/configuracion'
import { Boton } from '@/componentes/ui/boton'
import { Campo } from '@/componentes/ui/campo'
import { CONTROL } from '@/componentes/ui/estilos'
import type { Profesional } from '@/tipos/db'

const ESPECIALIDADES = [
  { valor: 'psicologia', texto: 'Psicología' },
  { valor: 'nutricion', texto: 'Nutrición' },
  { valor: 'otra', texto: 'Otra' },
]

export function FormularioPerfil({ profesional }: { profesional: Profesional | null }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarPerfil, {})
  const idEspecialidad = useId()

  return (
    <form action={accion} className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Tus datos</h2>
        <p className="mt-0.5 text-sm text-lapiz">El nombre es el que ves arriba a la derecha.</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-56 flex-1">
          <Campo etiqueta="Nombre" name="nombre" defaultValue={profesional?.nombre ?? ''} required />
        </div>
        <div>
          <label
            htmlFor={idEspecialidad}
            className="mb-1 block text-sm font-medium text-tinta-sup"
          >
            Especialidad
          </label>
          <select
            id={idEspecialidad}
            name="especialidad"
            defaultValue={profesional?.especialidad ?? 'psicologia'}
            className={CONTROL}
          >
            {ESPECIALIDADES.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.texto}
              </option>
            ))}
          </select>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-marca bg-vino-sup px-3 py-2 text-sm text-vino">
          Guardado.
        </p>
      )}

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar mis datos'}
      </Boton>
    </form>
  )
}
