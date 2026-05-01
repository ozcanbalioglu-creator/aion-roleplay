'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessagesSquare, Trophy, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useIsMobile } from '@/hooks/use-mobile'

// P1-UX-001 / F4 (2026-05-01): "Gelişim" item'ı kaldırıldı — Dashboard tek
// kaynak hâline geldi (eski /dashboard/progress → /dashboard redirect).
const MOBILE_NAV_ITEMS = [
  { label: 'Ana Sayfa', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Seanslar', href: '/dashboard/sessions', icon: MessagesSquare },
  { label: 'Başarılar', href: '/dashboard/achievements', icon: Trophy },
  { label: 'Profil', href: '/dashboard/profile', icon: UserCircle },
]

// FOUC fix v2 (B1): useIsMobile koşullu render. Tailwind responsive class
// (md:hidden veya hidden max-md:flex) initial render'da CSS yüklenmeden
// HTML rendered olduğu kısa anda nav'ı sayfa ortasında flash ediyordu.
// useIsMobile ilk render'da false döner (initial state undefined) → SSR ve
// initial client render eşleşir (her ikisi de null) → hydration sonrası
// useEffect tetiklenir → mobile ise gerçek nav mount eder. Desktop'ta nav
// HİÇ render edilmez, FOUC imkânsız.
export function MobileNav() {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  if (!isMobile) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex">
      <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/10')} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
