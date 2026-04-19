import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

export default function ScenariosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Senaryo Yönetimi"
        description="Koçluk seansları için senaryoları yönetin"
        action={
          <Button asChild>
            <Link href="/tenant/scenarios/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Yeni Senaryo
            </Link>
          </Button>
        }
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Senaryo listesi — Faz 5.8'te oluşturulacak</p>
      </div>
    </div>
  )
}
