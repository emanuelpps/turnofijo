import { diaSemanaLocal, minutosLocales } from './tiempo'

export type FranjaHoraria = {
  /** 0 = domingo, 6 = sábado. */
  dia_semana: number
  /** `HH:MM` local. */
  desde: string
  /** `HH:MM` local. */
  hasta: string
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Franjas del día local del instante dado, ordenadas por hora de apertura. */
export function franjasDelDia(inicio: Date, franjas: FranjaHoraria[]): FranjaHoraria[] {
  const dia = diaSemanaLocal(inicio)
  return franjas
    .filter((f) => f.dia_semana === dia)
    .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
}

/**
 * ¿El turno `[inicio, inicio + duración)` entra entero en alguna franja de
 * atención? Un turno que cruza la medianoche siempre es `false`: el modelo de
 * franjas es por día, y ningún consultorio de este nicho atiende a esa hora.
 */
export function dentroDeHorarioDeAtencion(
  inicio: Date,
  duracionMin: number,
  franjas: FranjaHoraria[],
): boolean {
  if (duracionMin <= 0) return false

  const arranca = minutosLocales(inicio)
  const termina = arranca + duracionMin
  if (termina > 24 * 60) return false // cruzaría la medianoche

  return franjasDelDia(inicio, franjas).some(
    (f) => arranca >= aMinutos(f.desde) && termina <= aMinutos(f.hasta),
  )
}
