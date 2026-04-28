'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatIdleTime } from '@/lib/utils/formatIdleTime'

interface Props {
  secondsLeft: number
  onContinue: () => void
}

export function IdleTimeoutDialog({ secondsLeft, onContinue }: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Oturumunuz sona erecek</AlertDialogTitle>
          <AlertDialogDescription>
            Hareketsizlik nedeniyle oturumunuz{' '}
            <strong>{formatIdleTime(secondsLeft)}</strong> içinde otomatik olarak
            kapatılacak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinue}>Devam Et</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
