/**
 * Cómo se escriben las fechas para que las lea una persona.
 *
 * Todas las funciones toman una fecha local `YYYY-MM-DD` y la parsean como
 * UTC a propósito: así el resultado no depende de la zona horaria de la
 * máquina que renderiza, y el servidor y el navegador coinciden siempre.
 */

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function aFecha(fecha: string): Date {
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${fecha}`)
  return d
}

/** `2026-08-24` → `Lun`. */
export function diaCorto(fecha: string): string {
  return DIAS_CORTOS[aFecha(fecha).getUTCDay()]
}

/** `2026-08-24` → `24/08`. */
export function diaYMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

/** `2026-08-24` → `lunes 24 de agosto`. */
export function fechaLarga(fecha: string): string {
  const d = aFecha(fecha)
  return `${DIAS_LARGOS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}
