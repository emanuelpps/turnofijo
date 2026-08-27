export type Paciente = {
  id: string
  professional_id: string
  nombre: string
  telefono_e164: string
  email: string | null
  notas_administrativas: string | null
  contactable: boolean
  consentimiento_wa_en: string | null
  archivado_en: string | null
  creado_en: string
}

export type FranjaHorariaFila = {
  id: string
  professional_id: string
  dia_semana: number
  /** `HH:MM:SS` — Postgres devuelve `time` con segundos. */
  desde: string
  hasta: string
}

export type Bloqueo = {
  id: string
  professional_id: string
  /** `tstzrange` sin parsear, como lo devuelve Postgres. */
  periodo: string
  motivo: string
}

export type EstadoTurno = 'programado' | 'confirmado' | 'cancelado' | 'asistio' | 'ausente'

export type Turno = {
  id: string
  professional_id: string
  patient_id: string
  series_id: string | null
  periodo: string
  estado: EstadoTurno
  cancelado_por: 'profesional' | 'paciente' | 'sistema' | null
}

export type TurnoConPaciente = Turno & {
  patients: { nombre: string; telefono_e164: string } | null
}

export type Profesional = {
  id: string
  nombre: string
  especialidad: 'psicologia' | 'nutricion' | 'otra'
  email: string
  telefono_contacto: string | null
  duracion_default_min: number
  timezone: string
}
