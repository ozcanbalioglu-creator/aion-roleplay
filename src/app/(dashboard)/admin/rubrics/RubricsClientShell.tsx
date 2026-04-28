'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CreateRubricTemplateDialog } from '@/components/admin/CreateRubricTemplateDialog'

interface Props {
  hasTemplates: boolean
  children: React.ReactNode
}

export function RubricsClientShell({ hasTemplates, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        <Button onClick={() => setOpen(true)} size="sm" className="ml-4 shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Yeni Template
        </Button>
      </div>

      <CreateRubricTemplateDialog
        open={open}
        onOpenChange={setOpen}
        hasExistingTemplates={hasTemplates}
      />
    </>
  )
}
