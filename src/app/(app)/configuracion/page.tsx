import { crearClienteServidor } from '@/lib/supabase/servidor'
import { FormularioHorarios } from '@/componentes/configuracion/formulario-horarios'
import { PanelBloqueos } from '@/componentes/configuracion/panel-bloqueos'
import type { Bloqueo, FranjaHorariaFila, Profesional } from '@/tipos/db'

export default async function ConfiguracionPage() {
  const supabase = await crearClienteServidor()

  const [{ data: profesional }, { data: franjas }, { data: bloqueos }] = await Promise.all([
    supabase.from('professionals').select('*').single(),
    supabase.from('working_hours').select('*'),
    supabase.from('blocks').select('*').order('periodo', { ascending: true }),
  ])

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <FormularioHorarios
        franjas={(franjas ?? []) as FranjaHorariaFila[]}
        duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
      />
      <PanelBloqueos bloqueos={(bloqueos ?? []) as Bloqueo[]} />
    </div>
  )
}
