'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cancelarTurno, marcarAsistencia, reactivarTurno } from '@/acciones/turnos'
import { parsearTstzrange, utcALocal, sumarDias } from '@/lib/tiempo'
import { Boton } from '@/componentes/ui/boton'
import { Dialogo } from '@/componentes/ui/dialogo'
import { FormularioTurno, type TurnoEnEdicion } from './formulario-turno'
import type { EstadoTurno, Paciente, TurnoConPaciente } from '@/tipos/db'

const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLOR_ESTADO: Record<EstadoTurno, string> = {
  programado: 'bg-zinc-100 text-zinc-900',
  confirmado: 'bg-green-100 text-green-900',
  cancelado: 'bg-zinc-50 text-zinc-400 line-through',
  asistio: 'bg-blue-100 text-blue-900',
  ausente: 'bg-red-100 text-red-900',
}

type TurnoDeVista = {
  id: string
  fecha: string
  hora: string
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
    duracion_min: Math.round((fin.getTime() - inicio.getTime()) / 60_000),
    patient_id: t.patient_id,
    nombrePaciente: t.patients?.nombre ?? 'Paciente',
    estado: t.estado,
  }
}

export function AgendaSemanal({
  lunes,
  turnos,
  pacientes,
  duracionDefault,
}: {
  lunes: string
  turnos: TurnoConPaciente[]
  pacientes: Paciente[]
  duracionDefault: number
}) {
  const [nuevoEn, setNuevoEn] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<TurnoDeVista | null>(null)
  const [moviendo, setMoviendo] = useState<TurnoDeVista | null>(null)

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const vista = turnos.map(aVista)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Link href={`/agenda?semana=${sumarDias(lunes, -7)}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            ← Semana anterior
          </Link>
          <Link href="/agenda" className="rounded-lg border border-zinc-300 px-3 py-2">
            Hoy
          </Link>
          <Link href={`/agenda?semana=${sumarDias(lunes, 7)}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            Semana siguiente →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {dias.map((fecha, i) => {
          const delDia = vista
            .filter((t) => t.fecha === fecha)
            .sort((a, b) => (a.hora < b.hora ? -1 : 1))

          return (
            <div key={fecha} className="rounded-lg border border-zinc-200 p-2">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-medium">{NOMBRES_DIA[i]}</span>
                <span className="text-xs text-zinc-500">{fecha.slice(8)}/{fecha.slice(5, 7)}</span>
              </div>

              <ul className="space-y-1">
                {delDia.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setAbierto(t)}
                      className={`w-full rounded px-2 py-1.5 text-left text-sm ${COLOR_ESTADO[t.estado]}`}
                    >
                      <span className="font-medium">{t.hora}</span>{' '}
                      <span className="truncate">{t.nombrePaciente}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setNuevoEn(fecha)}
                className="mt-2 w-full rounded border border-dashed border-zinc-300 py-1.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
              >
                + Turno
              </button>
            </div>
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

      <Dialogo
        abierto={moviendo !== null}
        onCerrar={() => setMoviendo(null)}
        titulo="Mover turno"
      >
        {moviendo && (
          <FormularioTurno
            key={moviendo.id}
            turno={{
              id: moviendo.id,
              patient_id: moviendo.patient_id,
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
            <p className="text-sm text-zinc-600">
              {abierto.fecha} a las {abierto.hora} · {abierto.duracion_min} min ·{' '}
              <span className="font-medium">{abierto.estado}</span>
            </p>

            {abierto.estado === 'cancelado' ? (
              <form action={reactivarTurno} onSubmit={() => setAbierto(null)}>
                <input type="hidden" name="id" value={abierto.id} />
                <Boton type="submit" variante="secundario" className="w-full">
                  Reactivar turno
                </Boton>
              </form>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <form action={marcarAsistencia} onSubmit={() => setAbierto(null)} className="flex-1">
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="asistio" />
                    <Boton type="submit" className="w-full">
                      Asistió
                    </Boton>
                  </form>
                  <form action={marcarAsistencia} onSubmit={() => setAbierto(null)} className="flex-1">
                    <input type="hidden" name="id" value={abierto.id} />
                    <input type="hidden" name="estado" value="ausente" />
                    <Boton type="submit" variante="secundario" className="w-full">
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
                  Mover
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
