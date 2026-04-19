import { PageEmpty } from '@/components/common/page-states'
import { LayoutDashboard } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Hoş geldin, Demo Kullanıcı</p>
      </div>
      <PageEmpty
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="Dashboard hazırlanıyor"
        description="Faz 3 tamamlandıktan sonra buraya gerçek veriler gelecek."
      />
    </div>
  )
}
