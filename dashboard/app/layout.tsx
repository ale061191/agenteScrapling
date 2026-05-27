import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nova Tech AI | Lead Finder Venezuela',
  description: 'Sistema de prospeccion de clientes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
