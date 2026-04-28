'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AlertTriangle, UserX, Shield, Clock } from 'lucide-react'

const ABANDON_REASONS = [
  {
    value: 'technical_issue',
    label: 'Teknik sorun yaşadım',
    description: 'Ses, mikrofon veya bağlantı problemi nedeniyle devam edemedim.',
    icon: AlertTriangle,
    color: 'text-destructive',
  },
  {
    value: 'persona_wrong_fit',
    label: 'Persona/karakter beklediğim gibi değildi',
    description: 'Bu karakter benim çalışmak istediğim profille örtüşmüyor.',
    icon: UserX,
    color: 'text-amber-500',
  },
  {
    value: 'scenario_too_hard',
    label: 'Senaryo çok zordu, şu an hazır değilim',
    description: 'Bu senaryoya daha iyi hazırlandıktan sonra dönmek istiyorum.',
    icon: Shield,
    color: 'text-sky-500',
  },
  {
    value: 'user_interrupted',
    label: 'Şu an devam edemiyorum',
    description: 'Dışarıdan gelen bir kesintiden dolayı seansı bırakmam gerekiyor.',
    icon: Clock,
    color: 'text-muted-foreground',
  },
] as const

export type CancelReason = (typeof ABANDON_REASONS)[number]['value']

interface CancelSessionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: CancelReason) => Promise<void>
  isLoading?: boolean
}

export function CancelSessionModal({
  open,
  onClose,
  onConfirm,
  isLoading,
}: CancelSessionModalProps) {
  const [selected, setSelected] = useState<CancelReason>('technical_issue')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Seansı Yarıda Kes</DialogTitle>
          <DialogDescription>
            Bu seans tamamlanmış sayılmaz ve değerlendirme raporu oluşturulmaz.
            Neden yarıda bıraktığını belirtir misin?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as CancelReason)}
          className="space-y-3 mt-4"
        >
          {ABANDON_REASONS.map((reason) => {
            const Icon = reason.icon
            const isSelected = selected === reason.value

            return (
              <div key={reason.value}>
                <RadioGroupItem
                  value={reason.value}
                  id={reason.value}
                  className="sr-only"
                />
                <Label
                  htmlFor={reason.value}
                  className={cn(
                    'flex items-start gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border/50 hover:border-border hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'mt-1 p-2 rounded-lg bg-surface-container-low border border-border/50',
                      reason.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {reason.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {reason.description}
                    </p>
                  </div>
                </Label>
              </div>
            )
          })}
        </RadioGroup>

        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 order-2 sm:order-1"
          >
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(selected)}
            disabled={isLoading}
            className="flex-1 order-1 sm:order-2 font-bold"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin mr-2" />
            ) : null}
            Seansı Yarıda Kes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
