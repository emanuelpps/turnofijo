import type { SupabaseClient } from '@supabase/supabase-js'
import { aTstzrange, parsearTstzrange } from './tiempo'
import type { FranjaHoraria } from './horarios'
import type { Periodo } from './solapamiento'

/** Turnos vigentes (no cancelados) que pisan el período, opcionalmente sin uno. */
export async function turnosQueChocan(
  supabase: SupabaseClient,
  periodo: Periodo,
  excluirId?: string,
): Promise<Periodo[]> {
  let consulta = supabase
    .from('appointments')
    .select('id, periodo')
    .neq('estado', 'cancelado')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  if (excluirId) consulta = consulta.neq('id', excluirId)

  const { data } = await consulta
  return (data ?? []).map((t) => parsearTstzrange(t.periodo as string))
}

export async function bloqueosQueChocan(
  supabase: SupabaseClient,
  periodo: Periodo,
): Promise<Periodo[]> {
  const { data } = await supabase
    .from('blocks')
    .select('periodo')
    .filter('periodo', 'ov', aTstzrange(periodo.inicio, periodo.fin))

  return (data ?? []).map((b) => parsearTstzrange(b.periodo as string))
}

export async function franjasDeAtencion(supabase: SupabaseClient): Promise<FranjaHoraria[]> {
  const { data } = await supabase.from('working_hours').select('dia_semana, desde, hasta')
  return (data ?? []).map((f) => ({
    dia_semana: f.dia_semana as number,
    desde: String(f.desde).slice(0, 5),
    hasta: String(f.hasta).slice(0, 5),
  }))
}
