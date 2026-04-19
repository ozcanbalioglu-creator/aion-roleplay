'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils/cn'
import { getNavSections } from '@/lib/navigation'
import type { AppUser, UserRole } from '@/types'

interface AppSidebarProps {
  user: AppUser
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Koçluk Yolcusu',
  2: 'Gelişen Koç',
  3: 'Yetkin Koç',
  4: 'Uzman Koç',
  5: 'Usta Koç'
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const sections = getNavSections(user.role as UserRole)

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Logo placeholder */}
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">R</span>
          </div>
          <div>
            <p className="text-sidebar-foreground font-semibold text-sm leading-tight">
              Roleplay
            </p>
            <p className="text-sidebar-foreground/60 text-xs leading-tight">
              Koçluk Platformu
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, i) => (
          <SidebarGroup key={i}>
            {section.title && (
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] font-semibold tracking-wider px-4">
                {section.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          'text-sidebar-foreground/80 hover:text-sidebar-foreground',
                          isActive && 'text-sidebar-primary font-medium'
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto text-[10px] bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User level footer — sadece 'user' ve 'manager' rolü için */}
      {(user.role === 'user' || user.role === 'manager') && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sidebar-foreground/70 text-xs">
                Seviye 1 — {LEVEL_LABELS[1]}
              </span>
              <span className="text-sidebar-primary text-xs font-semibold">0 XP</span>
            </div>
            <div className="h-1.5 bg-sidebar-border rounded-full overflow-hidden">
              <div
                className="h-full bg-sidebar-primary rounded-full transition-all"
                style={{ width: '5%' }}
              />
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
