'use client'

import { useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 90_000 // 90 saniye

export function useHeartbeat(sessionId: string, enabled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = () => {
    if (document.hidden) return // Sayfa arka planda — atla
    fetch(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' }).catch(() => {
      // Heartbeat başarısız olsa bile seans devam eder — sessizce atla
    })
  }

  useEffect(() => {
    if (!enabled) return

    // Hemen bir tane gönder
    sendHeartbeat()
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
