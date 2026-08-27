import { crearClienteServidor } from '@/lib/supabase/servidor'
import { AgendaSemanal } from '@/componentes/agenda/agenda-semanal'
import { aTstzrange, hoyLocal, localAUtc, lunesDeLaSemana, sumarDias } from '@/lib/tiempo'
import type { Paciente, Profesional, TurnoConPaciente } from '@/tipos/db'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { semana } = await searchParams
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? '') ? semana! : hoyLocal()
  const lunes = lunesDeLaSemana(referencia)

  const desde = localAUtc(lunes, '00:00')
  const hasta = localAUtc(sumarDias(lunes, 7), '00:00')

  const supabase = await crearClienteServidor()

  const [{ data: turnos }, { data: pacientes }, { data: profesional }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, patients(nombre, telefono_e164)')
      .filter('periodo', 'ov', aTstzrange(desde, hasta)),
    supabase.from('patients').select('*').is('archivado_en', null).order('nombre'),
    supabase.from('professionals').select('*').single(),
  ])

  return (
    <AgendaSemanal
      lunes={lunes}
      turnos={(turnos ?? []) as TurnoConPaciente[]}
      pacientes={(pacientes ?? []) as Paciente[]}
      duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
    />
  )
}
