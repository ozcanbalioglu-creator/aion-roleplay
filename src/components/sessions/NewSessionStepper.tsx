import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { number: 1, label: 'Persona Seç' },
  { number: 2, label: 'Senaryo & Başlat' },
]

export function NewSessionStepper({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <nav aria-label="Seans kurulum adımları">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep
          const isCurrent  = step.number === currentStep
          const isLast     = index === STEPS.length - 1

          return (
            <li key={step.number} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent  && 'bg-primary/15 text-primary ring-2 ring-primary ring-offset-1',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <CheckIcon className="h-3.5 w-3.5" /> : step.number}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent   && 'text-primary',
                    isCompleted && 'text-primary/70',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'mx-3 h-px flex-1 transition-colors',
                    isCompleted ? 'bg-primary/40' : 'bg-border'
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
