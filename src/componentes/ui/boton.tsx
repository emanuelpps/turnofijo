import { clsx } from 'clsx'

type Variante = 'primario' | 'secundario' | 'peligro'
type Tamano = 'normal' | 'grande'

// El botón primario es tinta, no azul: el azul birome es el acento de la marca
// (logo, links) y el manual pide un solo acento por pantalla.
const ESTILOS: Record<Variante, string> = {
  primario: 'bg-tinta text-papel hover:opacity-90',
  secundario: 'bg-transparent text-tinta border border-renglon hover:bg-papel-alt',
  peligro: 'bg-transparent text-falta border border-falta/40 hover:bg-falta-sup',
}

// 44 px es el mínimo táctil; 56 px es lo que pide el manual para lo que se
// aprieta con el pulgar, parado, entre paciente y paciente.
const TAMANOS: Record<Tamano, string> = {
  normal: 'min-h-11 px-4 text-sm',
  grande: 'min-h-14 px-5 text-base',
}

export function Boton({
  variante = 'primario',
  tamano = 'normal',
  // Un <button> sin type es type="submit". Como varios botones de acción viven
  // adentro de un <form> (el de archivar, el de cancelar), heredar submit hace
  // que un botón que solo abre un diálogo mande el formulario de al lado.
  type = 'button',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamano?: Tamano
}) {
  return (
    <button
      type={type}
      {...props}
      className={clsx(
        'inline-flex items-center justify-center rounded-marca font-medium',
        'transition-[opacity,background-color] disabled:pointer-events-none disabled:opacity-50',
        ESTILOS[variante],
        TAMANOS[tamano],
        className,
      )}
    />
  )
}
