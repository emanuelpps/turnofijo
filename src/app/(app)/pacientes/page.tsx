import { crearClienteServidor } from '@/lib/supabase/servidor'
import { ListaPacientes } from '@/componentes/pacientes/lista-pacientes'
import type { Paciente } from '@/tipos/db'

export const metadata = { title: 'Pacientes' }

export default async function PacientesPage() {
  const supabase = await crearClienteServidor()

  const [{ data }, { data: turnosPorDelante }] = await Promise.all([
    supabase.from('patients').select('*').order('nombre', { ascending: true }),
    // Archivar un paciente no le cancela los turnos: si tiene algunos por
    // delante, el profesional tiene que verlo antes de archivarlo y no
    // enterarse por un hueco raro en la agenda.
    supabase
      .from('appointments')
      .select('patient_id')
      .neq('estado', 'cancelado')
      .filter('periodo', 'ov', `[${new Date().toISOString()},)`),
  ])

  const porDelante: Record<string, number> = {}
  for (const t of turnosPorDelante ?? []) {
    const id = t.patient_id as string
    porDelante[id] = (porDelante[id] ?? 0) + 1
  }

  return <ListaPacientes pacientes={(data ?? []) as Paciente[]} turnosPorDelante={porDelante} />
}
