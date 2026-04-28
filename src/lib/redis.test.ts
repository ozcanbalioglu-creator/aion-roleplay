import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('redis module', () => {
  const ORIG_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIG_ENV }
  })

  afterEach(() => {
    process.env = ORIG_ENV
  })

  it('createRedis returns null when UPSTASH_REDIS_REST_URL is missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const { redis } = await import('@/lib/redis')
    expect(redis).toBeNull()
  })

  it('createRedis returns null when UPSTASH_REDIS_REST_TOKEN is missing', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const { redis } = await import('@/lib/redis')
    expect(redis).toBeNull()
  })

  it('createOtpRatelimiter returns null when redis is null', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const { createOtpRatelimiter } = await import('@/lib/redis')
    expect(createOtpRatelimiter()).toBeNull()
  })
})
