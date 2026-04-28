import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { getRubricTemplateList } from '@/lib/actions/rubric.actions'
import { RubricsClientShell } from './RubricsClientShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, LayoutList } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RubricsPage() {
  const templates = await getRubricTemplateList()
  const hasTemplates = templates.length > 0

  return (
    <div className="space-y-6">
      <RubricsClientShell hasTemplates={hasTemplates}>
        <PageHeader
          title="Rubric Template Yönetimi"
          description={
            hasTemplates
              ? `${templates.length} template tanımlı`
              : 'Koçluk değerlendirme template\'lerini yönetin'
          }
        />
      </RubricsClientShell>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3">
          <p className="text-muted-foreground text-sm">Henüz rubric template tanımlanmamış.</p>
          <p className="text-muted-foreground text-xs">
            &quot;Yeni Template&quot; butonuyla 12 standart koçluk boyutunu otomatik oluşturabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template Adı</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Aktif Boyut</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Kullanan Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Durum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <LayoutList className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      {t.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                          Varsayılan
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium">{t.active_dimensions}</span>
                    <span className="text-muted-foreground text-xs"> / {t.total_dimensions}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.tenant_count === 0 ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <span
                        title={t.tenant_names.join(', ')}
                        className="cursor-default font-medium"
                      >
                        {t.tenant_count}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {t.is_active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/rubrics/${t.id}`}>
                        Boyutlar
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
