'use client'

import Link from 'next/link'
import Image from 'next/image'
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
import type { FeatureKey } from '@/lib/features'
import { Sparkles } from 'lucide-react'
import { LevelBar } from '@/components/ui/LevelBar'

interface AppSidebarProps {
  user: AppUser
  gamProfile?: {
    level: number
    progressPercent: number
    xp_points: number
    nextLevelXP: number
  } | null
  flags?: Partial<Record<FeatureKey, boolean>>
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Koçluk Yolcusu',
  2: 'Gelişen Koç',
  3: 'Yetkin Koç',
  4: 'Uzman Koç',
  5: 'Usta Koç'
}

export function AppSidebar({ user, gamProfile, flags }: AppSidebarProps) {
  const pathname = usePathname()
  const sections = getNavSections(user.role as UserRole, flags)

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/30 px-6 py-6">
        <div className="flex flex-col gap-1.5">
          <Image
            src="/aion_more_genis.png"
            alt="AION MORE"
            width={140}
            height={44}
            className="object-contain object-left"
            style={{ width: '140px', height: 'auto' }}
            priority
          />
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold font-label">
            Role Play System
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {sections.map((section, i) => (
          <SidebarGroup key={i} className="mb-4">
            {section.title && (
              <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] font-bold tracking-[0.2em] px-4 mb-2">
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
                          'transition-all duration-300 rounded-full my-1 py-6 px-4',
                          isActive 
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-md' 
                            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-border/30 font-medium'
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-5 w-5" />
                          <span className="ml-2 font-body">{item.label}</span>
                          {item.badge && (
                            <span className={cn(
                              "ml-auto text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
                              isActive ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground" : "bg-sidebar-primary/20 text-sidebar-primary"
                            )}>
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
        
        {/* CTA Section — sadece session başlatabilecek roller için */}
        {user.role !== 'super_admin' && user.role !== 'tenant_admin' && (
          <div className="px-4 mt-8 pb-4">
            <Link
              href="/dashboard/sessions/new"
              className="w-full py-4 px-4 bg-sidebar-foreground text-sidebar rounded-full text-sm font-bold shadow-lg shadow-sidebar-foreground/10 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Yeni Yansıma
            </Link>
          </div>
        )}
      </SidebarContent>

      {/* User level footer — sadece 'user' ve 'manager' rolü için */}
      {(user.role === 'user' || user.role === 'manager') && gamProfile && (
        <SidebarFooter className="border-t border-sidebar-border/30 p-4 bg-sidebar-accent/5">
          <LevelBar
            level={gamProfile.level}
            progressPercent={gamProfile.progressPercent}
            xpPoints={gamProfile.xp_points}
            nextLevelXP={gamProfile.nextLevelXP}
            compact
          />
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
