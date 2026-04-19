import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/modules/auth'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PersonasPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServiceClient()

  const { data: personas } = await supabase
    .from('personas')
    .select(`*, persona_kpis(count)`)
    .eq('tenant_id', currentUser.tenant_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persona Yönetimi"
        description={`${personas?.length ?? 0} persona tanımlı`}
        action={
          <Button asChild>
            <Link href="/tenant/personas/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Yeni Persona
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas?.map((persona: any) => (
          <Card key={persona.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{persona.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{persona.title}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">KPI</span>
                <span className="text-sm">{persona.persona_kpis?.[0]?.count ?? 0}</span>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href={`/tenant/personas/${persona.id}/edit`}>
                  Düzenle
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
