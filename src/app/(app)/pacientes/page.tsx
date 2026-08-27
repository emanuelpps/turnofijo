import { crearClienteServidor } from '@/lib/supabase/servidor'
import { ListaPacientes } from '@/componentes/pacientes/lista-pacientes'
import type { Paciente } from '@/tipos/db'

export default async function PacientesPage() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('patients')
    .select('*')
    .order('nombre', { ascending: true })

  return <ListaPacientes pacientes={(data ?? []) as Paciente[]} />
}
