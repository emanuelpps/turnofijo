import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Turno Fijo',
  description: 'Agenda de turnos para profesionales que trabajan con sesiones recurrentes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
