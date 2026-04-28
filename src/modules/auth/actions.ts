'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { hasConsent } from './service'
import { createOtpRatelimiter } from '@/lib/redis'

export interface SendOtpResult {
  error?: string
  success?: boolean
}

export interface VerifyOtpResult {
  error?: string
}

export async function sendOtpAction(_state: SendOtpResult, formData: FormData): Promise<SendOtpResult> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()

  if (!email) return { error: 'E-posta adresi gereklidir.' }

  const limiter = createOtpRatelimiter()
  if (limiter) {
    const { success } = await limiter.limit(email)
    if (!success) {
      return { error: 'Çok fazla deneme. Lütfen 15 dakika sonra tekrar deneyin.' }
    }
  }

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (error) {
    logger.warn('OTP send failed', { email, code: error.code })
    return { error: 'Kod gönderilemedi. Lütfen e-posta adresinizi kontrol edin.' }
  }

  logger.info('OTP sent', { email })
  return { success: true }
}

export async function verifyOtpAction(_state: VerifyOtpResult, formData: FormData): Promise<VerifyOtpResult> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const token = (formData.get('token') as string | null)?.trim()

  if (!email || !token) return { error: 'E-posta ve kod gereklidir.' }
  if (!/^\d{6}$/.test(token)) return { error: 'Kod 6 rakamdan oluşmalıdır.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    logger.warn('OTP verify failed', { email, code: error.code })
    if (error.code === 'otp_expired') return { error: 'Kodun süresi dolmuş. Yeni kod isteyin.' }
    return { error: 'Kod hatalı veya geçersiz.' }
  }

  if (!data.user) return { error: 'Kullanıcı bulunamadı.' }

  logger.info('OTP login successful', { userId: data.user.id })

  const consentGiven = await hasConsent(data.user.id)
  revalidatePath('/', 'layout')

  if (!consentGiven) redirect('/consent')

  const role = data.user.user_metadata?.role as string | undefined
  if (role === 'super_admin') redirect('/admin')
  if (role === 'tenant_admin') redirect('/tenant')
  redirect('/dashboard')
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  logger.info('User signed out')
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  logger.info('User signed out via idle timeout')
  revalidatePath('/', 'layout')
}

export async function consentAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const headersList = await headers()

  const tenantId = user.user_metadata?.tenant_id ?? null

  const { error } = await supabase
    .from('consent_records')
    .insert({
      user_id: user.id,
      tenant_id: tenantId,
      ip_address: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip'),
      user_agent: headersList.get('user-agent'),
      consent_version: '1.0'
    })

  if (error) {
    logger.error('Consent insert failed', { userId: user.id, error })
  }

  revalidatePath('/', 'layout')

  const role = user.user_metadata?.role as string | undefined
  if (role === 'super_admin') redirect('/admin')
  if (role === 'tenant_admin') redirect('/tenant')
  redirect('/dashboard')
}
