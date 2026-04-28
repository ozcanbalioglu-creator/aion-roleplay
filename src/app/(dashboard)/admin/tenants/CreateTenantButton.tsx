'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog'
import { PlusIcon } from 'lucide-react'

interface RubricTemplateOption {
  id: string
  name: string
  is_default: boolean
}

interface Props {
  rubricTemplates?: RubricTemplateOption[]
}

export function CreateTenantButton({ rubricTemplates = [] }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Yeni Tenant
      </Button>
      <CreateTenantDialog open={open} onOpenChange={setOpen} rubricTemplates={rubricTemplates} />
    </>
  )
}
