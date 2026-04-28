import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encrypt, decrypt } from './aes-gcm'

const VALID_KEY = 'a'.repeat(64)

beforeAll(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY
})

afterAll(() => {
  delete process.env.ENCRYPTION_KEY
})

describe('aes-gcm encrypt / decrypt', () => {
  it('roundtrip: decrypt(encrypt(x)) === x', () => {
    const plain = 'Hello, AION Mirror!'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('roundtrip works for multi-line text', () => {
    const plain = 'line1\nline2\nünicode: ışık'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('produces a different ciphertext on each call (random IV)', () => {
    const plain = 'same input'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('ciphertext has 3 colon-separated base64 parts', () => {
    const parts = encrypt('test').split(':')
    expect(parts).toHaveLength(3)
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0))
  })

  it('throws on invalid ciphertext format (wrong part count)', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid ciphertext format')
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY environment variable is not set')
    process.env.ENCRYPTION_KEY = saved
  })

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    const saved = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'short'
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY must be 32 bytes')
    process.env.ENCRYPTION_KEY = saved
  })
})
