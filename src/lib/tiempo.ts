/**
 * Toda la app guarda instantes en UTC y los muestra en hora argentina (−03:00).
 * Argentina no tiene horario de verano, así que el offset es una constante y no
 * hace falta ninguna librería de zonas horarias.
 */

const OFFSET_MS = 3 * 60 * 60 * 1000

/** Fecha `YYYY-MM-DD` y hora `HH:MM` locales → instante UTC. */
export function localAUtc(fecha: string, hora: string): Date {
  const horaCompleta = hora.length === 5 ? `${hora}:00` : hora
  const d = new Date(`${fecha}T${horaCompleta}-03:00`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha u hora inválida: ${fecha} ${hora}`)
  }
  return d
}

/** Instante UTC → fecha `YYYY-MM-DD` y hora `HH:MM` locales. */
export function utcALocal(d: Date): { fecha: string; hora: string } {
  const iso = new Date(d.getTime() - OFFSET_MS).toISOString()
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) }
}

/** Minutos transcurridos desde la medianoche local. */
export function minutosLocales(d: Date): number {
  const [h, m] = utcALocal(d).hora.split(':').map(Number)
  return h * 60 + m
}

/** Día de la semana local, 0 = domingo (igual que `Date.getDay`). */
export function diaSemanaLocal(d: Date): number {
  return new Date(d.getTime() - OFFSET_MS).getUTCDay()
}

export function sumarMinutos(d: Date, minutos: number): Date {
  return new Date(d.getTime() + minutos * 60_000)
}

/** Rango semiabierto `[inicio, fin)` en la sintaxis de `tstzrange`. */
export function aTstzrange(inicio: Date, fin: Date): string {
  return `[${inicio.toISOString()},${fin.toISOString()})`
}

function parsearInstante(valor: string): Date {
  let s = valor.trim().replace(/^"|"$/g, '').replace(' ', 'T')
  if (/[+-]\d{2}$/.test(s)) s += ':00'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Instante no reconocido: ${valor}`)
  }
  return d
}

/** Parsea lo que devuelve Postgres para una columna `tstzrange`. */
export function parsearTstzrange(valor: string): { inicio: Date; fin: Date } {
  const m = valor.trim().match(/^\[(.+),(.+)\)$/)
  if (!m) {
    throw new Error(`tstzrange no reconocido: ${valor}`)
  }
  return { inicio: parsearInstante(m[1]), fin: parsearInstante(m[2]) }
}

/** Suma (o resta) días a una fecha local `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${fecha}`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana a la que pertenece la fecha. La semana laboral arranca el lunes. */
export function lunesDeLaSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${fecha}`)
  const retroceso = (d.getUTCDay() + 6) % 7
  return sumarDias(fecha, -retroceso)
}

/** Fecha de hoy en hora argentina, `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return utcALocal(new Date()).fecha
}
