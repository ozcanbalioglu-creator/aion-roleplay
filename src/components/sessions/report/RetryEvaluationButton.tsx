'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { retryEvaluationAction } from '@/lib/actions/session.actions'
import { toast } from '@/lib/toast'
import { RotateCcw } from 'lucide-react'

interface RetryEvaluationButtonProps {
  sessionId: string
}

export function RetryEvaluationButton({ sessionId }: RetryEvaluationButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleRetry = () => {
    startTransition(async () => {
      const result = await retryEvaluationAction(sessionId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Değerlendirme yeniden kuyruğa alındı. Birkaç dakika sonra sayfayı yenile.')
      }
    })
  }

  return (
    <Button
      onClick={handleRetry}
      disabled={isPending}
      className="rounded-full px-8 py-6 h-auto font-bold"
    >
      {isPending ? (
        <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin mr-2" />
      ) : (
        <RotateCcw className="h-4 w-4 mr-2" />
      )}
      Yeniden Dene
    </Button>
  )
}
