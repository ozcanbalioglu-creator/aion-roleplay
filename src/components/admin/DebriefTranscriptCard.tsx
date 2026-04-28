'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronUp, MessageSquare, PlusCircle, CheckCircle2, XCircle } from 'lucide-react'
import { addPersonaFeedbackAction } from '@/lib/actions/feedback.actions'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface Message {
  role: string
  content: string
  phase: string
}

interface FeedbackNote {
  id: string
  feedback_text: string
  status: string
}

interface SessionInfo {
  id: string
  status: string
  createdAt: string
  personaName: string
  scenarioTitle: string
  personaId: string
  scenarioId: string
}

interface DebriefTranscriptCardProps {
  session: SessionInfo
  messages: Message[]
  feedbacks: FeedbackNote[]
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function DebriefTranscriptCard({
  session,
  messages,
  feedbacks: initialFeedbacks,
}: DebriefTranscriptCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isPending, startTransition] = useTransition()

  const isCompleted = session.status === 'debrief_completed'

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await addPersonaFeedbackAction({
        personaId: session.personaId,
        scenarioId: session.scenarioId,
        sessionId: session.id,
        feedbackText,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Öneri kaydedildi')
      setFeedbackText('')
      setDialogOpen(false)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{session.personaName}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-sm text-muted-foreground truncate max-w-xs">
                {session.scenarioTitle}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span>{formatDate(session.createdAt)}</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  isCompleted ? 'text-green-500 border-green-500/30' : 'text-amber-500 border-amber-500/30'
                )}
              >
                {isCompleted ? 'Tamamlandı' : 'Devam Ediyor'}
              </Badge>
              {initialFeedbacks.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {initialFeedbacks.length} not
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 text-xs h-7"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Öneri Ekle
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="gap-1 text-xs text-muted-foreground h-7"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {messages.length} mesaj
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t border-border">
          <div className="pt-4 space-y-2">
            {messages.length > 0 ? (
              <div className="rounded-lg bg-muted/30 p-3 max-h-80 overflow-y-auto space-y-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'text-xs px-3 py-2 rounded-lg',
                      msg.role === 'user'
                        ? 'ml-auto bg-primary/10 text-right max-w-[80%]'
                        : 'mr-auto bg-card border border-border max-w-[80%]'
                    )}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                      {msg.role === 'user' ? 'Kullanıcı' : 'Debrief Koçu'}
                    </p>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">Debrief mesajı henüz yok.</p>
            )}
          </div>

          {initialFeedbacks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Mevcut Notlar
              </p>
              {initialFeedbacks.map((f) => (
                <div
                  key={f.id}
                  className="rounded-md border border-border bg-card p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    {f.status === 'applied' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : f.status === 'dismissed' ? (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-muted-foreground capitalize">{f.status}</span>
                  </div>
                  <p className="text-foreground/80 leading-relaxed">{f.feedback_text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Persona Prompt Önerisi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{session.personaName}</span>
              {' · '}
              {session.scenarioTitle}
            </p>
            <Textarea
              placeholder="Bu debrief konuşmasında fark ettiğiniz persona/senaryo prompt iyileştirme fikirlerini yazın..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || feedbackText.length < 10}
            >
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
