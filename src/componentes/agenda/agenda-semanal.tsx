'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  cancelarTurno,
  marcarAsistencia,
  reactivarTurno,
  type EstadoFormulario,
} from '@/acciones/turnos'
import { parsearTstzrange, utcALocal, sumarDias } from '@/lib/tiempo'
import { diaCorto, diaYMes, fechaLarga } from '@/lib/formato'
import { Boton } from '@/componentes/ui/boton'
import { Dialogo } from '@/componentes/ui/dialogo'
import { FormularioTurno } from './formulario-turno'
import type { EstadoTurno, Paciente, TurnoConPaciente } from '@/tipos/db'

/** Lo que la agenda necesita saber de un día para no mandar al vacío. */
export type EstadoDia = {
  atiende: boolean
  bloqueo: string | null
}

/**
 * Los estados llevan color Y palabra, siempre. El manual de marca (§04) lo pide
 * explícito: una parte de los usuarios no distingue verde de rojo, así que el
 * color nunca puede ser el único indicador.
 */
const ESTADOS: Record<EstadoTurno, { palabra: string; tarjeta: string; texto: string }> = {
  programado: {
    palabra: 'Sin marcar',
    tarjeta: 'border-renglon bg-papel-alt hover:border-lapiz',
    texto: 'text-lapiz',
  },
  confirmado: {
    palabra: 'Confirmó',
    tarjeta: 'border-vino/40 bg-vino-sup hover:border-vino',
    texto: 'text-vino',
  },
  asistio: {
    palabra: 'Asistió',
    tarjeta: 'border-vino/40 bg-vino-sup hover:border-vino',
    texto: 'text-vino',
  },
  ausente: {
    palabra: 'No vino',
    tarjeta: 'border-falta/40 bg-falta-sup hover:border-falta',
    texto: 'text-falta',
  },
  cancelado: {
    palabra: 'Cancelado',
    tarjeta: 'border-renglon bg-papel hover:border-lapiz',
    texto: 'text-lapiz',
  },
}

type TurnoDeVista = {
  id: string
  fecha: string
  hora: string
  horaFin: string
  duracion_min: number
  patient_id: string
  nombrePaciente: string
  estado: EstadoTurno
}

function aVista(t: TurnoConPaciente): TurnoDeVista {
  const { inicio, fin } = parsearTstzrange(t.periodo)
  const local = utcALocal(inicio)
  return {
    id: t.id,
    fecha: local.fecha,
    hora: local.hora,
    horaFin: utcALocal(fin).hora,
    duracion_min: Math.round((fin.getTime() - inicio.getTime()) / 60_000),
    patient_id: t.patient_id,
    nombrePaciente: t.patients?.nombre ?? 'Paciente',
    estado: t.estado,
  }
}

/**
 * Reactivar puede fallar si el horario se ocupó mientras el turno estaba
 * cancelado, así que necesita estado propio para poder contarlo.
 */
function BotonReactivar({ id, onListo }: { id: string; onListo: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(reactivarTurno, {})

  useEffect(() => {
    if (estado.ok) onListo()
  }, [estado.ok, onListo])

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {estado.error && (
        <p role="alert" className="rounded-marca bg-falta-sup px-3 py-2 text-sm text-falta">
          {estado.error}
        </p>
      )}
      <Boton type="submit" tamano="grande" className="w-full" disabled={pendiente}>
        {pendiente ? 'Reactivando…' : 'Reactivar turno'}
      </Boton>
    </form>
  )
}

export function AgendaSemanal({
  lunes,
  hoy,
  turnos,
  pacientes,
  duracionDefault,
  estadoPorDia,
  tieneHorarios,
}: {
  lunes: string
  hoy: string
  turnos: TurnoConPaciente[]
  pacientes: Paciente[]
  duracionDefault: number
  estadoPorDia: Record<string, EstadoDia>
  tieneHorarios: boolean
}) {
  const [nuevoEn, setNuevoEn] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<TurnoDeVista | null>(null)
  const [moviendo, setMoviendo] = useState<TurnoDeVista | null>(null)

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const vista = turnos.map(aVista)
  const vigentes = vista.filter((t) => t.estado !== 'cancelado')

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1
            className="text-[1.75rem] font-bold tracking-[-0.018em] sm:text-[2rem]"
            style={{ fontVariationSettings: '"wdth" 118' }}
          >
            Agenda
          </h1>
          <p className="mt-0.5 text-sm text-lapiz">
            {fechaLarga(lunes)} al {fechaLarga(sumarDias(lunes, 6))} ·{' '}
            {vigentes.length === 0
              ? 'sin turnos'
              : `${vigentes.length} turno${vigentes.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <nav aria-label="Cambiar de semana" className="flex items-center gap-2 text-sm">
          <Link
            href={`/agenda?semana=${sumarDias(lunes, -7)}`}
            className="inline-flex min-h-11 items-center rounded-marca border border-renglon px-3 font-medium text-tinta-sup hover:bg-papel-alt hover:text-tinta"
          >
            ← Anterior
          </Link>
          <Link
            href="/agenda"
            className="inline-flex min-h-11 items-center rounded-marca border border-renglon px-3 font-medium text-tinta-sup hover:bg-papel-alt hover:text-tinta"
          >
            Hoy
          </Link>
          <Link
            href={`/agenda?semana=${sumarDias(lunes, 7)}`}
            className="inline-flex min-h-11 items-center rounded-marca border border-renglon px-3 font-medium text-tinta-sup hover:bg-papel-alt hover:text-tinta"
          >
            Siguiente →
          </Link>
        </nav>
      </div>

      {!tieneHorarios && (
        <div className="mb-4 rounded-marca border border-birome/40 bg-birome-sup px-4 py-3">
          <p className="font-semibold text-tinta">Cargá tus horarios de atención.</p>
          <p className="mt-0.5 text-sm text-tinta-sup">
            Hasta que no los cargues no vas a poder agendar ningún turno.
          </p>
          <Link href="/configuracion" className="mt-3 inline-block">
            <Boton>Ir a Configuración</Boton>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((fecha) => {
          const delDia = vista
            .filter((t) => t.fecha === fecha)
            .sort((a, b) => (a.hora < b.hora ? -1 : 1))
          const esHoy = fecha === hoy
          const dia = estadoPorDia[fecha] ?? { atiende: true, bloqueo: null }
          const sePuedeAgendar = dia.atiende && !dia.bloqueo

          return (
            <section
              key={fecha}
              aria-label={fechaLarga(fecha)}
              className={[
                'rounded-marca border p-2',
                esHoy ? 'border-birome bg-birome-sup/40' : 'border-renglon',
                dia.bloqueo || !dia.atiende ? 'bg-papel-alt/60' : 'bg-papel',
              ].join(' ')}
            >
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <span
                  className={[
                    'font-display text-sm font-bold',
                    esHoy ? 'text-birome' : 'text-tinta',
                  ].join(' ')}
                >
                  {diaCorto(fecha)}
                </span>
                <span className="tabular text-xs text-lapiz">{diaYMes(fecha)}</span>
                {esHoy && <span className="etiqueta ml-auto text-birome">Hoy</span>}
              </div>

              {dia.bloqueo && (
                <p className="mb-2 truncate rounded bg-espera-sup px-1.5 py-1 text-xs font-semibold text-espera">
                  {dia.bloqueo}
                </p>
              )}

              <ul className="space-y-1">
                {delDia.map((t) => {
                  const estado = ESTADOS[t.estado]
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setAbierto(t)}
                        className={`w-full rounded-marca border px-2 py-2 text-left transition-colors ${estado.tarjeta}`}
                      >
                        <span
                          className={[
                            'tabular font-display block text-base leading-tight font-bold',
                            t.estado === 'cancelado' ? 'text-lapiz line-through' : 'text-tinta',
                          ].join(' ')}
                        >
                          {t.hora}
                        </span>
                        <span
                          className={[
                            'block truncate text-sm font-semibold',
                            t.estado === 'cancelado'
                              ? 'text-lapiz line-through'
                              : 'text-tinta-sup',
                          ].join(' ')}
                        >
                          {t.nombrePaciente}
                        </span>
                        {t.estado !== 'programado' && (
                          <span className={`etiqueta mt-0.5 block ${estado.texto}`}>
                            {estado.palabra}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {sePuedeAgendar ? (
                <button
                  onClick={() => setNuevoEn(fecha)}
                  className="mt-2 min-h-11 w-full rounded-marca border border-dashed border-renglon text-sm font-medium text-lapiz hover:border-birome hover:text-birome"
                >
                  + Turno
                </button>
              ) : (
                <p className="mt-2 px-1 py-2 text-center text-xs text-lapiz">
                  {dia.bloqueo ? 'Día bloqueado' : 'No atendés este día'}
                </p>
              )}
            </section>
          )
        })}
      </div>

      <Dialogo abierto={nuevoEn !== null} onCerrar={() => setNuevoEn(null)} titulo="Nuevo turno">
        {nuevoEn && (
          <FormularioTurno
            key={nuevoEn}
            turno={{ fecha: nuevoEn, hora: '', duracion_min: duracionDefault }}
            pacientes={pacientes}
            onGuardado={() => setNuevoEn(null)}
          />
        )}
      </Dialogo>

      <Dialogo abierto={moviendo !== null} onCerrar={() => setMoviendo(null)} titulo="Mover turno">
        {moviendo && (
          <FormularioTurno
            key={moviendo.id}
            turno={{
              id: moviendo.id,
              patient_id: moviendo.patient_id,
              nombrePaciente: moviendo.nombrePaciente,
              fecha: moviendo.fecha,
              hora: moviendo.hora,
              duracion_min: moviendo.duracion_min,
            }}
            pacientes={pacientes}
            onGuardado={() => setMoviendo(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        abierto={abierto !== null}
        onCerrar={() => setAbierto(null)}
        titulo={abierto ? abierto.nombrePaciente : ''}
      >
        {abierto && (
          <div className="space-y-4">
            <div className="rounded-marca border border-renglon bg-papel-alt px-4 py-3">
              <p className="tabular font-display text-2xl font-bold text-tinta">
                {abierto.hora}{' '}
                <span className="text-base font-normal text-lapiz">a {abierto.horaFin}</span>
              </p>
              <p className="mt-1 text-sm text-tinta-sup">
                {fechaLarga(abierto.fecha)} · {abierto.duracion_min} min
              </p>
              <p className={`etiqueta mt-2 ${ESTADOS[abierto.estado].texto}`}>
                {ESTADOS[abierto.estado].palabra}
              </p>
            </div>

            {abierto.estado === 'cancelado' ? (
              <BotonReactivar id={abierto.id} onListo={() => setAbierto(null)} />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <form
                    action={marcarAsistencia}
                    onSubmit={() => setAbierto(null)}
                    className="flex-1"
                  >
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="asistio" />
                    <Boton type="submit" tamano="grande" className="w-full">
                      Asistió
                    </Boton>
                  </form>
                  <form
                    action={marcarAsistencia}
                    onSubmit={() => setAbierto(null)}
                    className="flex-1"
                  >
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="ausente" />
                    <Boton type="submit" tamano="grande" variante="secundario" className="w-full">
                      No vino
                    </Boton>
                  </form>
                </div>

                <Boton
                  variante="secundario"
                  className="w-full"
                  onClick={() => {
                    setMoviendo(abierto)
                    setAbierto(null)
                  }}
                >
                  Mover a otro día u hora
                </Boton>

                <form action={cancelarTurno} onSubmit={() => setAbierto(null)}>
                  <input type="hidden" name="id" value={abierto.id} />
                  <Boton type="submit" variante="peligro" className="w-full">
                    Cancelar turno
                  </Boton>
                </form>
              </div>
            )}
          </div>
        )}
      </Dialogo>
    </div>
  )
}
