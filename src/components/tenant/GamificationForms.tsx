'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { Trophy, Target } from 'lucide-react'
import { toast } from 'sonner'
import { createTenantBadgeAction, createTenantChallengeAction } from '@/lib/actions/gamification.actions'

export function GamificationForms() {
  const [badgeCategory, setBadgeCategory] = useState('custom')
  const [badgeCriteria, setBadgeCriteria] = useState('session_count')
  const [challengeType, setChallengeType] = useState('complete_sessions')

  async function handleBadgeSubmit(formData: FormData) {
    const res = await createTenantBadgeAction(formData)
    if (res.success) {
      toast.success('Rozet başarıyla oluşturuldu')
      // formu temizle
      const form = document.getElementById('badge-form') as HTMLFormElement
      form?.reset()
    } else {
      toast.error(res.error || 'Bir hata oluştu')
    }
  }

  async function handleChallengeSubmit(formData: FormData) {
    const res = await createTenantChallengeAction(formData)
    if (res.success) {
      toast.success('Görev şablonu kaydedildi')
      const form = document.getElementById('challenge-form') as HTMLFormElement
      form?.reset()
    } else {
      toast.error(res.error || 'Bir hata oluştu')
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Rozet Oluşturma */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle>Yeni Şirket Rozeti</CardTitle>
          </div>
          <CardDescription>
            Kullanıcıların belirli kriterleri sağladığında kazanacağı kalıcı ödüller.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="badge-form" action={handleBadgeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge-name">Rozet Adı</Label>
              <Input id="badge-name" name="name" placeholder="Örn: Müşteri Dostu" required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="badge-desc">Açıklama</Label>
              <Textarea id="badge-desc" name="description" placeholder="Nasıl kazanılır?" required className="resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge-category">Kategori</Label>
                <input type="hidden" name="category" value={badgeCategory} />
                <Select onValueChange={setBadgeCategory} defaultValue={badgeCategory}>
                  <SelectTrigger id="badge-category">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milestone">Kilometre Taşı</SelectItem>
                    <SelectItem value="score">Skor Bazlı</SelectItem>
                    <SelectItem value="streak">Seri Bazlı</SelectItem>
                    <SelectItem value="custom">Özel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-xp">XP Ödülü</Label>
                <Input id="badge-xp" name="xpReward" type="number" defaultValue="100" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge-criteria">Kriter Tipi</Label>
                <input type="hidden" name="criteriaType" value={badgeCriteria} />
                <Select onValueChange={setBadgeCriteria} defaultValue={badgeCriteria}>
                  <SelectTrigger id="badge-criteria">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="session_count">Seans Sayısı</SelectItem>
                    <SelectItem value="min_score">Minimum Skor</SelectItem>
                    <SelectItem value="streak">Aktif Gün Serisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-value">Hedef Değer</Label>
                <Input id="badge-value" name="criteriaValue" type="number" defaultValue="5" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge-icon">İkon (Emoji)</Label>
              <Input id="badge-icon" name="icon" defaultValue="🏅" className="w-20 text-xl" maxLength={4} />
            </div>

            <div className="pt-4">
              <SubmitButton className="w-full">Rozet Oluştur</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Görev Oluşturma */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Yeni Haftalık Görev</CardTitle>
          </div>
          <CardDescription>
            Her Pazartesi kullanıcıların görev havuzuna eklenecek hedefler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="challenge-form" action={handleChallengeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ch-title">Görev Başlığı</Label>
              <Input id="ch-title" name="title" placeholder="Örn: Haftalık Maraton" required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ch-desc">Görev Amacı</Label>
              <Textarea id="ch-desc" name="description" placeholder="Kullanıcı ne yapmalı?" required className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ch-type">Görev Tipi</Label>
              <input type="hidden" name="challengeType" value={challengeType} />
              <Select onValueChange={setChallengeType} defaultValue={challengeType}>
                <SelectTrigger id="ch-type">
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete_sessions">Seans Tamamlama</SelectItem>
                  <SelectItem value="achieve_score">Skor Hedefi</SelectItem>
                  <SelectItem value="try_persona">Yeni Persona Deneme</SelectItem>
                  <SelectItem value="streak_maintain">Seri Koruma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ch-target">Hedef Sayı / Puan</Label>
                <Input id="ch-target" name="targetValue" type="number" step="0.1" defaultValue="3" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-xp">Ödül (XP)</Label>
                <Input id="ch-xp" name="xpReward" type="number" defaultValue="150" required />
              </div>
            </div>

            <div className="pt-10">
              <SubmitButton className="w-full bg-primary hover:bg-primary/90 text-white font-bold">Görev Şablonunu Kaydet</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
