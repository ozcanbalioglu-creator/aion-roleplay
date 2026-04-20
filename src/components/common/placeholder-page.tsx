import { PageEmpty } from '@/components/common/page-states'
import { LayoutDashboard } from 'lucide-react'

interface PlaceholderProps {
  title: string
  description: string
}

export default function PlaceholderPage({ title, description }: { title?: string, description?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title || 'Sayfa Hazırlanıyor'}</h1>
        <p className="text-muted-foreground text-sm">
          {description || 'Bu modül bir sonraki geliştirme fazında (Faz 8-10) aktif edilecektir.'}
        </p>
      </div>

      <PageEmpty
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="Henüz veri bulunmuyor"
        description="Geliştirme süreci devam etmektedir."
      />
    </div>
  )
}
