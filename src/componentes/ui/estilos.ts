/**
 * Estilo base de los controles que no pasan por <Campo>: selects, inputs de
 * fecha y hora sueltos dentro de una grilla. Está acá y no repetido en cada
 * pantalla para que un cambio de marca sea un solo cambio.
 */
export const CONTROL =
  'min-h-11 rounded-marca border border-renglon bg-papel px-3 text-base text-tinta'

/** Igual que CONTROL pero ocupando todo el ancho disponible. */
export const CONTROL_ANCHO = `block w-full ${CONTROL}`
