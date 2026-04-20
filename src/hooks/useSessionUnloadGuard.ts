'use client'

import { useEffect } from 'react'

export function useSessionUnloadGuard(sessionId: string, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Beacon: tarayıcı sayfa kapanırken bunu teslim etmeyi garanti eder
      // Content-Type: text/plain olmalı (beacon kısıtı)
      navigator.sendBeacon(
        `/api/sessions/${sessionId}/drop`,
        JSON.stringify({ reason: 'page_unload' })
      )

      // Tarayıcı onay dialogu göster (modern tarayıcılarda çalışmayabilir)
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionId, isActive])
}
