/**
 * Cambiar de semana vuelve al servidor. Sin esto la pantalla se queda quieta
 * y no hay forma de saber si el click entró.
 */
export default function CargandoAgenda() {
  return (
    <div aria-busy="true" aria-label="Cargando la agenda">
      <div className="mb-5 h-14 w-64 animate-pulse rounded-marca bg-papel-alt" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-marca bg-papel-alt" />
        ))}
      </div>
    </div>
  )
}
