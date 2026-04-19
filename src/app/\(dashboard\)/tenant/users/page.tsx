import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcı Yönetimi"
        description="Kurumunuzun kullanıcılarını yönetin"
        action={
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Kullanıcı Davet Et
          </Button>
        }
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Kullanıcı tablosu — Faz 5.3'te oluşturulacak</p>
      </div>
    </div>
  )
}
