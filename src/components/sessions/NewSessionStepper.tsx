import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { number: 1, label: 'Persona Seç' },
  { number: 2, label: 'Senaryo Seç' },
  { number: 3, label: 'Başlat' },
]

export function NewSessionStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Seans kurulum adımları">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep
          const isCurrent = step.number === currentStep
          const isLast = index === STEPS.length - 1

          return (
            <li key={step.number} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && 'border-2 border-primary bg-background text-primary',
                    !isCompleted && !isCurrent && 'border-2 border-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <CheckIcon className="h-4 w-4" /> : step.number}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent && 'text-primary',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={cn('mx-4 h-px flex-1', isCompleted ? 'bg-primary' : 'bg-muted')} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
