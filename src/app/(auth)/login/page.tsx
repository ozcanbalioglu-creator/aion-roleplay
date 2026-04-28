'use client'

import { useActionState, Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { sendOtpAction, verifyOtpAction, type SendOtpResult, type VerifyOtpResult } from '@/modules/auth/actions'

function LoginFormContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')

  const [sendState, sendFormAction, isSendPending] = useActionState<SendOtpResult, FormData>(sendOtpAction, {})
  const [verifyState, verifyFormAction, isVerifyPending] = useActionState<VerifyOtpResult, FormData>(verifyOtpAction, {})

  useEffect(() => {
    if (sendState.success) setStep('code')
  }, [sendState.success])

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-3xl font-headline italic text-on-background">Hoş geldiniz</h2>
        <p className="font-body text-sm text-on-surface-variant font-light">Mirror hesabınıza erişim sağlayın.</p>
      </div>

      {searchParams.get('next') && (
        <Alert>
          <AlertDescription>Bu sayfaya erişmek için giriş yapmanız gerekiyor.</AlertDescription>
        </Alert>
      )}

      {searchParams.get('reason') === 'idle' && (
        <Alert>
          <AlertDescription>Hareketsizlik nedeniyle oturumunuz sonlandırıldı.</AlertDescription>
        </Alert>
      )}

      {step === 'email' ? (
        <form action={sendFormAction} className="space-y-6">
          {sendState.error && (
            <Alert variant="destructive">
              <AlertDescription>{sendState.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-1">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="isim@sirket.com"
              autoComplete="email"
              required
              disabled={isSendPending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" variant="default" className="w-full" disabled={isSendPending}>
            {isSendPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isSendPending ? 'Gönderiliyor...' : 'Giriş kodu gönder'}
          </Button>
        </form>
      ) : (
        <form action={verifyFormAction} className="space-y-6">
          {verifyState.error && (
            <Alert variant="destructive">
              <AlertDescription>{verifyState.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <p className="font-body text-sm text-on-surface-variant">
              <span className="font-medium text-on-background">{email}</span> adresine gönderilen 6 haneli kodu girin.
            </p>
          </div>
          <input type="hidden" name="email" value={email} />
          <div className="space-y-2">
            <Label htmlFor="token" className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-1">Doğrulama Kodu</Label>
            <Input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              autoComplete="one-time-code"
              required
              disabled={isVerifyPending}
              className="text-center tracking-[0.5em] text-xl"
            />
          </div>
          <Button type="submit" variant="default" className="w-full" disabled={isVerifyPending}>
            {isVerifyPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isVerifyPending ? 'Doğrulanıyor...' : 'Giriş yap'}
          </Button>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="flex items-center gap-1 text-[11px] font-label uppercase tracking-widest text-on-surface-variant hover:text-on-background transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Farklı e-posta kullan
          </button>
        </form>
      )}

    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <LoginFormContent />
    </Suspense>
  )
}
