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
    <div className="max-w-3xl space-y-10">
      <div>
        <h1
          className="text-[1.75rem] font-bold tracking-[-0.018em] sm:text-[2rem]"
          style={{ fontVariationSettings: '"wdth" 118' }}
        >
          Configuración
        </h1>
        <p className="mt-0.5 text-sm text-lapiz">Cuándo atendés y cuándo no.</p>
      </div>

      <FormularioHorarios
        franjas={(franjas ?? []) as FranjaHorariaFila[]}
        duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
      />

      <hr className="border-renglon" />

      <PanelBloqueos bloqueos={(bloqueos ?? []) as Bloqueo[]} />
    </div>
  )
}
