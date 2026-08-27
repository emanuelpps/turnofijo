import { clsx } from 'clsx'

type Variante = 'primario' | 'secundario' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-zinc-900 text-white hover:bg-zinc-800',
  secundario: 'bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50',
  peligro: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
}

export function Boton({
  variante = 'primario',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium',
        'transition-colors disabled:opacity-50 disabled:pointer-events-none',
        ESTILOS[variante],
        className,
      )}
    />
  )
}
