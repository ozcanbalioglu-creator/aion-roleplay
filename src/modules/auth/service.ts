import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { AppUser, Tenant } from '@/types'
import type { AuthSession } from './types'

/**
 * Gets the current authenticated user's full profile.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) return null

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile) {
      logger.warn('User profile not found', { userId: authUser.id })
      return null
    }

    if (!profile.is_active) {
      logger.warn('Inactive user attempted access', { userId: authUser.id })
      return null
    }

    return profile as AppUser
  } catch (error) {
    unstable_rethrow(error)
    logger.error('getCurrentUser failed', { error })
    return null
  }
}

/**
 * Gets the tenant for a given tenant_id.
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as Tenant
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}

/**
 * Checks if the current user has given KVKK consent.
 */
export async function hasConsent(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('consent_records')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error) return false
    return data !== null
  } catch (error) {
    unstable_rethrow(error)
    return false
  }
}

/**
 * Gets the full auth session (user + tenant + consent status).
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const [tenant, consentExists] = await Promise.all([
    getTenant(user.tenant_id),
    hasConsent(user.id)
  ])

  return { user, tenant, hasConsent: consentExists }
}

/**
 * Records KVKK consent for a user.
 */
export async function recordConsent(
  userId: string,
  tenantId: string,
  metadata: { ipAddress?: string; userAgent?: string }
): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('consent_records')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        ip_address: metadata.ipAddress,
        user_agent: metadata.userAgent,
        consent_version: '1.0'
      })

    if (error) {
      logger.error('Failed to record consent', { userId, error })
      return false
    }

    logger.info('Consent recorded', { userId, tenantId })
    return true
  } catch (error) {
    unstable_rethrow(error)
    logger.error('recordConsent exception', { error })
    return false
  }
}
