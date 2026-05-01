'use client'

import Link from 'next/link'
import { Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import type { AppUser, Tenant } from '@/types'

interface AppHeaderProps {
  user: AppUser
  tenant: Tenant | null
  unreadCount?: number
  onSignOut: () => void
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Süper Admin',
  tenant_admin: 'Şirket Admin',
  hr_admin: 'İK Admin',
  hr_viewer: 'İK Görüntüleyici',
  manager: 'Yönetici',
  user: 'Kullanıcı'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AppHeader({ user, tenant, unreadCount = 0, onSignOut }: AppHeaderProps) {
  return (
    <header className="flex h-20 items-center justify-between gap-2 px-8 lg:px-12 bg-surface/80 backdrop-blur-md z-30 sticky top-0">
      <div className="flex items-center gap-6">
        <SidebarTrigger className="-ml-2 text-on-surface hover:bg-surface-container-low transition-colors rounded-full" />
        
        {/* Tenant branding — super_admin için gösterme */}
        {tenant && user.role !== 'super_admin' && (
          <div className="flex items-center gap-2">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-6 w-auto object-contain"
              />
            ) : (
              <span className="text-xl font-headline italic font-semibold text-on-background">{tenant.name}</span>
            )}
          </div>
        )}
      </div>

      {/* Merkez/Kütüphane nav — sadece user/manager için.
          P1-UX-001 / F4 (2026-05-01): "Gelişim" linki kaldırıldı; Dashboard
          (/dashboard) tek kaynak. Eski /dashboard/progress → /dashboard redirect.
          fouc-md-flex: Tailwind yüklenmeden önce kritik inline CSS bu class'ı görüp
          elementi gizli tutar (FOUC defense, app/layout.tsx'teki <style> bloğuna bak). */}
      {(user.role === 'user' || user.role === 'manager') && (
        <nav className="hidden md:flex fouc-md-flex space-x-6 absolute left-1/2 -translate-x-1/2">
          <Link href="/dashboard" className="text-on-primary-container border-b-2 border-on-primary-container pb-1 font-body font-medium text-sm transition-all duration-300">Merkez</Link>
          <Link href="/dashboard/sessions" className="text-on-surface-variant hover:text-on-surface font-body font-medium text-sm transition-all duration-300">Kütüphane</Link>
        </nav>
      )}

      <div className="flex items-center gap-6">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant" aria-label="Bildirimler">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute 0-right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="hidden md:flex fouc-md-flex flex-col items-end">
                <span className="text-sm font-semibold font-body text-on-background leading-tight group-hover:text-on-primary-container transition-colors">{user.full_name}</span>
                <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest mt-1">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
              <Avatar className="h-10 w-10 border border-outline-variant/20 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name} className="object-cover" />
                <AvatarFallback className="bg-surface-container-highest text-on-primary-container text-xs font-bold">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 border-outline-variant/10 shadow-2xl rounded-xl bg-surface p-2">
            <DropdownMenuLabel className="font-normal px-2 py-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold text-on-background">{user.full_name}</p>
                <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-outline-variant/10" />
            <DropdownMenuItem asChild className="focus:bg-surface-container-low rounded-lg py-3 cursor-pointer text-sm font-medium">
              <Link href="/dashboard/profile">
                <User className="mr-3 h-4 w-4 text-on-primary-container" />
                Profesyonel Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-outline-variant/10" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-error-container/20 rounded-lg py-3 cursor-pointer text-sm font-medium"
              onClick={onSignOut}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sistemden Ayrıl
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
