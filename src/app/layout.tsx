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
        {/* FOUC defense — Tailwind CSS yüklenmeden önce responsive hide/show kuralları
            uygulansın diye kritik inline CSS. AppHeader'daki orta nav ve kullanıcı adı
            bloku (md+ breakpoint'te görünen) Tailwind gelmeden önce default `display: block`
            ile bir an görünüyordu (kısmi header flash). Aşağıdaki kurallar Tailwind'den
            ÖNCE devreye girip elementleri varsayılan olarak gizler; md+ breakpoint'te
            flex'e çevirir. Tailwind yüklendiğinde aynı `hidden md:flex` zaten kuralı
            koruyor — çakışma yok, geri sıçrama yok. */}
        <style dangerouslySetInnerHTML={{ __html: `
          .fouc-md-flex { display: none; }
          @media (min-width: 768px) { .fouc-md-flex { display: flex; } }
          .fouc-md-hidden { display: revert; }
          @media (min-width: 768px) { .fouc-md-hidden { display: none !important; } }
        `}} />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@200..700,0..1,-50..200,20..48&display=swap" rel="stylesheet" />
      </head>
      <body className={`${fontBody.variable} ${fontHeadline.variable} font-body antialiased`} suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
