import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdateUserById, mockAuditInsert, mockFrom } = vi.hoisted(() => {
  const mockAuditInsert = vi.fn()
  const mockFrom = vi.fn(() => ({ insert: mockAuditInsert }))
  const mockUpdateUserById = vi.fn()
  return { mockUpdateUserById, mockAuditInsert, mockFrom }
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
  })),
}))

import { syncUserRoleToJwt } from './role-sync'

describe('syncUserRoleToJwt', () => {
  const userId = 'user-uuid-123'
  const adminId = 'admin-uuid-456'
  const adminEmail = 'admin@example.com'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates JWT user_metadata with the new role and returns empty object on success', async () => {
    mockUpdateUserById.mockResolvedValue({ error: null })
    mockAuditInsert.mockResolvedValue({ error: null })

    const result = await syncUserRoleToJwt(userId, 'manager', adminId, adminEmail)

    expect(mockUpdateUserById).toHaveBeenCalledWith(userId, { user_metadata: { role: 'manager' } })
    expect(result).toEqual({})
  })

  it('returns error when updateUserById fails', async () => {
    mockUpdateUserById.mockResolvedValue({ error: { message: 'auth error' } })

    const result = await syncUserRoleToJwt(userId, 'hr_admin', adminId, adminEmail)

    expect(result.error).toContain('JWT metadata güncellenemedi')
    expect(result.error).toContain('auth error')
    expect(mockAuditInsert).not.toHaveBeenCalled()
  })

  it('inserts audit log with correct fields after JWT update succeeds', async () => {
    mockUpdateUserById.mockResolvedValue({ error: null })
    mockAuditInsert.mockResolvedValue({ error: null })

    await syncUserRoleToJwt(userId, 'tenant_admin', adminId, adminEmail)

    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
    const insertArg = mockAuditInsert.mock.calls[0][0]
    expect(insertArg.action).toBe('role_changed')
    expect(insertArg.resource_type).toBe('user')
    expect(insertArg.resource_id).toBe(userId)
    expect(insertArg.user_id).toBe(adminId)
    expect(insertArg.actor_email).toBe(adminEmail)
    expect(insertArg.metadata).toMatchObject({ new_role: 'tenant_admin' })
  })

  it('still returns success when audit log insert fails (non-critical)', async () => {
    mockUpdateUserById.mockResolvedValue({ error: null })
    mockAuditInsert.mockResolvedValue({ error: { message: 'db write failed' } })

    const result = await syncUserRoleToJwt(userId, 'user', adminId, adminEmail)

    expect(result).toEqual({})
  })

  it('works without optional adminId and adminEmail', async () => {
    mockUpdateUserById.mockResolvedValue({ error: null })
    mockAuditInsert.mockResolvedValue({ error: null })

    const result = await syncUserRoleToJwt(userId, 'user')

    expect(result).toEqual({})
    const insertArg = mockAuditInsert.mock.calls[0][0]
    expect(insertArg.user_id).toBeUndefined()
    expect(insertArg.actor_email).toBeUndefined()
  })
})
