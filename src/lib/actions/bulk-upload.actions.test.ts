import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'

const {
  mockCreateUser,
  mockUpdateProfile,
  mockFrom,
  mockGetCurrentUser,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockCreateUser = vi.fn()
  const mockUpdateProfile = vi.fn()
  const mockFrom = vi.fn()
  const mockGetCurrentUser = vi.fn()
  const mockRevalidatePath = vi.fn()
  return { mockCreateUser, mockUpdateProfile, mockFrom, mockGetCurrentUser, mockRevalidatePath }
})

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        inviteUserByEmail: mockCreateUser,
      },
    },
    from: mockFrom,
  })),
}))

import { bulkUploadUsersAction } from './bulk-upload.actions'

function makeXlsxFile(rows: Record<string, string>[]): File {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function makeCsvFile(content: string): File {
  return new File([content], 'test.csv', { type: 'text/csv' })
}

describe('bulkUploadUsersAction', () => {
  const tenantAdminUser = {
    id: 'admin-id',
    role: 'tenant_admin',
    tenant_id: 'tenant-123',
    email: 'admin@example.com',
    full_name: 'Admin User',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })
  })

  it('returns error when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const formData = new FormData()
    const result = await bulkUploadUsersAction(formData)
    expect(result).toEqual({ error: 'Yetkiniz yok.' })
  })

  it('returns error when user role is not tenant_admin or super_admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...tenantAdminUser, role: 'user' })
    const formData = new FormData()
    const result = await bulkUploadUsersAction(formData)
    expect(result).toEqual({ error: 'Yetkiniz yok.' })
  })

  it('returns error when no file is provided', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const formData = new FormData()
    const result = await bulkUploadUsersAction(formData)
    expect(result).toEqual({ error: 'Dosya seçilmedi.' })
  })

  it('returns error when file is empty (no rows)', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([])
    const formData = new FormData()
    formData.append('file', file)
    const result = await bulkUploadUsersAction(formData)
    expect(result).toEqual({ error: 'Dosya boş veya okunamadı.' })
  })

  it('returns error when file exceeds 200 rows', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const rows = Array.from({ length: 201 }, (_, i) => ({
      'Ad Soyad': `User ${i}`,
      'E-posta': `user${i}@example.com`,
      'Rol': 'user',
    }))
    const file = makeXlsxFile(rows)
    const formData = new FormData()
    formData.append('file', file)
    const result = await bulkUploadUsersAction(formData)
    expect(result).toEqual({ error: 'En fazla 200 satır yüklenebilir.' })
  })

  it('marks rows with missing required fields as error', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': '', 'E-posta': 'test@example.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.errors).toBe(1)
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].message).toBe('Zorunlu alan eksik')
  })

  it('marks rows with invalid role as error', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Test User', 'E-posta': 'test@example.com', 'Rol': 'InvalidRole' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.errors).toBe(1)
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].message).toContain('Geçersiz rol')
  })

  it('successfully creates a user from a valid row', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Ahmet Yılmaz', 'E-posta': 'ahmet@sirket.com', 'Rol': 'Kullanıcı', 'Departman': 'Satış' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-ahmet' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.created).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(result.rows[0].status).toBe('created')
    expect(result.rows[0].email).toBe('ahmet@sirket.com')
  })

  it('skips row when auth returns email_exists error', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Mevcut Kullanıcı', 'E-posta': 'existing@sirket.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already registered', code: 'email_exists' },
    })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.skipped).toBe(1)
    expect(result.rows[0].status).toBe('skipped')
    expect(result.rows[0].message).toBe('Kullanıcı zaten mevcut')
  })

  it('skips row when auth error message contains "already been registered"', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Mevcut Kullanıcı', 'E-posta': 'existing@sirket.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already been registered', code: undefined },
    })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.skipped).toBe(1)
    expect(result.rows[0].status).toBe('skipped')
  })

  it('marks row as error when auth fails with unknown error', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Error User', 'E-posta': 'error@sirket.com', 'Rol': 'manager' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.errors).toBe(1)
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].message).toBe('Database connection failed')
  })

  it('accepts Turkish and English role variants', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const rolesToTest = [
      { input: 'Kullanıcı', expected: 'user' },
      { input: 'user', expected: 'user' },
      { input: 'Yönetici', expected: 'manager' },
      { input: 'manager', expected: 'manager' },
      { input: 'HR Admin', expected: 'hr_admin' },
      { input: 'hr_admin', expected: 'hr_admin' },
      { input: 'HR Görüntüleyici', expected: 'hr_viewer' },
      { input: 'hr_viewer', expected: 'hr_viewer' },
      { input: 'Tenant Admin', expected: 'tenant_admin' },
      { input: 'tenant_admin', expected: 'tenant_admin' },
    ]

    for (const { input } of rolesToTest) {
      vi.clearAllMocks()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ update: mockUpdate })

      const file = makeXlsxFile([
        { 'Ad Soyad': 'Test User', 'E-posta': `test-${input}@example.com`, 'Rol': input },
      ])
      const formData = new FormData()
      formData.append('file', file)
      mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

      const result = await bulkUploadUsersAction(formData)
      if ('error' in result) throw new Error(`Expected BulkUploadResult for role: ${input}`)
      expect(result.errors, `role "${input}" should not error`).toBe(0)
      expect(result.rows[0].status, `role "${input}" should be created`).toBe('created')
    }
  })

  it('processes mixed results correctly (created + skipped + error)', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'New User', 'E-posta': 'new@example.com', 'Rol': 'user' },
      { 'Ad Soyad': 'Existing', 'E-posta': 'existing@example.com', 'Rol': 'user' },
      { 'Ad Soyad': '', 'E-posta': 'bad@example.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    mockCreateUser
      .mockResolvedValueOnce({ data: { user: { id: 'uid-new' } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'already been registered', code: 'email_exists' } })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.created).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(1)
    expect(result.rows).toHaveLength(3)
  })

  it('creates user without password via inviteUserByEmail (OTP-only auth)', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'OTP User', 'E-posta': 'otp@sirket.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-otp' } }, error: null })

    await bulkUploadUsersAction(formData)

    // inviteUserByEmail(email, options) — first arg is email string, no password field
    expect(mockCreateUser).toHaveBeenCalledWith(
      'otp@sirket.com',
      expect.objectContaining({ data: expect.objectContaining({ role: 'user' }) })
    )
  })

  it('calls revalidatePath after processing', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Test', 'E-posta': 'test@example.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

    await bulkUploadUsersAction(formData)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tenant/users')
  })

  it('super_admin is also authorized to upload', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...tenantAdminUser, role: 'super_admin' })
    const file = makeXlsxFile([
      { 'Ad Soyad': 'SA User', 'E-posta': 'sa@example.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-sa' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.created).toBe(1)
  })

  it('parses CSV file correctly', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const csvContent = 'Ad Soyad,E-posta,Rol,Departman\nAhmet Yılmaz,ahmet@csv.com,Kullanıcı,Satış'
    const file = makeCsvFile(csvContent)
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-csv' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.created).toBe(1)
    expect(result.rows[0].email).toBe('ahmet@csv.com')
  })

  it('normalizes email to lowercase', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'Test User', 'E-posta': 'TEST@EXAMPLE.COM', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.rows[0].email).toBe('test@example.com')
  })

  it('sets correct row numbers starting from 2 (header is row 1)', async () => {
    mockGetCurrentUser.mockResolvedValue(tenantAdminUser)
    const file = makeXlsxFile([
      { 'Ad Soyad': 'User One', 'E-posta': 'one@example.com', 'Rol': 'user' },
      { 'Ad Soyad': '', 'E-posta': 'two@example.com', 'Rol': 'user' },
    ])
    const formData = new FormData()
    formData.append('file', file)

    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

    const result = await bulkUploadUsersAction(formData)
    if ('error' in result) throw new Error('Expected BulkUploadResult')
    expect(result.rows[0].row).toBe(2)
    expect(result.rows[1].row).toBe(3)
  })
})
