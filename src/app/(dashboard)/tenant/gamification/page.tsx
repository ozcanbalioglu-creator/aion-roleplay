import { AdminGuard } from '@/components/admin/AdminGuard'
import { PageHeader } from '@/components/admin/PageHeader'
import { GamificationForms } from '@/components/tenant/GamificationForms'
import { GamificationLists } from '@/components/tenant/GamificationLists'
import { getTenantBadges, getTenantChallenges } from '@/lib/actions/gamification.actions'
import { Zap } from 'lucide-react'
import { notFound } from 'next/navigation'
import { features } from '@/lib/features'

export default async function TenantGamificationPage() {
  if (!features.gamification) notFound()
  const [badges, challenges] = await Promise.all([getTenantBadges(), getTenantChallenges()])

  return (
    <AdminGuard allowedRoles={['tenant_admin', 'super_admin']}>
      <div className="p-8 md:p-12 space-y-10 max-w-5xl mx-auto">
        <PageHeader
          title="Gamification Yönetimi"
          description="Şirketinize özel rozetler tanımlayın ve haftalık görev havuzuna yeni hedefler ekleyin."
        />

        <GamificationForms />
        <GamificationLists
          key={`${badges.length}-${challenges.length}`}
          badges={badges}
          challenges={challenges}
        />
        
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mt-8">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Haftalık Döngü Hakkında</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Burada oluşturduğunuz görevler, her Pazartesi sabahı otomatik olarak çalışan &quot;Atama Robotu&quot; tarafından tüm şirket çalışanlarınıza dağıtılır.
                  Her kullanıcı, biri seans tamamlama odaklı olmak üzere toplam 3 farklı görev alır.
                </p>
              </div>
            </div>
            <div className="border-t border-primary/10 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Tanımla', desc: 'Burada rozet ve görev şablonları oluşturun.' },
                { step: '2', title: 'Dağıt', desc: 'Her Pazartesi sistem, çalışanlara 3 haftalık görev atar.' },
                { step: '3', title: 'Kazan', desc: 'Kullanıcı görevi tamamlayınca DP ve rozet otomatik verilir.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}
