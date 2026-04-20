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
import { CheckCircle2, Clock, Ban, AlertTriangle, HelpCircle } from 'lucide-react'

const CANCEL_REASONS = [
  { 
    value: 'completed_naturally', 
    label: 'Seansı başarıyla tamamladım', 
    description: 'Konuşmayı doğal akışında bitirdim.',
    icon: CheckCircle2,
    color: 'text-green-500'
  },
  { 
    value: 'time_constraint', 
    label: 'Zamanım doldu / Şu an devam edemiyorum', 
    description: 'Kesintiye uğradı, ancak sonradan rapora bakmak istiyorum.',
    icon: Clock,
    color: 'text-blue-500'
  },
  { 
    value: 'wrong_scenario', 
    label: 'Yanlış bir senaryo seçmişim', 
    description: 'Başka bir senaryoyla yeni bir seans başlatacağım.',
    icon: Ban,
    color: 'text-amber-500'
  },
  { 
    value: 'technical_issue', 
    label: 'Teknik sorun / Ses problemi yaşıyorum', 
    description: 'Sistemle ilgili bir aksaklık nedeniyle bitiriyorum.',
    icon: AlertTriangle,
    color: 'text-destructive'
  },
  { 
    value: 'other', 
    label: 'Diğer / Deneme amaçlı açmıştım', 
    description: '',
    icon: HelpCircle,
    color: 'text-muted-foreground'
  },
] as const

export type CancelReason = (typeof CANCEL_REASONS)[number]['value']

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
  const [selected, setSelected] = useState<CancelReason>('completed_naturally')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Seansı Bitir</DialogTitle>
          <DialogDescription>
            Seansı sonlandırmadan önce lütfen bitirme nedeninizi belirtin.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as CancelReason)}
          className="space-y-3 mt-4"
        >
          {CANCEL_REASONS.map((reason) => {
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
                    "flex items-start gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer",
                    isSelected 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border/50 hover:border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn("mt-1 p-2 rounded-lg bg-surface-container-low border border-border/50", reason.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                      {reason.label}
                    </p>
                    {reason.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {reason.description}
                      </p>
                    )}
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
            onClick={() => onConfirm(selected)}
            disabled={isLoading}
            className="flex-1 order-1 sm:order-2 font-bold shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
            ) : null}
            Onayla ve Bitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
