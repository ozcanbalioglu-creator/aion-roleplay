'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportTeamCSVAction } from '@/lib/actions/reports.actions'
import type { ReportPeriod } from '@/lib/queries/reports.queries'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CSVExportButtonProps {
  period: ReportPeriod
}

export function CSVExportButton({ period }: CSVExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await exportTeamCSVAction(period)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success('Rapor indirildi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      CSV İndir
    </Button>
  )
}
