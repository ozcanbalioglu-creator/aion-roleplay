'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Trophy, Target, Zap, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  toggleBadgeStatusAction,
  deleteBadgeAction,
  toggleChallengeStatusAction,
  deleteChallengeAction,
} from '@/lib/actions/gamification.actions'

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  complete_sessions: 'Seans Tamamlama',
  achieve_score: 'Skor Hedefi',
  try_persona: 'Yeni Persona Deneme',
  streak_maintain: 'Seri Koruma',
}

const CATEGORY_LABELS: Record<string, string> = {
  milestone: 'Kilometre Taşı',
  score: 'Skor Bazlı',
  streak: 'Seri Bazlı',
  level: 'Seviye',
  custom: 'Özel',
}

interface BadgeItem {
  id: string
  name: string
  description: string
  category: string
  xp_reward: number
  icon?: string | null
  is_active: boolean
  created_at: string
}

interface ChallengeItem {
  id: string
  name: string
  title?: string | null
  description: string
  challenge_type: string
  target_value: number
  xp_reward: number
  is_active: boolean
  created_at: string
}

interface GamificationListsProps {
  badges: BadgeItem[]
  challenges: ChallengeItem[]
}

export function GamificationLists({ badges, challenges }: GamificationListsProps) {
  const [localBadges, setLocalBadges] = useState<BadgeItem[]>(badges)
  const [localChallenges, setLocalChallenges] = useState<ChallengeItem[]>(challenges)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'badge' | 'challenge'; name: string } | null>(null)

  async function handleToggleBadge(badge: BadgeItem) {
    setPendingId(badge.id)
    const res = await toggleBadgeStatusAction(badge.id, badge.is_active)
    setPendingId(null)
    if (!res.success) {
      toast.error(res.error ?? 'Hata')
    } else {
      const newStatus = res.newStatus ?? !badge.is_active
      setLocalBadges((prev) =>
        prev.map((b) => (b.id === badge.id ? { ...b, is_active: newStatus } : b))
      )
      toast.success(newStatus ? 'Rozet aktifleştirildi.' : 'Rozet pasifleştirildi.')
    }
  }

  async function handleToggleChallenge(ch: ChallengeItem) {
    setPendingId(ch.id)
    const res = await toggleChallengeStatusAction(ch.id, ch.is_active)
    setPendingId(null)
    if (!res.success) {
      toast.error(res.error ?? 'Hata')
    } else {
      const newStatus = res.newStatus ?? !ch.is_active
      setLocalChallenges((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, is_active: newStatus } : c))
      )
      toast.success(newStatus ? 'Görev aktifleştirildi.' : 'Görev pasifleştirildi.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setPendingId(deleteTarget.id)
    const res = deleteTarget.type === 'badge'
      ? await deleteBadgeAction(deleteTarget.id)
      : await deleteChallengeAction(deleteTarget.id)
    setPendingId(null)
    setDeleteTarget(null)

    if (!res.success) {
      if (res.error === 'has_awards') {
        toast.error('Bu rozet kullanıcılara verilmiş. Önce pasif duruma getirin.')
      } else {
        toast.error(res.error ?? 'Hata')
      }
      return
    }

    if (deleteTarget.type === 'badge') {
      setLocalBadges((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    } else {
      setLocalChallenges((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    }
    toast.success(`${deleteTarget.type === 'badge' ? 'Rozet' : 'Görev'} silindi.`)
  }

  if (localBadges.length === 0 && localChallenges.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Rozetler */}
        {localBadges.length > 0 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">Mevcut Rozetler ({localBadges.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {localBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/20 p-3"
                >
                  <span className="text-xl shrink-0 mt-0.5">{badge.icon ?? '🏅'}</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{badge.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">{badge.xp_reward} XP</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {CATEGORY_LABELS[badge.category] ?? badge.category}
                        </Badge>
                        {badge.is_active
                          ? <span className="text-[10px] text-emerald-600 font-medium">Aktif</span>
                          : <span className="text-[10px] text-muted-foreground">Pasif</span>
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          disabled={pendingId === badge.id}
                          onClick={() => handleToggleBadge(badge)}
                        >
                          {badge.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={pendingId === badge.id}
                          onClick={() => setDeleteTarget({ id: badge.id, type: 'badge', name: badge.name })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Görevler */}
        {localChallenges.length > 0 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Mevcut Görevler ({localChallenges.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {localChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/20 p-3"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {challenge.title ?? challenge.name}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">{challenge.xp_reward} XP</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{challenge.description}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {CHALLENGE_TYPE_LABELS[challenge.challenge_type] ?? challenge.challenge_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Hedef: {challenge.target_value}
                        </span>
                        {challenge.is_active
                          ? <span className="text-[10px] text-emerald-600 font-medium">Aktif</span>
                          : <span className="text-[10px] text-muted-foreground">Pasif</span>
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          disabled={pendingId === challenge.id}
                          onClick={() => handleToggleChallenge(challenge)}
                        >
                          {challenge.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={pendingId === challenge.id}
                          onClick={() => setDeleteTarget({ id: challenge.id, type: 'challenge', name: challenge.title ?? challenge.name })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`${deleteTarget?.type === 'badge' ? 'Rozeti' : 'Görevi'} Sil`}
        description={`"${deleteTarget?.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
