'use client'

import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { IdleTimeoutDialog } from './IdleTimeoutDialog'

export function IdleTimeoutGuard() {
  const { showWarning, secondsLeft, resetTimer } = useIdleTimeout()

  if (!showWarning) return null

  return <IdleTimeoutDialog secondsLeft={secondsLeft} onContinue={resetTimer} />
}
