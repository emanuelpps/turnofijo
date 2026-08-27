import { crearClienteServidor } from '@/lib/supabase/servidor'
import { AgendaSemanal, type EstadoDia } from '@/componentes/agenda/agenda-semanal'
import {
  aTstzrange,
  diaSemanaLocal,
  hoyLocal,
  localAUtc,
  lunesDeLaSemana,
  parsearTstzrange,
  sumarDias,
} from '@/lib/tiempo'
import { seSolapan } from '@/lib/solapamiento'
import type { Bloqueo, Paciente, Profesional, TurnoConPaciente } from '@/tipos/db'

export const metadata = { title: 'Agenda' }

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { semana } = await searchParams
  const hoy = hoyLocal()
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? '') ? semana! : hoy
  const lunes = lunesDeLaSemana(referencia)

  const desde = localAUtc(lunes, '00:00')
  const hasta = localAUtc(sumarDias(lunes, 7), '00:00')

  const supabase = await crearClienteServidor()

  const [{ data: turnos }, { data: pacientes }, { data: profesional }, { data: franjas }, { data: bloqueos }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('*, patients(nombre, telefono_e164)')
        .filter('periodo', 'ov', aTstzrange(desde, hasta)),
      supabase.from('patients').select('*').is('archivado_en', null).order('nombre'),
      supabase.from('professionals').select('*').single(),
      supabase.from('working_hours').select('dia_semana'),
      supabase.from('blocks').select('*').filter('periodo', 'ov', aTstzrange(desde, hasta)),
    ])

  // La agenda tiene que mostrar la configuración, no rebotar al profesional
  // cuando intenta agendar: si el día no se atiende o está bloqueado, se ve.
  const diasQueAtiende = new Set((franjas ?? []).map((f) => f.dia_semana as number))
  const periodosBloqueados = ((bloqueos ?? []) as Bloqueo[]).map((b) => ({
    ...parsearTstzrange(b.periodo),
    motivo: b.motivo,
  }))

  const estadoPorDia: Record<string, EstadoDia> = {}
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i)
    const inicioDia = localAUtc(fecha, '00:00')
    const finDia = localAUtc(sumarDias(fecha, 1), '00:00')
    const bloqueo = periodosBloqueados.find((b) =>
      seSolapan({ inicio: inicioDia, fin: finDia }, { inicio: b.inicio, fin: b.fin }),
    )

    estadoPorDia[fecha] = {
      atiende: diasQueAtiende.has(diaSemanaLocal(inicioDia)),
      bloqueo: bloqueo ? bloqueo.motivo || 'Bloqueado' : null,
    }
  }

  return (
    <AgendaSemanal
      lunes={lunes}
      hoy={hoy}
      turnos={(turnos ?? []) as TurnoConPaciente[]}
      pacientes={(pacientes ?? []) as Paciente[]}
      duracionDefault={(profesional as Profesional | null)?.duracion_default_min ?? 50}
      estadoPorDia={estadoPorDia}
      tieneHorarios={(franjas ?? []).length > 0}
    />
  )
}
