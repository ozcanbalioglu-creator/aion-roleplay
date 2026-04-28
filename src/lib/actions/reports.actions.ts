'use server'

import { getCurrentUser } from '@/lib/auth'
import { getTeamCSVData, type ReportPeriod } from '@/lib/queries/reports.queries'

export async function exportTeamCSVAction(period: ReportPeriod = 'all'): Promise<
  { success: true; csv: string; filename: string } | { success: false; error: string }
> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: 'Oturum açılmamış' }

  const allowedRoles = ['hr_viewer', 'tenant_admin', 'super_admin']
  if (!allowedRoles.includes(currentUser.role)) {
    return { success: false, error: 'Bu işlem için yetkiniz yok' }
  }

  const rows = await getTeamCSVData(period)
  if (!rows.length) return { success: false, error: 'Dışa aktarılacak veri yok' }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = String((row as Record<string, unknown>)[header] ?? '')
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(',')
    ),
  ]

  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `aion-mirror-takim-raporu-${dateStr}.csv`

  return { success: true, csv: `\uFEFF${csvLines.join('\n')}`, filename }
}
