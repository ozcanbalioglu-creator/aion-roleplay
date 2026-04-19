import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/Toaster'
import './globals.css'

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: 'Roleplay Platform',
    template: '%s | Roleplay Platform'
  },
  description: 'AI destekli koçluk becerisi geliştirme platformu',
  keywords: ['koçluk', 'role-play', 'gelişim', 'AI'],
  robots: { index: false, follow: false }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${font.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
