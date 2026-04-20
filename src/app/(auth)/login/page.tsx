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
      <div className="space-y-2">
        <h2 className="text-3xl font-headline italic text-on-background">Hoş geldiniz</h2>
        <p className="font-body text-sm text-on-surface-variant font-light">Mirror hesabınıza erişim sağlayın.</p>
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

      <form action={formAction} className="space-y-6">
        {/* Input Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-1">E-posta</Label>
          <div className="relative group">
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="isim@sirket.com"
              autoComplete="email"
              required
              disabled={isPending}
            />
          </div>
        </div>

        {/* Input Password */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <Label htmlFor="password" className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Şifre</Label>
            <a href="#" className="font-label text-[10px] uppercase tracking-widest text-on-primary-container hover:opacity-70 transition-opacity">Şifremi Unuttum</a>
          </div>
          <div className="relative group">
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
        </div>

        {/* Submit Button */}
        <Button type="submit" variant="default" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {isPending ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center py-4">
        <div className="flex-grow border-t border-outline-variant/10"></div>
        <span className="flex-shrink mx-4 font-label text-[10px] uppercase tracking-[0.3em] text-outline">veya</span>
        <div className="flex-grow border-t border-outline-variant/10"></div>
      </div>

      {/* SSO Button */}
      <Button type="button" variant="outline" className="w-full h-14 rounded-full font-body font-medium hover:bg-surface-container-highest transition-all duration-300">
        <img alt="Google Logo" className="w-5 h-5 mr-3" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgNWqlUWCyC2bJYJSGRaHf6H2syHcd8c08FWZg1r4IUEIJ6jOrF-soxpl8KuBuIro1CZvUmQlMMPgnVNGUw7BpWyAOA2EgkH41QKQi9SdfReRrt1zt3zkpdgRKCpkGia2WpLg-03PfBuofpsqVqfIc4vb8WJhisf3ijBjrvO3Qvks9JJtWSvrD7B5ky5wiBtSn3NIkz4hEx0ecd97QCCy_bqxsP45J6TCy9535djyvXHtpTNhWN1huizyC6OxDCt339NpDIwu4f76L" />
        SSO ile Giriş
      </Button>

      {/* Footer Action */}
      <div className="text-center pt-8">
        <a href="#" className="group inline-flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-primary-container transition-colors duration-300">
          <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
          Davet kodun mu var?
          <span className="w-8 h-[1px] bg-outline-variant/30 group-hover:bg-on-primary-container transition-colors"></span>
        </a>
      </div>
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
