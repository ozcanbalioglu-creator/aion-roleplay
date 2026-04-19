'use client'

import { useActionState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { consentAction } from '@/modules/auth/actions'

export default function ConsentPage() {
  const [, formAction, isPending] = useActionState(consentAction, undefined)

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Kişisel Veri Aydınlatma Metni
        </h1>
        <p className="text-muted-foreground text-sm">
          Platforma devam etmek için lütfen okuyun ve onaylayın.
        </p>
      </div>

      <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
          <p className="font-semibold text-foreground">
            6698 Sayılı KVKK Kapsamında Aydınlatma Metni
          </p>
          <p>
            Bu platform, koçluk becerisi geliştirme amacıyla yapay zeka destekli
            rol canlandırma seansları sunmaktadır. Bu kapsamda aşağıdaki verileriniz
            işlenmektedir:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Ad, soyad ve kurumsal e-posta adresi</li>
            <li>Koçluk seansı transkriptleri (şifreli olarak saklanır)</li>
            <li>Koçluk becerisi değerlendirme sonuçları</li>
            <li>Seans tarihi, süresi ve seçilen persona bilgisi</li>
          </ul>
          <Separator />
          <p className="font-medium text-foreground">Verileriniz ne amaçla kullanılır?</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Koçluk becerisi gelişimini ölçmek ve raporlamak</li>
            <li>Yöneticilerinize (transkript görünmeden) özet içgörü sunmak</li>
            <li>Platformun kalitesini geliştirmek</li>
          </ul>
          <Separator />
          <p className="font-medium text-foreground">Haklarınız</p>
          <p>
            KVKK'nın 11. maddesi kapsamında verilerinize erişim, düzeltme ve
            silme talep etme hakkınız bulunmaktadır. Talepler 30 iş günü
            içinde yanıtlanır. Silme talepleri platform üzerinden yapılabilir.
          </p>
          <p className="text-xs text-muted-foreground">
            Veri Sorumlusu: Şirketiniz / Versiyon: 1.0 / {new Date().getFullYear()}
          </p>
        </div>
      </ScrollArea>

      <form action={formAction} className="space-y-3">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor...</> : 'Okudum, Onaylıyorum — Platforma Geç'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Onaylamadan platforma erişemezsiniz.
        </p>
      </form>
    </div>
  )
}
