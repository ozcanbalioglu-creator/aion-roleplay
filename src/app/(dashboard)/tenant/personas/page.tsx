import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/PageHeader'
import { PersonaGrid } from '@/components/admin/PersonaGrid'
import { getPersonas } from '@/lib/actions/persona.actions'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PersonasPage() {
  const [user, personas] = await Promise.all([getCurrentUser(), getPersonas()])
  if (!user) redirect('/login')

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persona Yönetimi"
        description="Roleplay karakterlerini görüntüleyin ve yönetin"
        action={
          isSuperAdmin ? (
            <Button asChild>
              <Link href="/tenant/personas/new">
                <PlusIcon className="mr-2 h-4 w-4" />
                Yeni Persona
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PersonaGrid personas={personas} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
