'use client'

import { useTransition } from 'react'
import { toast } from '@/lib/toast'

type ActionResult = { error?: string; success?: string } | void

export function useServerAction<T extends unknown[]>(
  action: (...args: T) => Promise<ActionResult>,
  options?: {
    onSuccess?: (result: ActionResult) => void
    onError?: (error: string) => void
  }
) {
  const [isPending, startTransition] = useTransition()

  function execute(...args: T) {
    startTransition(async () => {
      try {
        const result = await action(...args)
        if (result?.error) {
          toast.error(result.error)
          options?.onError?.(result.error)
        } else {
          const message = result?.success ?? 'İşlem başarılı'
          toast.success(message)
          options?.onSuccess?.(result)
        }
      } catch {
        const msg = 'Beklenmeyen bir hata oluştu'
        toast.error(msg)
        options?.onError?.(msg)
      }
    })
  }

  return { execute, isPending }
}
