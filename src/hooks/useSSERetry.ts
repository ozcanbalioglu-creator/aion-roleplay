'use client'

import { useRef, useCallback } from 'react'

interface SSERetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  onRetry?: (attempt: number) => void
  onFailed?: () => void
}

export function useSSERetry(options: SSERetryOptions = {}) {
  const { maxRetries = 3, baseDelayMs = 2000, onRetry, onFailed } = options
  const attemptsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRetry = useCallback(
    (retryFn: () => void) => {
      if (attemptsRef.current >= maxRetries) {
        onFailed?.()
        return
      }

      const delay = baseDelayMs * Math.pow(2, attemptsRef.current) // 2s, 4s, 8s
      attemptsRef.current += 1
      onRetry?.(attemptsRef.current)

      timerRef.current = setTimeout(retryFn, delay)
    },
    [maxRetries, baseDelayMs, onRetry, onFailed]
  )

  const resetRetries = useCallback(() => {
    attemptsRef.current = 0
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const cancelRetry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { scheduleRetry, resetRetries, cancelRetry, attempts: attemptsRef }
}
