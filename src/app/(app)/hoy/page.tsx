import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PantallaDelDia } from '@/componentes/dia/pantalla-del-dia'
import { aTstzrange, hoyLocal, localAUtc, sumarDias } from '@/lib/tiempo'
import type { TurnoConPaciente } from '@/tipos/db'

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha: fechaCruda } = await searchParams
  const hoy = hoyLocal()
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaCruda ?? '') ? fechaCruda! : hoy

  const desde = localAUtc(fecha, '00:00')
  const hasta = localAUtc(sumarDias(fecha, 1), '00:00')

  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('appointments')
    .select('*, patients(nombre, telefono_e164)')
    .filter('periodo', 'ov', aTstzrange(desde, hasta))

  return <PantallaDelDia fecha={fecha} hoy={hoy} turnos={(data ?? []) as TurnoConPaciente[]} />
}
