'use client'

import { useActionState, useEffect } from 'react'
import { guardarPaciente, type EstadoFormulario } from '@/acciones/pacientes'
import { formatearTelefonoParaMostrar } from '@/lib/telefono'
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
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarPaciente, {})

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
        // El E.164 crudo (+5492984556677) es incómodo de leer y de corregir.
        // Se guarda normalizado igual: la normalización es idempotente.
        defaultValue={paciente ? formatearTelefonoParaMostrar(paciente.telefono_e164) : ''}
        ayuda="Con código de área, sin el 0 ni el 15."
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
        ayuda="No cargues información clínica: Turno Fijo no guarda historia clínica."
      />

      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta-texto">
          {estado.error}
        </p>
      )}

      <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar'}
      </Boton>
    </form>
  )
}
