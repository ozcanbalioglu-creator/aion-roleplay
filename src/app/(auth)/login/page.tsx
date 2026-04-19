'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginAction, type LoginResult } from '@/modules/auth/actions'

const initialState: LoginResult = {}

function LoginFormContent() {
  const searchParams = useSearchParams()
  const [state, formAction, isPending] = useActionState(loginAction, initialState)

  return (
    <>
      <div className="space-y-2 text-center">
        {/* Mobile logo */}
        <div className="flex justify-center mb-4 lg:hidden">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">R</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Giriş Yap</h1>
        <p className="text-muted-foreground text-sm">
          Koçluk platformuna hoş geldiniz
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {searchParams.get('next') && !state.error && (
        <Alert>
          <AlertDescription>
            Bu sayfaya erişmek için giriş yapmanız gerekiyor.
          </AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ad@sirket.com"
            autoComplete="email"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Şifre</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Giriş yaparak{' '}
        <a
          href="/kvkk"
          className="underline underline-offset-4 hover:text-foreground transition-colors"
        >
          KVKK Aydınlatma Metnini
        </a>{' '}
        okuduğunuzu kabul etmiş olursunuz.
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  )
}
