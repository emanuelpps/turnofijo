export type Periodo = { inicio: Date; fin: Date }

/**
 * Semántica `[inicio, fin)`, igual que el `tstzrange` de Postgres: dos turnos
 * pegados (uno termina 15:50, el otro arranca 15:50) NO se solapan.
 */
export function seSolapan(a: Periodo, b: Periodo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime()
}

export function chocaConAlguno(p: Periodo, otros: Periodo[]): boolean {
  return otros.some((otro) => seSolapan(p, otro))
}
