'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { createRubricTemplateAction } from '@/lib/actions/rubric.actions'
import { useServerAction } from '@/hooks/useServerAction'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasExistingTemplates: boolean
}

const INPUT_CLASS = '!bg-[#f5f2ff] border-transparent focus-visible:ring-primary/30'

export function CreateRubricTemplateDialog({ open, onOpenChange, hasExistingTemplates }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const [isDefault, setIsDefault] = useState(!hasExistingTemplates)

  const { execute } = useServerAction(createRubricTemplateAction, {
    onSuccess: () => {
      onOpenChange(false)
      formRef.current?.reset()
      router.refresh()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Rubric Template</DialogTitle>
          <DialogDescription>
            12 standart koçluk boyutu otomatik oluşturulur. Boyutları sonradan düzenleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={(fd) => execute(fd)} className="space-y-4">
          <input type="hidden" name="is_default" value={isDefault ? 'true' : 'false'} />

          <div className="space-y-1.5">
            <Label htmlFor="name">Template Adı *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Koçluk Yetkinlik Rubriği v1"
              defaultValue="Koçluk Yetkinlik Rubriği v1"
              className={INPUT_CLASS}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Bu template hakkında kısa bir açıklama..."
              className={INPUT_CLASS}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_default"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(Boolean(v))}
            />
            <Label htmlFor="is_default" className="cursor-pointer font-normal">
              Varsayılan template olarak ayarla
            </Label>
          </div>

          <SubmitButton className="w-full">
            Template Oluştur
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
