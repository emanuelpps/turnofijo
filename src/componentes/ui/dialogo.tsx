'use client'

import { useEffect, useRef } from 'react'

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      // <dialog> nativo no cierra al tocar afuera: el click cae en el propio
      // <dialog> (el backdrop es su pseudoelemento), no en el contenido.
      onClick={(evento) => {
        if (evento.target === ref.current) onCerrar()
      }}
      className={[
        'm-auto w-[min(30rem,calc(100vw-2rem))] p-0',
        'rounded-[14px] border border-renglon bg-papel text-tinta shadow-marca',
        'backdrop:bg-tinta/40',
      ].join(' ')}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-tinta">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-m-2 shrink-0 rounded-marca p-2 text-lapiz hover:text-tinta"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
