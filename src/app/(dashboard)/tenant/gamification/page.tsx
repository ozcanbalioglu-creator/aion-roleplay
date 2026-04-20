import { AdminGuard } from '@/components/admin/AdminGuard'
import { PageHeader } from '@/components/admin/PageHeader'
import { GamificationForms } from '@/components/tenant/GamificationForms'
import { Zap } from 'lucide-react'

export default function TenantGamificationPage() {
  return (
    <AdminGuard allowedRoles={['tenant_admin', 'super_admin']}>
      <div className="p-8 md:p-12 space-y-10 max-w-5xl mx-auto">
        <PageHeader
          title="Gamification Yönetimi"
          description="Şirketinize özel rozetler tanımlayın ve haftalık görev havuzuna yeni hedefler ekleyin."
        />

        <GamificationForms />
        
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mt-8">
           <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Haftalık Döngü Hakkında</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Burada oluşturduğunuz görevler, her Pazartesi sabahı otomatik olarak çalışan "Atama Robotu" tarafından tüm şirket çalışanlarınıza dağıtılır. 
                  Her kullanıcı, biri seans tamamlama odaklı olmak üzere toplam 3 farklı görev alır.
                </p>
              </div>
           </div>
        </div>
      </div>
    </AdminGuard>
  )
}
