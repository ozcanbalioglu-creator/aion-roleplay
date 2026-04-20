'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'
import { UserPlusIcon } from 'lucide-react'

export function InviteUserButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon className="mr-2 h-4 w-4" />
        Kullanıcı Davet Et
      </Button>
      <InviteUserDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
