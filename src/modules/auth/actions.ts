'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { hasConsent } from './service'

export interface LoginResult {
  error?: string
}

export async function loginAction(_state: LoginResult, formData: FormData): Promise<LoginResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-posta ve şifre gereklidir.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  })

  if (error) {
    logger.warn('Login failed', { email, code: error.code })

    if (error.code === 'invalid_credentials') {
      return { error: 'E-posta veya şifre hatalı.' }
    }
    if (error.code === 'email_not_confirmed') {
      return { error: 'E-posta adresiniz henüz doğrulanmamış.' }
    }
    return { error: 'Giriş yapılamadı. Lütfen tekrar deneyin.' }
  }

  if (!data.user) {
    return { error: 'Kullanıcı bulunamadı.' }
  }

  logger.info('Login successful', { userId: data.user.id })

  // Consent kontrolü
  const consentGiven = await hasConsent(data.user.id)

  revalidatePath('/', 'layout')

  if (!consentGiven) {
    redirect('/consent')
  }

  const role = data.user.user_metadata?.role as string | undefined
  if (role === 'super_admin') {
    redirect('/admin')
  }
  if (role === 'tenant_admin') {
    redirect('/tenant')
  }

  redirect('/dashboard')
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  logger.info('User signed out')
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function consentAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const headersList = await headers()

  const { error } = await supabase
    .from('consent_records')
    .insert({
      user_id: user.id,
      tenant_id: user.user_metadata?.tenant_id,
      ip_address: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip'),
      user_agent: headersList.get('user-agent'),
      consent_version: '1.0'
    })

  if (error) {
    logger.error('Consent insert failed', { userId: user.id, error })
    // Yine de devam et (tekrar sorulabilir)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
