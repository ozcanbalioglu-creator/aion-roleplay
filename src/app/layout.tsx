import type { Metadata } from 'next'
import { Manrope, Newsreader } from 'next/font/google'
import { Toaster } from '@/components/ui/Toaster'
import './globals.css'

const fontBody = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  display: 'swap'
})

const fontHeadline = Newsreader({
  subsets: ['latin'],
  variable: '--font-headline',
  style: ['normal', 'italic'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: 'AION MIRROR',
    template: '%s | AION MIRROR'
  },
  description: 'AI destekli koçluk becerisi geliştirme platformu',
  keywords: ['koçluk', 'role-play', 'gelişim', 'AI', 'AION Mirror'],
  robots: { index: false, follow: false }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@200..700,0..1,-50..200,20..48&display=swap" rel="stylesheet" />
      </head>
      <body className={`${fontBody.variable} ${fontHeadline.variable} font-body antialiased`} suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
