import { clsx } from 'clsx'

export function Campo({
  etiqueta,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{etiqueta}</span>
      <input
        {...props}
        className={clsx(
          'block w-full min-h-11 rounded-lg border px-3 text-base',
          'focus:outline-none focus:ring-2 focus:ring-zinc-900',
          error ? 'border-red-400' : 'border-zinc-300',
          className,
        )}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
