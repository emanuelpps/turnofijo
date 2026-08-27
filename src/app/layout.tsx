import type { Metadata, Viewport } from 'next'
import { Archivo, Chivo } from 'next/font/google'
import './globals.css'

// Las dos familias son de Omnibus-Type, fundición de Buenos Aires. No es un
// dato decorativo: una marca que se vende diciendo "estamos acá" no puede
// estar escrita con la tipografía por defecto de todo el mundo.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--fuente-display',
  display: 'swap',
})

const chivo = Chivo({
  subsets: ['latin'],
  variable: '--fuente-texto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Turno Fijo',
  description: 'Agenda de turnos para profesionales que trabajan con sesiones recurrentes',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0f141c' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${chivo.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
