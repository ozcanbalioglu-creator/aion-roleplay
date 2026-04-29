'use client'

import { useRef, useState, useTransition } from 'react'
import { UploadIcon, DownloadIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { bulkUploadUsersAction } from '@/lib/actions/bulk-upload.actions'
import type { BulkUploadResult, BulkUploadRow } from '@/lib/actions/bulk-upload.actions'
import { toast } from '@/lib/toast'

function downloadTemplate() {
  window.location.href = '/templates/kullanici_sablonu.xlsx'
}

function StatusBadge({ status }: { status: BulkUploadRow['status'] }) {
  const variants: Record<BulkUploadRow['status'], { label: string; className: string }> = {
    created: { label: 'Oluşturuldu', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    skipped: { label: 'Atlandı', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    error: { label: 'Hata', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }
  const v = variants[status]
  return (
    <Badge className={cn('border', v.className)}>
      {v.label}
    </Badge>
  )
}

export function BulkUploadSheet() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setResult(null)
      setUploadError(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setUploadError(null)
    setResult(null)

    startTransition(async () => {
      const res = await bulkUploadUsersAction(formData)
      if ('error' in res) {
        setUploadError(res.error)
        toast.error(res.error)
      } else {
        setResult(res)
        if (res.created > 0) {
          toast.success(`${res.created} kullanıcı oluşturuldu.`)
        }
      }
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UploadIcon className="mr-2 h-4 w-4" />
        Toplu Yükle
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 rounded-2xl"
        >
          <SheetHeader>
            <SheetTitle>Toplu Kullanıcı Yükleme</SheetTitle>
            <SheetDescription>CSV veya Excel dosyası yükleyin</SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
            <div>
              <p className="text-sm font-medium">Şablon dosyası</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kolonlar: Ad Soyad, E-posta, Rol, Departman
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <DownloadIcon className="mr-2 h-3.5 w-3.5" />
              İndir
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="bulk-file" className="text-sm font-medium">
                Dosya seçin
              </label>
              <input
                ref={fileInputRef}
                id="bulk-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                required
                className="block w-full text-sm text-foreground
                  file:mr-3 file:py-1.5 file:px-3
                  file:rounded-lg file:border file:border-border
                  file:bg-muted file:text-sm file:font-medium
                  file:cursor-pointer
                  hover:file:bg-muted/80
                  cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                CSV veya Excel (.csv, .xlsx, .xls). Maksimum 200 satır.
              </p>
            </div>

            {uploadError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {uploadError}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Yükle
                </>
              )}
            </Button>
          </form>

          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{result.created}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Oluşturuldu</p>
                </div>
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Atlandı</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                  <p className="text-xl font-bold text-red-400">{result.errors}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Hata</p>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Satır</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead className="w-28">Durum</TableHead>
                      <TableHead>Mesaj</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row) => (
                      <TableRow key={`${row.row}-${row.email}`}>
                        <TableCell className="text-muted-foreground">{row.row}</TableCell>
                        <TableCell className="font-mono text-xs">{row.email}</TableCell>
                        <TableCell>{row.full_name}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.message ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
