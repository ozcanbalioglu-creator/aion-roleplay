import type { UserRole } from '@/types'
import type { FeatureKey } from '@/lib/features'
import {
  LayoutDashboard,
  MessagesSquare,
  BarChart3,
  Users,
  UserCircle,
  Shield,
  BookOpen,
  Mic,
  Trophy,
  Bell,
  Building2,
  FileText,
  MessageSquare,
  Server,
  Settings,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  feature?: FeatureKey
  children?: NavItem[]
}

export interface NavSection {
  title?: string          // bölüm başlığı (opsiyonel)
  items: NavItem[]
}

export const NAV_CONFIG: Record<UserRole, NavSection[]> = {
  user: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Seans Başlat', href: '/dashboard/sessions/new', icon: Mic, feature: 'voice' },
        { label: 'Seanslarım', href: '/dashboard/sessions', icon: MessagesSquare },
        { label: 'Gelişimim', href: '/dashboard/progress', icon: BarChart3, feature: 'progressPage' },
        { label: 'Başarılarım', href: '/dashboard/achievements', icon: Trophy, feature: 'gamification' },
      ]
    },
    {
      title: 'Hesap',
      items: [
        { label: 'Profilim', href: '/dashboard/profile', icon: UserCircle },
        { label: 'Bildirimler', href: '/dashboard/notifications', icon: Bell, feature: 'notificationsPage' },
      ]
    }
  ],

  manager: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Seans Başlat', href: '/dashboard/sessions/new', icon: Mic, feature: 'voice' },
        { label: 'Seanslarım', href: '/dashboard/sessions', icon: MessagesSquare },
        { label: 'Gelişimim', href: '/dashboard/progress', icon: BarChart3, feature: 'progressPage' },
        { label: 'Başarılarım', href: '/dashboard/achievements', icon: Trophy, feature: 'gamification' },
      ]
    },
    {
      title: 'Ekip Yönetimi',
      items: [
        { label: 'Kullanıcılar', href: '/tenant/users', icon: Users },
        { label: 'Ekibim', href: '/manager/team', icon: Users, feature: 'managerPages' },
        { label: 'Raporlar', href: '/reports', icon: BarChart3, feature: 'managerPages' },
      ]
    },
    {
      title: 'Hesap',
      items: [
        { label: 'Profilim', href: '/dashboard/profile', icon: UserCircle },
        { label: 'Bildirimler', href: '/dashboard/notifications', icon: Bell, feature: 'notificationsPage' },
      ]
    }
  ],

  hr_admin: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Raporlama',
      items: [
        { label: 'Kullanıcılar', href: '/tenant/users', icon: Users },
        { label: 'Şirket Raporları', href: '/manager/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Hesap',
      items: [
        { label: 'Profilim', href: '/dashboard/profile', icon: UserCircle },
        { label: 'Bildirimler', href: '/dashboard/notifications', icon: Bell },
      ]
    }
  ],

  hr_viewer: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Raporlama',
      items: [
        { label: 'Raporlar', href: '/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Hesap',
      items: [
        { label: 'Profilim', href: '/dashboard/profile', icon: UserCircle },
        { label: 'Bildirimler', href: '/dashboard/notifications', icon: Bell },
      ]
    }
  ],

  tenant_admin: [
    {
      items: [
        { label: 'Genel Bakış', href: '/tenant', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Yönetim',
      items: [
        { label: 'Kullanıcılar', href: '/tenant/users', icon: Users },
        { label: 'Personalar', href: '/tenant/personas', icon: UserCircle },
        { label: 'Senaryolar', href: '/tenant/scenarios', icon: BookOpen },
        { label: 'Gamification', href: '/tenant/gamification', icon: Trophy, feature: 'gamification' },
        { label: 'Raporlar', href: '/reports', icon: BarChart3 },
        { label: 'Kurum Profili', href: '/tenant/settings', icon: Settings },
      ]
    },
    {
      title: 'Hesap',
      items: [
        { label: 'Profilim', href: '/dashboard/profile', icon: UserCircle },
      ]
    }
  ],

  super_admin: [
    {
      items: [
        { label: 'Genel Bakış', href: '/admin', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Platform Yönetimi',
      items: [
        { label: 'Kurum Yönetimi', href: '/admin/tenants', icon: Building2 },
        { label: 'Prompt Yönetimi', href: '/admin/prompts', icon: FileText },
        { label: 'Rubric Yapılandırması', href: '/admin/rubrics', icon: Shield },
        { label: 'Geri Bildirimler', href: '/admin/feedback', icon: MessageSquare },
        { label: 'Raporlar', href: '/reports', icon: BarChart3 },
        { label: 'Sistem Durumu', href: '/admin/system', icon: Server },
      ]
    },
    {
      title: 'İçerik Yönetimi',
      items: [
        { label: 'Persona-Kurum Atama', href: '/admin/personas', icon: UserCircle },
        { label: 'Persona Yönetimi', href: '/tenant/personas', icon: UserCircle },
        { label: 'Senaryolar', href: '/tenant/scenarios', icon: BookOpen },
      ]
    }
  ]
}

export function getNavSections(role: UserRole, flags?: Partial<Record<FeatureKey, boolean>>): NavSection[] {
  const sections = NAV_CONFIG[role] ?? NAV_CONFIG.user
  if (!flags) return sections
  return sections.map(section => ({
    ...section,
    items: section.items.filter(item => !item.feature || flags[item.feature]),
  }))
}
