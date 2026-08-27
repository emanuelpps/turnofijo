import { dentroDeHorarioDeAtencion, type FranjaHoraria } from './horarios'
import { chocaConAlguno, type Periodo } from './solapamiento'
import { sumarMinutos } from './tiempo'

export type MotivoRechazo = 'fuera_de_horario' | 'bloqueado' | 'superpuesto'

export type ResultadoValidacion = { ok: true } | { ok: false; motivo: MotivoRechazo }

export const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  fuera_de_horario: 'Ese horario está fuera de tus horarios de atención.',
  bloqueado: 'Ese día está bloqueado en tu agenda.',
  superpuesto: 'Ya tenés otro turno en ese horario.',
}

export type ArgumentosValidacion = {
  inicio: Date
  duracionMin: number
  franjas: FranjaHoraria[]
  bloqueos: Periodo[]
  turnosExistentes: Periodo[]
}

/**
 * Contesta si un turno se puede agendar y, si no, por qué. El orden de los
 * chequeos define el mensaje que ve el profesional cuando falla más de una
 * cosa: primero lo estructural (horario), después lo circunstancial.
 */
export function validarTurno({
  inicio,
  duracionMin,
  franjas,
  bloqueos,
  turnosExistentes,
}: ArgumentosValidacion): ResultadoValidacion {
  if (!dentroDeHorarioDeAtencion(inicio, duracionMin, franjas)) {
    return { ok: false, motivo: 'fuera_de_horario' }
  }

  const periodo: Periodo = { inicio, fin: sumarMinutos(inicio, duracionMin) }

  if (chocaConAlguno(periodo, bloqueos)) {
    return { ok: false, motivo: 'bloqueado' }
  }

  if (chocaConAlguno(periodo, turnosExistentes)) {
    return { ok: false, motivo: 'superpuesto' }
  }

  return { ok: true }
}
