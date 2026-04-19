import type { UserRole } from '@/types'
import {
  LayoutDashboard,
  MessagesSquare,
  BarChart3,
  Users,
  UserCircle,
  Settings,
  Shield,
  BookOpen,
  Mic,
  Trophy,
  Bell,
  Building2,
  FileText,
  Wrench,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string          // "Yeni", "Beta" gibi
  children?: NavItem[]    // alt menü (kullanılmayabilir V1'de)
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
        { label: 'Seans Başlat', href: '/dashboard/sessions/new', icon: Mic },
        { label: 'Seanslarım', href: '/dashboard/sessions', icon: MessagesSquare },
        { label: 'Gelişimim', href: '/dashboard/progress', icon: BarChart3 },
        { label: 'Başarılarım', href: '/dashboard/achievements', icon: Trophy },
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

  manager: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Seans Başlat', href: '/dashboard/sessions/new', icon: Mic },
        { label: 'Seanslarım', href: '/dashboard/sessions', icon: MessagesSquare },
        { label: 'Gelişimim', href: '/dashboard/progress', icon: BarChart3 },
      ]
    },
    {
      title: 'Ekip Yönetimi',
      items: [
        { label: 'Ekibim', href: '/manager/team', icon: Users },
        { label: 'Ekip Raporları', href: '/manager/reports', icon: FileText },
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

  hr_admin: [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Raporlama',
      items: [
        { label: 'Şirket Raporları', href: '/manager/reports', icon: BarChart3 },
        { label: 'Kullanıcılar', href: '/admin/users', icon: Users },
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
        { label: 'Tenant Yönetimi', href: '/admin/tenants', icon: Building2 },
        { label: 'Prompt Yönetimi', href: '/admin/prompts', icon: FileText },
        { label: 'Rubric Yapılandırması', href: '/admin/rubrics', icon: Shield },
      ]
    }
  ]
}

export function getNavSections(role: UserRole): NavSection[] {
  return NAV_CONFIG[role] ?? NAV_CONFIG.user
}
