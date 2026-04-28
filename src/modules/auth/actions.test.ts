import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any import
// ---------------------------------------------------------------------------
const {
  mockSignInWithOtp,
  mockVerifyOtp,
  mockGetUser,
  mockSignOut,
  mockFrom,
  mockLimiterLimit,
  mockHasConsent,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockSignInWithOtp = vi.fn()
  const mockVerifyOtp = vi.fn()
  const mockGetUser = vi.fn()
  const mockSignOut = vi.fn()
  const mockFrom = vi.fn()
  const mockLimiterLimit = vi.fn()
  const mockHasConsent = vi.fn()
  const mockRedirect = vi.fn()
  const mockRevalidatePath = vi.fn()
  return {
    mockSignInWithOtp,
    mockVerifyOtp,
    mockGetUser,
    mockSignOut,
    mockFrom,
    mockLimiterLimit,
    mockHasConsent,
    mockRedirect,
    mockRevalidatePath,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/redis', () => ({
  createOtpRatelimiter: vi.fn(() => ({ limit: mockLimiterLimit })),
}))

vi.mock('./service', () => ({
  hasConsent: mockHasConsent,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: vi.fn(() => null),
  })),
}))

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { sendOtpAction, verifyOtpAction } from './actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFormData(pairs: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(pairs)) fd.set(k, v)
  return fd
}

// ---------------------------------------------------------------------------
// sendOtpAction tests
// ---------------------------------------------------------------------------
describe('sendOtpAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimiterLimit.mockResolvedValue({ success: true })
  })

  it('returns error when email is missing', async () => {
    const result = await sendOtpAction({}, makeFormData({}))
    expect(result.error).toBe('E-posta adresi gereklidir.')
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('returns rate-limit error when limiter rejects', async () => {
    mockLimiterLimit.mockResolvedValue({ success: false })
    const result = await sendOtpAction({}, makeFormData({ email: 'a@b.com' }))
    expect(result.error).toContain('Çok fazla deneme')
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('returns generic error when supabase signInWithOtp fails', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { code: 'some_error', message: 'fail' } })
    const result = await sendOtpAction({}, makeFormData({ email: 'user@test.com' }))
    expect(result.error).toBe('Kod gönderilemedi. Lütfen e-posta adresinizi kontrol edin.')
    expect(result.success).toBeUndefined()
  })

  it('returns success: true on successful OTP send', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const result = await sendOtpAction({}, makeFormData({ email: 'user@test.com' }))
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('normalises email to lowercase before calling Supabase', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    await sendOtpAction({}, makeFormData({ email: 'User@Test.COM' }))
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@test.com' })
    )
  })

  it('calls signInWithOtp with shouldCreateUser: false', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    await sendOtpAction({}, makeFormData({ email: 'user@test.com' }))
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ shouldCreateUser: false }) })
    )
  })
})

// ---------------------------------------------------------------------------
// verifyOtpAction tests
// ---------------------------------------------------------------------------
describe('verifyOtpAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasConsent.mockResolvedValue(true)
  })

  it('returns error when email is missing', async () => {
    const result = await verifyOtpAction({}, makeFormData({ token: '123456' }))
    expect(result.error).toBe('E-posta ve kod gereklidir.')
  })

  it('returns error when token is missing', async () => {
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com' }))
    expect(result.error).toBe('E-posta ve kod gereklidir.')
  })

  it('returns validation error when token is not 6 digits', async () => {
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '12345' }))
    expect(result.error).toBe('Kod 6 rakamdan oluşmalıdır.')
  })

  it('returns validation error when token contains non-digits', async () => {
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '12345a' }))
    expect(result.error).toBe('Kod 6 rakamdan oluşmalıdır.')
  })

  it('returns expired error when supabase returns otp_expired code', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired', message: 'expired' } })
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(result.error).toBe('Kodun süresi dolmuş. Yeni kod isteyin.')
  })

  it('returns generic invalid code error for other supabase errors', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: { code: 'token_invalid', message: 'bad' } })
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(result.error).toBe('Kod hatalı veya geçersiz.')
  })

  it('returns user not found error when data.user is null', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: null }, error: null })
    const result = await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(result.error).toBe('Kullanıcı bulunamadı.')
  })

  it('redirects to /consent when user has not given consent', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { role: 'user' } } },
      error: null,
    })
    mockHasConsent.mockResolvedValue(false)
    await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(mockRedirect).toHaveBeenCalledWith('/consent')
  })

  it('redirects to /admin for super_admin role', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { role: 'super_admin' } } },
      error: null,
    })
    await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(mockRedirect).toHaveBeenCalledWith('/admin')
  })

  it('redirects to /tenant for tenant_admin role', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { role: 'tenant_admin' } } },
      error: null,
    })
    await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(mockRedirect).toHaveBeenCalledWith('/tenant')
  })

  it('redirects to /dashboard for regular user role', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { role: 'user' } } },
      error: null,
    })
    await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })

  it('calls verifyOtp with type: email', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {} } },
      error: null,
    })
    await verifyOtpAction({}, makeFormData({ email: 'a@b.com', token: '123456' }))
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email' })
    )
  })
})
