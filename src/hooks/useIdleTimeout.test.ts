import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdleTimeoutManager, IDLE_MS, WARN_MS, ACTIVITY_EVENTS } from './idleTimeoutManager'

const broadcastPostMessage = vi.fn()
const broadcastClose = vi.fn()
let capturedOnMessage: ((e: { data: unknown }) => void) | null = null

class MockBroadcastChannel {
  onmessage: ((e: { data: unknown }) => void) | null = null
  postMessage = broadcastPostMessage
  close = broadcastClose
  constructor() {
    capturedOnMessage = null
    Object.defineProperty(this, 'onmessage', {
      get: () => capturedOnMessage,
      set: (fn) => { capturedOnMessage = fn },
    })
  }
}

const registeredListeners: Record<string, Set<() => void>> = {}

function fakeAddEventListener(type: string, fn: () => void) {
  if (!registeredListeners[type]) registeredListeners[type] = new Set()
  registeredListeners[type].add(fn)
}
function fakeRemoveEventListener(type: string, fn: () => void) {
  registeredListeners[type]?.delete(fn)
}

function simulateWindowEvent(type: string) {
  registeredListeners[type]?.forEach(fn => fn())
}

beforeEach(() => {
  vi.useFakeTimers()
  broadcastPostMessage.mockClear()
  broadcastClose.mockClear()
  Object.keys(registeredListeners).forEach(k => delete registeredListeners[k])
  capturedOnMessage = null
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
  vi.stubGlobal('window', {
    addEventListener: fakeAddEventListener,
    removeEventListener: fakeRemoveEventListener,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('IdleTimeoutManager', () => {
  it('exports correct timeout constants', () => {
    expect(IDLE_MS).toBe(30 * 60 * 1000)
    expect(WARN_MS).toBe(5 * 60 * 1000)
  })

  it('exports the 5 expected activity events', () => {
    expect(ACTIVITY_EVENTS).toEqual(['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'])
  })

  it('calls onWarning after IDLE_MS and initializes countdown', () => {
    const onWarning = vi.fn()
    const onTick = vi.fn()
    const onExpire = vi.fn()

    const mgr = new IdleTimeoutManager({ onWarning, onTick, onExpire })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS)
    expect(onWarning).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenCalledWith(WARN_MS / 1000 - 1)

    mgr.destroy()
  })

  it('does not call onWarning before IDLE_MS elapses', () => {
    const onWarning = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning, onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS - 1)
    expect(onWarning).not.toHaveBeenCalled()

    mgr.destroy()
  })

  it('calls onExpire after IDLE_MS + WARN_MS', () => {
    const onExpire = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning: vi.fn(), onTick: vi.fn(), onExpire })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS + WARN_MS)
    expect(onExpire).toHaveBeenCalledOnce()

    mgr.destroy()
  })

  it('reset() posts activity to BroadcastChannel', () => {
    const mgr = new IdleTimeoutManager({ onWarning: vi.fn(), onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()
    mgr.reset()

    expect(broadcastPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'activity' })
    )
    mgr.destroy()
  })

  it('reset() cancels pending warning and restarts IDLE_MS timer', () => {
    const onWarning = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning, onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS - 1000)
    mgr.reset()
    vi.advanceTimersByTime(IDLE_MS - 1000)
    expect(onWarning).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1001)
    expect(onWarning).toHaveBeenCalledOnce()

    mgr.destroy()
  })

  it('receiving cross-tab activity message resets the timer', () => {
    const onWarning = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning, onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS)
    expect(onWarning).toHaveBeenCalledOnce()

    capturedOnMessage?.({ data: { type: 'activity', timestamp: Date.now() } })
    vi.advanceTimersByTime(IDLE_MS - 1000)
    expect(onWarning).toHaveBeenCalledTimes(1)

    mgr.destroy()
  })

  it('ignores BroadcastChannel messages with unknown type', () => {
    const onWarning = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning, onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    capturedOnMessage?.({ data: { type: 'unknown' } })
    vi.advanceTimersByTime(IDLE_MS)
    expect(onWarning).toHaveBeenCalledOnce()

    mgr.destroy()
  })

  it('registers all ACTIVITY_EVENTS on window during start()', () => {
    const mgr = new IdleTimeoutManager({ onWarning: vi.fn(), onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    ACTIVITY_EVENTS.forEach(ev => {
      expect(registeredListeners[ev]?.size).toBeGreaterThan(0)
    })

    mgr.destroy()
  })

  it('removes all ACTIVITY_EVENTS from window and closes channel on destroy()', () => {
    const mgr = new IdleTimeoutManager({ onWarning: vi.fn(), onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()
    mgr.destroy()

    ACTIVITY_EVENTS.forEach(ev => {
      expect(registeredListeners[ev]?.size ?? 0).toBe(0)
    })
    expect(broadcastClose).toHaveBeenCalledOnce()
  })

  it('window activity event triggers reset', () => {
    const onWarning = vi.fn()
    const mgr = new IdleTimeoutManager({ onWarning, onTick: vi.fn(), onExpire: vi.fn() })
    mgr.start()

    vi.advanceTimersByTime(IDLE_MS - 5000)
    simulateWindowEvent('keydown')
    vi.advanceTimersByTime(IDLE_MS - 1000)
    expect(onWarning).not.toHaveBeenCalled()

    mgr.destroy()
  })
})
