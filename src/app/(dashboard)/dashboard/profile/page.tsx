import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProfileForm } from './ProfileForm'
import { getMyDevelopmentPlan } from '@/lib/queries/development-plan.queries'
import { DevelopmentPlanWidget } from '@/components/dashboard/DevelopmentPlanWidget'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const devPlan = await getMyDevelopmentPlan()

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-headline font-semibold">Profilim</h1>
        <p className="text-sm text-muted-foreground mt-1">Kişisel bilgilerinizi görüntüleyin ve güncelleyin.</p>
      </div>
      <ProfileForm user={user} />
      <DevelopmentPlanWidget plan={devPlan} />
    </div>
  )
}
