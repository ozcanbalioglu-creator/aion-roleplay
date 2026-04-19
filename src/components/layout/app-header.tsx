'use client'

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
    <header className="flex h-14 items-center gap-2 border-b bg-card px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4 mr-2" />

      {/* Tenant branding */}
      {tenant && (
        <div className="flex items-center gap-2">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-6 w-auto object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">{tenant.name}</span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative" aria-label="Bildirimler">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatar_url} alt={user.full_name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium leading-tight">{user.full_name}</span>
              <span className="text-xs text-muted-foreground leading-tight">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Profilim
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Çıkış Yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
