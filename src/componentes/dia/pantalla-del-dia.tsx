'use client'

import Link from 'next/link'
import { marcarAsistencia } from '@/acciones/turnos'
import { formatearTelefonoParaMostrar } from '@/lib/telefono'
import { fechaLarga } from '@/lib/formato'
import { parsearTstzrange, utcALocal, sumarDias } from '@/lib/tiempo'
import { Boton } from '@/componentes/ui/boton'
import type { EstadoTurno, TurnoConPaciente } from '@/tipos/db'

/**
 * Mismo criterio que la agenda semanal: el estado se escribe, no se insinúa con
 * color. Acá pesa el doble, porque esta pantalla se mira de reojo entre paciente
 * y paciente, muchas veces a contraluz.
 */
const ESTADOS: Record<EstadoTurno, { palabra: string; tarjeta: string; texto: string }> = {
  programado: { palabra: '', tarjeta: 'border-renglon bg-papel', texto: 'text-lapiz' },
  confirmado: {
    palabra: 'Confirmó',
    tarjeta: 'border-vino/40 bg-vino-sup',
    texto: 'text-vino-texto',
  },
  asistio: { palabra: 'Asistió', tarjeta: 'border-vino/40 bg-vino-sup', texto: 'text-vino-texto' },
  ausente: {
    palabra: 'No vino',
    tarjeta: 'border-falta/40 bg-falta-sup',
    texto: 'text-falta-texto',
  },
  cancelado: { palabra: 'Cancelado', tarjeta: 'border-renglon bg-papel-alt', texto: 'text-lapiz' },
}

const FLECHA =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-marca border border-renglon text-tinta-sup hover:bg-papel-alt hover:text-tinta'

export function PantallaDelDia({
  fecha,
  hoy,
  turnos,
}: {
  fecha: string
  hoy: string
  turnos: TurnoConPaciente[]
}) {
  const items = turnos
    .map((t) => {
      const { inicio, fin } = parsearTstzrange(t.periodo)
      return {
        id: t.id,
        hora: utcALocal(inicio).hora,
        hasta: utcALocal(fin).hora,
        nombre: t.patients?.nombre ?? 'Paciente',
        telefono: t.patients?.telefono_e164 ?? '',
        estado: t.estado,
        deSerie: t.series_id !== null,
      }
    })
    .sort((a, b) => (a.hora < b.hora ? -1 : 1))

  const vigentes = items.filter((i) => i.estado !== 'cancelado')
  const pendientes = items.filter((i) => i.estado === 'programado' || i.estado === 'confirmado')

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/hoy?fecha=${sumarDias(fecha, -1)}`}
          className={FLECHA}
          aria-label="Día anterior"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="font-display text-lg font-bold text-tinta">
            {fecha === hoy ? 'Hoy' : fechaLarga(fecha)}
          </h1>
          <p className="mt-0.5 text-sm text-lapiz">
            {fecha === hoy && <>{fechaLarga(fecha)} · </>}
            {vigentes.length === 0
              ? 'Sin turnos'
              : `${vigentes.length} turno${vigentes.length === 1 ? '' : 's'} · ${pendientes.length} sin marcar`}
          </p>
        </div>
        <Link
          href={`/hoy?fecha=${sumarDias(fecha, 1)}`}
          className={FLECHA}
          aria-label="Día siguiente"
        >
          →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-marca border border-dashed border-renglon p-10 text-center text-sm text-lapiz">
          No tenés turnos este día.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => {
            const estado = ESTADOS[t.estado]
            const cancelado = t.estado === 'cancelado'
            return (
              <li key={t.id} className={`rounded-marca border p-4 ${estado.tarjeta}`}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span
                    className={[
                      'tabular font-display text-2xl leading-none font-bold',
                      cancelado ? 'text-lapiz line-through' : 'text-tinta',
                    ].join(' ')}
                  >
                    {t.hora}
                  </span>
                  <span className="tabular text-sm text-lapiz">a {t.hasta}</span>
                  {t.deSerie && (
                    <>
                      <span aria-hidden="true" className="text-sm text-lapiz">
                        ↻
                      </span>
                      <span className="sr-only">Turno de una serie</span>
                    </>
                  )}
                  {estado.palabra && (
                    <span className={`etiqueta ml-auto ${estado.texto}`}>{estado.palabra}</span>
                  )}
                </div>

                <p
                  className={[
                    'text-lg font-semibold',
                    cancelado ? 'text-lapiz line-through' : 'text-tinta',
                  ].join(' ')}
                >
                  {t.nombre}
                </p>
                {t.telefono && (
                  // Link tel: a propósito. Si el paciente no llegó, se lo llama
                  // desde acá, sin ir a buscar la ficha.
                  <a
                    href={`tel:${t.telefono}`}
                    className="tabular inline-flex min-h-11 items-center text-sm text-birome underline"
                  >
                    {formatearTelefonoParaMostrar(t.telefono)}
                  </a>
                )}

                {(t.estado === 'programado' || t.estado === 'confirmado') && (
                  <div className="mt-3 flex gap-2">
                    <form action={marcarAsistencia} className="flex-1">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value="asistio" />
                      <Boton type="submit" tamano="grande" className="w-full">
                        Asistió
                      </Boton>
                    </form>
                    <form action={marcarAsistencia} className="flex-1">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value="ausente" />
                      <Boton type="submit" tamano="grande" variante="secundario" className="w-full">
                        No vino
                      </Boton>
                    </form>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
