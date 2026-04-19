import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toggleTenantStatusAction } from '@/lib/actions/tenant.actions'
import { Tenant } from '@/types'

interface TenantTableProps {
  tenants: (Tenant & { users: { count: number }[] })[]
}

export function TenantTable({ tenants }: TenantTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Kullanıcılar</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Oluşturulma</TableHead>
          <TableHead className="w-[100px]">İşlemler</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants?.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell className="font-medium">{tenant.name}</TableCell>
            <TableCell className="font-mono text-sm">{tenant.slug}</TableCell>
            <TableCell>
              <Badge variant="outline">{tenant.plan}</Badge>
            </TableCell>
            <TableCell>{tenant.users?.[0]?.count ?? 0}</TableCell>
            <TableCell>
              <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                {tenant.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(tenant.created_at).toLocaleDateString('tr-TR')}
            </TableCell>
            <TableCell>
              <form action={toggleTenantStatusAction.bind(null, tenant.id, !tenant.is_active)}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className={tenant.is_active ? 'text-red-600' : 'text-green-600'}
                >
                  {tenant.is_active ? 'Pasife Al' : 'Aktife Al'}
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}