import type { AppUser, Tenant } from '@/types'

export interface AuthSession {
  user: AppUser
  tenant: Tenant | null
  hasConsent: boolean
}

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'TENANT_NOT_FOUND' | 'INACTIVE' | 'UNKNOWN'
  message: string
}
