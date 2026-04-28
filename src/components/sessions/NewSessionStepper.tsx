import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { number: 1, label: 'Persona Seç' },
  { number: 2, label: 'Senaryo Seç' },
  { number: 3, label: 'Seansı Başlat' },
] as const

/**
 * Sub-header içinde dark frosted zemin üstünde okunaklı stepper.
 * 3 adım yan yana, ince connector çubuklarıyla — birbirinden uzak değiller, sağda yer kalıyor.
 * Renkler: white/opacity tabanlı (theme tokens dark bg'de yetersiz kalıyordu).
 */
export function NewSessionStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Seans kurulum adımları">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep
          const isCurrent  = step.number === currentStep
          const isLast     = index === STEPS.length - 1

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors flex-shrink-0',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent  && 'bg-primary/25 text-white ring-2 ring-primary/70 ring-offset-2 ring-offset-[#0f0e22]',
                    !isCompleted && !isCurrent && 'bg-white/10 text-white/50',
                  )}
                >
                  {isCompleted ? <CheckIcon className="h-3.5 w-3.5" /> : step.number}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium whitespace-nowrap',
                    isCurrent   && 'text-white',
                    isCompleted && 'text-white/70',
                    !isCurrent && !isCompleted && 'text-white/45',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'mx-3 h-px w-8 transition-colors',
                    isCompleted ? 'bg-primary/50' : 'bg-white/15'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
