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
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}
