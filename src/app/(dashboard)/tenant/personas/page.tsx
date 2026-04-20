import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { PersonaGrid } from '@/components/admin/PersonaGrid'
import { getPersonas } from '@/lib/actions/persona.actions'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PersonasPage() {
  const personas = await getPersonas()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persona Yönetimi"
        description="Roleplay karakterlerini oluşturun ve yönetin"
        action={
          <Button asChild>
            <Link href="/tenant/personas/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Yeni Persona
            </Link>
          </Button>
        }
      />
      <PersonaGrid personas={personas} />
    </div>
  )
}
