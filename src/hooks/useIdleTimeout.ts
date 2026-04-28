'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOutAction } from '@/modules/auth/actions'
import { IdleTimeoutManager, WARN_MS } from './idleTimeoutManager'

export function useIdleTimeout() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARN_MS / 1000)
  const managerRef = useRef<IdleTimeoutManager | undefined>(undefined)

  const resetTimer = useCallback(() => {
    setShowWarning(false)
    setSecondsLeft(WARN_MS / 1000)
    managerRef.current?.reset()
  }, [])

  useEffect(() => {
    const manager = new IdleTimeoutManager({
      onWarning: () => {
        setShowWarning(true)
        setSecondsLeft(WARN_MS / 1000)
      },
      onTick: (s) => setSecondsLeft(s),
      onExpire: () => {
        signOutAction().then(() => router.push('/login?reason=idle'))
      },
    })
    managerRef.current = manager
    manager.start()
    return () => manager.destroy()
  }, [router])

  return { showWarning, secondsLeft, resetTimer }
}
