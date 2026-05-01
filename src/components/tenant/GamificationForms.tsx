'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { Trophy, Target, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createTenantBadgeAction, createTenantChallengeAction } from '@/lib/actions/gamification.actions'
import { cn } from '@/lib/utils'

const BADGE_ICON_OPTIONS = [
  // Rozetler
  { icon: '🥉', label: 'Bronz Rozet',  group: 'Rozetler' },
  { icon: '🥈', label: 'Gümüş Rozet', group: 'Rozetler' },
  { icon: '🥇', label: 'Altın Rozet',  group: 'Rozetler' },
  { icon: '💠', label: 'Platin Rozet', group: 'Rozetler' },
  { icon: '💎', label: 'Elmas Rozet',  group: 'Rozetler' },
  // Kupalar
  { icon: '🎖️', label: 'Gümüş Kupa',  group: 'Kupalar' },
  { icon: '🏆', label: 'Altın Kupa',   group: 'Kupalar' },
  // Diğer
  { icon: '⭐',  label: 'Yıldız',      group: 'Diğer' },
  { icon: '🌟',  label: 'Parlayan Yıldız', group: 'Diğer' },
  { icon: '🔥',  label: 'Ateş',        group: 'Diğer' },
  { icon: '⚡',  label: 'Şimşek',      group: 'Diğer' },
  { icon: '💪',  label: 'Güç',         group: 'Diğer' },
  { icon: '🧠',  label: 'Zeka',        group: 'Diğer' },
  { icon: '💡',  label: 'Fikir',       group: 'Diğer' },
  { icon: '🎯',  label: 'Hedef',       group: 'Diğer' },
  { icon: '🎓',  label: 'Gelişim',     group: 'Diğer' },
  { icon: '👑',  label: 'Liderlik',    group: 'Diğer' },
  { icon: '🚀',  label: 'Büyüme',      group: 'Diğer' },
  { icon: '🌈',  label: 'Çeşitlilik',  group: 'Diğer' },
  { icon: '🤝',  label: 'İşbirliği',   group: 'Diğer' },
]

const ICON_GROUPS = ['Rozetler', 'Kupalar', 'Diğer'] as const

const CHALLENGE_TYPE_META: Record<string, {
  targetLabel: string
  targetPlaceholder: string
  targetHint: string
  targetStep: string
  targetDefault: string
}> = {
  complete_sessions: {
    targetLabel: 'Kaç Seans?',
    targetPlaceholder: 'Örn: 3',
    targetHint: 'Kullanıcı bu dönem içinde kaç seans tamamlamalı? (Tam sayı girin)',
    targetStep: '1',
    targetDefault: '3',
  },
  achieve_score: {
    targetLabel: 'Minimum Puan (1–5)',
    targetPlaceholder: 'Örn: 3.5',
    targetHint: 'Kullanıcı tek bir seansda bu puanı veya üzerini almalı. (Ondalıklı girilebilir)',
    targetStep: '0.1',
    targetDefault: '3.5',
  },
  try_persona: {
    targetLabel: 'Kaç Farklı Persona?',
    targetPlaceholder: 'Örn: 1',
    targetHint: 'Kullanıcı daha önce hiç denemediği kaç farklı persona ile seans yapmalı?',
    targetStep: '1',
    targetDefault: '1',
  },
  try_scenario: {
    targetLabel: 'Kaç Farklı Senaryo?',
    targetPlaceholder: 'Örn: 1',
    targetHint: 'Kullanıcı daha önce hiç denemediği kaç farklı senaryo ile seans yapmalı?',
    targetStep: '1',
    targetDefault: '1',
  },
  streak_maintain: {
    targetLabel: 'Ardışık Gün Sayısı',
    targetPlaceholder: 'Örn: 5',
    targetHint: 'Kullanıcı kaç gün üst üste en az 1 seans tamamlamalı?',
    targetStep: '1',
    targetDefault: '5',
  },
}

function nameToCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50)
}

export function GamificationForms() {
  const router = useRouter()
  const [badgeCategory, setBadgeCategory] = useState('custom')
  const [badgeCriteria, setBadgeCriteria] = useState('session_count')
  const [challengeType, setChallengeType] = useState('complete_sessions')
  const [challengePeriod, setChallengePeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [badgeCode, setBadgeCode] = useState('')
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState('🥉')
  const [iconDropdownOpen, setIconDropdownOpen] = useState(false)

  function handleBadgeNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!codeManuallyEdited) {
      setBadgeCode(nameToCode(e.target.value))
    }
  }

  function handleBadgeCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCodeManuallyEdited(true)
    setBadgeCode(e.target.value)
  }

  async function handleBadgeSubmit(formData: FormData) {
    formData.set('icon', selectedIcon)
    const res = await createTenantBadgeAction(formData)
    if (res.success) {
      toast.success('Rozet başarıyla oluşturuldu')
      const form = document.getElementById('badge-form') as HTMLFormElement
      form?.reset()
      setBadgeCode('')
      setCodeManuallyEdited(false)
      setSelectedIcon('🥉')
      router.refresh()
    } else {
      toast.error(res.error || 'Bir hata oluştu')
    }
  }

  async function handleChallengeSubmit(formData: FormData) {
    formData.set('period', challengePeriod)
    const res = await createTenantChallengeAction(formData)
    if (res.success) {
      toast.success('Görev şablonu kaydedildi')
      const form = document.getElementById('challenge-form') as HTMLFormElement
      form?.reset()
      setChallengePeriod('weekly')
      router.refresh()
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
            Kullanıcıların kriterleri sağladığında kalıcı olarak kazandığı ödüller. Rozetlerin süresi dolmaz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="badge-form" action={handleBadgeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge-name">Rozet Adı</Label>
              <Input
                id="badge-name"
                name="name"
                placeholder="Örn: Müşteri Dostu"
                required
                onChange={handleBadgeNameChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge-code">Rozet Kodu</Label>
              <Input
                id="badge-code"
                name="code"
                placeholder="Örn: ilk-seans-rozeti"
                value={badgeCode}
                onChange={handleBadgeCodeChange}
                pattern="[a-z0-9-]+"
                title="Sadece küçük harf, rakam ve tire"
              />
              <p className="text-[11px] text-muted-foreground">
                Boş bırakırsanız isimden otomatik oluşturulur.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge-desc">Açıklama</Label>
              <Textarea id="badge-desc" name="description" placeholder="Nasıl kazanılır?" required className="resize-none" />
            </div>

            {/* İkon Seçimi */}
            <div className="space-y-2">
              <Label>Rozet İkonu</Label>
              <input type="hidden" name="icon" value={selectedIcon} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIconDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 w-full h-10 px-3 rounded-md border border-border/40 bg-background text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xl leading-none">{selectedIcon}</span>
                  <span className="flex-1 text-left text-muted-foreground">
                    {BADGE_ICON_OPTIONS.find(o => o.icon === selectedIcon)?.label ?? 'İkon seçin'}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', iconDropdownOpen && 'rotate-180')} />
                </button>

                {iconDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-background border border-border/40 rounded-lg shadow-lg overflow-hidden">
                    {ICON_GROUPS.map(group => {
                      const items = BADGE_ICON_OPTIONS.filter(o => o.group === group)
                      return (
                        <div key={group}>
                          <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/30">
                            {group}
                          </p>
                          {items.map(option => (
                            <button
                              key={option.icon}
                              type="button"
                              onClick={() => { setSelectedIcon(option.icon); setIconDropdownOpen(false) }}
                              className={cn(
                                'flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-muted/40 transition-colors',
                                selectedIcon === option.icon && 'bg-primary/10 text-primary'
                              )}
                            >
                              <span className="text-xl w-7 text-center leading-none">{option.icon}</span>
                              <span className="flex-1 text-left">{option.label}</span>
                              {selectedIcon === option.icon && <Check className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
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
                <Label htmlFor="badge-xp">DP Ödülü</Label>
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
                    <SelectItem value="session_count">Toplam Seans Sayısı</SelectItem>
                    <SelectItem value="min_score">Minimum Skor (tek seansta)</SelectItem>
                    <SelectItem value="persona_difficulty_min">Zorluklu Persona Seansı (zorluk ≥ N)</SelectItem>
                    <SelectItem value="scenario_difficulty_min">Zorlu Senaryo Seansı (zorluk ≥ N)</SelectItem>
                    <SelectItem value="level">Seviye Erişimi</SelectItem>
                    <SelectItem value="xp">Toplam DP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-value">Hedef Değer</Label>
                <Input id="badge-value" name="criteriaValue" type="number" defaultValue="5" required />
              </div>
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
            <CardTitle>Yeni Görev Şablonu</CardTitle>
          </div>
          <CardDescription>
            Kullanıcılara periyodik olarak atanacak hedefler. Süre dolmadan tamamlanmazsa bildirim gönderilir.
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

            {/* Dönem Seçimi */}
            <div className="space-y-2">
              <Label>Görev Dönemi</Label>
              <input type="hidden" name="period" value={challengePeriod} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChallengePeriod('weekly')}
                  className={cn(
                    'h-16 rounded-xl border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1',
                    challengePeriod === 'weekly'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="text-xl">📅</span>
                  <span>Haftalık</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChallengePeriod('monthly')}
                  className={cn(
                    'h-16 rounded-xl border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1',
                    challengePeriod === 'monthly'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="text-xl">🗓️</span>
                  <span>Aylık</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {challengePeriod === 'weekly'
                  ? 'Her Pazartesi atanır, Pazar gece yarısı sona erer. 2 gün kala hatırlatma gönderilir.'
                  : 'Her ayın 1\'inde atanır, ayın son günü sona erer. 5 gün kala hatırlatma gönderilir.'}
              </p>
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
                  <SelectItem value="try_scenario">Yeni Senaryo Deneme</SelectItem>
                  <SelectItem value="streak_maintain">Seri Koruma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const meta = CHALLENGE_TYPE_META[challengeType] ?? CHALLENGE_TYPE_META.complete_sessions
              return (
                <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
                  <Label htmlFor="ch-target">{meta.targetLabel}</Label>
                  <Input
                    id="ch-target"
                    name="targetValue"
                    type="number"
                    step={meta.targetStep}
                    defaultValue={meta.targetDefault}
                    placeholder={meta.targetPlaceholder}
                    required
                    key={challengeType}
                  />
                  <p className="text-[11px] text-muted-foreground">{meta.targetHint}</p>
                </div>
              )
            })()}

            <div className="space-y-2">
              <Label htmlFor="ch-xp">Ödül (DP)</Label>
              <Input id="ch-xp" name="xpReward" type="number" defaultValue="150" required />
            </div>

            <div className="pt-6">
              <SubmitButton className="w-full bg-primary hover:bg-primary/90 text-white font-bold">Görev Şablonunu Kaydet</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
