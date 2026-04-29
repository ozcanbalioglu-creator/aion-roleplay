import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Supabase Free tier 7 gün hareketsiz kalınca DB'yi uyutuyor.
// Bu cron her gün küçük bir SELECT yaparak DB'yi aktif tutuyor.
// Vercel Cron tarafından çağrılır (vercel.json'da schedule tanımlı).
export async function GET(req: NextRequest) {
  // Vercel Cron auth: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabase = await createServiceRoleClient()
    const { count, error } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tenantCount: count,
    })
  } catch (err) {
    console.error('[keep-alive] Hata:', err)
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
