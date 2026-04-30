'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessagesSquare, BarChart3, Trophy, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const MOBILE_NAV_ITEMS = [
  { label: 'Ana Sayfa', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Seanslar', href: '/dashboard/sessions', icon: MessagesSquare },
  { label: 'Gelişim', href: '/dashboard/progress', icon: BarChart3 },
  { label: 'Başarılar', href: '/dashboard/achievements', icon: Trophy },
  { label: 'Profil', href: '/dashboard/profile', icon: UserCircle },
]

// FOUC fix: `hidden max-md:flex` kombinasyonu, CSS yüklenmeden HTML render edildiği
// kısa anda nav'ı default-gizli tutar (eski `md:hidden` tek başına default block element
// olarak nav'ı initial render'da sayfa ortasında flash ediyordu).
// Refresh sonrası kayboluyordu çünkü cache'li CSS hızlı uygulanıyordu.
export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t hidden max-md:flex">
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
