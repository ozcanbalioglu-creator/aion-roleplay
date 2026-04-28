'use server'

import { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

/**
 * Syncs a user's role to their JWT user_metadata and writes an audit log entry.
 *
 * @param userId        - The auth user ID whose metadata will be updated.
 * @param role          - The new role to apply.
 * @param actorId       - (optional) The admin user performing the change — stored in audit_logs.user_id.
 * @param actorEmail    - (optional) The admin user's email — stored in audit_logs.actor_email.
 * @param tenantId      - (optional) The tenant context — stored in audit_logs.tenant_id.
 * @returns             Empty object on success, or { error: string } if the JWT update fails.
 *                      Audit log failures are non-critical and do not cause an error return.
 */
export async function syncUserRoleToJwt(
  userId: string,
  role: UserRole,
  actorId?: string,
  actorEmail?: string,
  tenantId?: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()

  const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  })
  if (metaError) {
    return { error: 'JWT metadata güncellenemedi: ' + metaError.message }
  }

  const auditRecord: Record<string, unknown> = {
    action: 'role_changed',
    resource_type: 'user',
    resource_id: userId,
    metadata: { new_role: role },
    tenant_id: tenantId ?? null,
  }
  if (actorId) auditRecord.user_id = actorId
  if (actorEmail) auditRecord.actor_email = actorEmail

  const { error: auditError } = await supabase.from('audit_logs').insert(auditRecord)
  if (auditError) {
    // Audit log failure is non-critical — role is already updated, continue.
    console.warn('Audit log yazılamadı:', auditError.message)
  }

  return {}
}
