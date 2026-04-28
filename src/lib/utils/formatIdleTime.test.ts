import { describe, it, expect } from 'vitest'
import { formatIdleTime } from './formatIdleTime'

describe('formatIdleTime', () => {
  it('returns only seconds when less than 60 seconds remain', () => {
    expect(formatIdleTime(45)).toBe('45 saniye')
    expect(formatIdleTime(1)).toBe('1 saniye')
    expect(formatIdleTime(59)).toBe('59 saniye')
  })

  it('returns minutes and seconds when 60 or more seconds remain', () => {
    expect(formatIdleTime(60)).toBe('1 dakika 0 saniye')
    expect(formatIdleTime(90)).toBe('1 dakika 30 saniye')
    expect(formatIdleTime(300)).toBe('5 dakika 0 saniye')
    expect(formatIdleTime(299)).toBe('4 dakika 59 saniye')
  })

  it('returns 0 saniye for zero', () => {
    expect(formatIdleTime(0)).toBe('0 saniye')
  })

  it('handles exactly one minute', () => {
    expect(formatIdleTime(61)).toBe('1 dakika 1 saniye')
  })
})
