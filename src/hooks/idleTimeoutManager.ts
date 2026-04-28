export const IDLE_MS = 30 * 60 * 1000
export const WARN_MS = 5 * 60 * 1000
export const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

interface IdleTimeoutCallbacks {
  onWarning: () => void
  onTick: (secondsLeft: number) => void
  onExpire: () => void
}

export class IdleTimeoutManager {
  private readonly callbacks: IdleTimeoutCallbacks
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private warnInterval: ReturnType<typeof setInterval> | undefined
  private channel: BroadcastChannel | undefined
  private secondsLeft: number = WARN_MS / 1000
  private readonly handleActivity: () => void

  constructor(callbacks: IdleTimeoutCallbacks) {
    this.callbacks = callbacks
    this.handleActivity = () => this.reset()
  }

  start(): void {
    this.channel = new BroadcastChannel('aion_idle_sync')
    this.channel.onmessage = (e) => {
      if (e.data?.type === 'activity') this.scheduleIdleTimer()
    }
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, this.handleActivity, { passive: true } as AddEventListenerOptions)
    )
    this.scheduleIdleTimer()
  }

  reset(): void {
    this.channel?.postMessage({ type: 'activity', timestamp: Date.now() })
    this.scheduleIdleTimer()
  }

  destroy(): void {
    clearTimeout(this.idleTimer)
    clearInterval(this.warnInterval)
    ACTIVITY_EVENTS.forEach(ev =>
      window.removeEventListener(ev, this.handleActivity)
    )
    this.channel?.close()
  }

  private scheduleIdleTimer(): void {
    clearTimeout(this.idleTimer)
    clearInterval(this.warnInterval)
    this.idleTimer = setTimeout(() => this.beginWarningCountdown(), IDLE_MS)
  }

  private beginWarningCountdown(): void {
    this.secondsLeft = WARN_MS / 1000
    this.callbacks.onWarning()
    this.warnInterval = setInterval(() => {
      this.secondsLeft -= 1
      if (this.secondsLeft <= 0) {
        clearInterval(this.warnInterval)
        this.callbacks.onExpire()
      } else {
        this.callbacks.onTick(this.secondsLeft)
      }
    }, 1000)
  }
}
