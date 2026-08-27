/**
 * El logo de Turno Fijo, tal como lo define el manual de marca (§03).
 *
 * Tres renglones —tres semanas— y el mismo casillero marcado en las tres,
 * alineado. Es la repetición en el mismo lugar: todo el producto en una figura.
 * El casillero va a la derecha del centro, no centrado, a propósito.
 *
 * No tocar sin releer el manual: los casilleros desalineados son el peor uso
 * incorrecto posible porque rompen el significado, no la estética.
 */

/** Isotipo solo. Mínimo 16 px: abajo de eso los renglones desaparecen. */
export function Isotipo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Turno Fijo"
    >
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".26">
        <line x1="4" y1="12" x2="44" y2="12" />
        <line x1="4" y1="24" x2="44" y2="24" />
        <line x1="4" y1="36" x2="44" y2="36" />
      </g>
      <g fill="currentColor" className="text-birome">
        <rect x="25" y="7" width="10" height="10" rx="3" />
        <rect x="25" y="19" width="10" height="10" rx="3" />
        <rect x="25" y="31" width="10" height="10" rx="3" />
      </g>
    </svg>
  )
}

/**
 * Logotipo horizontal: la versión principal, la que va en la app y en la web.
 * La palabra se compone en HTML y no en <text> del SVG para que sea
 * seleccionable, escale con el zoom del navegador y use la Archivo ya cargada.
 */
export function Logotipo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Isotipo size={26} />
      <span
        className="font-display text-[1.25rem] leading-none font-extrabold tracking-[-0.02em]"
        style={{ fontVariationSettings: '"wdth" 120' }}
      >
        Turno Fijo
      </span>
    </span>
  )
}
