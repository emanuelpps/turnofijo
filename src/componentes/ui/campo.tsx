'use client'

import { useId } from 'react'
import { clsx } from 'clsx'

export function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  id,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string
  error?: string
  ayuda?: string
}) {
  // El id tiene que ser único por instancia, no derivado del name: la lista de
  // pacientes deja montados a la vez el formulario de alta y el de edición, y
  // dos inputs con el mismo id hacen que la etiqueta enfoque el campo del
  // diálogo equivocado.
  const idAutomatico = useId()
  const idCampo = id ?? idAutomatico
  const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined
  const idError = error ? `${idCampo}-error` : undefined
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined

  return (
    <div className="block">
      <label htmlFor={idCampo} className="mb-1 block text-sm font-medium text-tinta-sup">
        {etiqueta}
      </label>
      <input
        {...props}
        id={idCampo}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito}
        className={clsx(
          'block min-h-11 w-full rounded-marca border bg-papel px-3 text-base text-tinta',
          'placeholder:text-lapiz/70',
          error ? 'border-falta' : 'border-renglon',
          className,
        )}
      />
      {ayuda && !error && (
        <span id={idAyuda} className="mt-1 block text-sm text-lapiz">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={idError} className="mt-1 block text-sm text-falta">
          {error}
        </span>
      )}
    </div>
  )
}
