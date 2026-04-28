import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, Server, Key, Zap, Flag } from 'lucide-react'

export const dynamic = 'force-dynamic'

type CheckResult = true | string

function StatusBadge({ value }: { value: CheckResult | boolean }) {
  if (value === true) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10">OK</Badge>
  return <Badge variant="destructive" className="text-[10px]">HATA</Badge>
}

function EnvRow({ label, set }: { label: string; set: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      {set
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : <XCircle className="h-4 w-4 text-red-500" />
      }
    </div>
  )
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {enabled
        ? <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/40">Açık</Badge>
        : <Badge variant="outline" className="text-[10px] text-muted-foreground">Kapalı</Badge>
      }
    </div>
  )
}

export default async function AdminSystemPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') redirect('/dashboard')

  const supabase = await createServiceRoleClient()

  // Platform stats
  const [{ count: tenantCount }, { count: userCount }, { count: sessionCount }, { count: evalCount }] =
    await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*', { count: 'exact', head: true }),
      supabase.from('evaluations').select('*', { count: 'exact', head: true }),
    ])

  // Health checks
  const checks: Record<string, CheckResult> = {}

  try {
    const { error } = await supabase.from('tenants').select('count').limit(1)
    checks.supabase_db = error ? `Hata: ${error.message}` : true
  } catch (e) {
    checks.supabase_db = `Hata: ${e instanceof Error ? e.message : 'bilinmiyor'}`
  }

  const encKey = process.env.ENCRYPTION_KEY
  checks.encryption_key = encKey?.length === 64 ? true : 'ENCRYPTION_KEY 64 karakter değil'
  checks.openai_api = process.env.OPENAI_API_KEY ? true : 'OPENAI_API_KEY eksik'
  checks.elevenlabs_api = process.env.ELEVENLABS_API_KEY ? true : 'ELEVENLABS_API_KEY eksik'
  checks.qstash = process.env.UPSTASH_QSTASH_TOKEN ? true : 'UPSTASH_QSTASH_TOKEN eksik'
  checks.resend = process.env.RESEND_API_KEY ? true : 'RESEND_API_KEY eksik'

  const allOk = Object.values(checks).every((v) => v === true)

  const envProbe = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_DEBRIEF_COACH_VOICE_ID: !!process.env.ELEVENLABS_DEBRIEF_COACH_VOICE_ID,
    UPSTASH_QSTASH_TOKEN: !!process.env.UPSTASH_QSTASH_TOKEN,
    UPSTASH_QSTASH_CURRENT_SIGNING_KEY: !!process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY,
    UPSTASH_QSTASH_NEXT_SIGNING_KEY: !!process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_RECEIVER_URL: !!process.env.QSTASH_RECEIVER_URL,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
  }

  const featureFlags = {
    'Ses (Voice)': process.env.FEATURE_VOICE_ENABLED === 'true',
    'Gamification': process.env.FEATURE_GAMIFICATION_ENABLED === 'true',
    'Analytics': process.env.FEATURE_ANALYTICS_ENABLED === 'true',
    'Toplu Yükleme': process.env.FEATURE_BULK_UPLOAD_ENABLED === 'true',
    'İlerleme Sayfası': process.env.FEATURE_PROGRESS_PAGE_ENABLED === 'true',
    'Bildirimler': process.env.FEATURE_NOTIFICATIONS_PAGE_ENABLED === 'true',
    'Yönetici Sayfaları': process.env.FEATURE_MANAGER_PAGES_ENABLED === 'true',
  }

  const checkLabels: Record<string, string> = {
    supabase_db: 'Supabase DB',
    encryption_key: 'Şifreleme Anahtarı',
    openai_api: 'OpenAI API',
    elevenlabs_api: 'ElevenLabs API',
    qstash: 'Upstash QStash',
    resend: 'Resend E-posta',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-headline font-semibold">Sistem Durumu</h1>
            <p className="text-sm text-muted-foreground">
              {process.env.APP_ENV ?? 'development'} &middot; {new Date().toLocaleString('tr-TR')}
            </p>
          </div>
        </div>
        {allOk
          ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Tüm Sistemler Normal</Badge>
          : <Badge variant="destructive" className="gap-1.5"><AlertCircle className="h-3 w-3" /> Sorun Tespit Edildi</Badge>
        }
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tenant', value: tenantCount ?? 0 },
          { label: 'Kullanıcı', value: userCount ?? 0 },
          { label: 'Seans', value: sessionCount ?? 0 },
          { label: 'Değerlendirme', value: evalCount ?? 0 },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold">{value.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Health checks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Servis Sağlığı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {Object.entries(checks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{checkLabels[key] ?? key}</p>
                    {value !== true && (
                      <p className="text-[11px] text-red-500 mt-0.5 truncate">{value}</p>
                    )}
                  </div>
                  <StatusBadge value={value} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feature flags */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" />
              Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(featureFlags).map(([label, enabled]) => (
              <FeatureRow key={label} label={label} enabled={enabled} />
            ))}
          </CardContent>
        </Card>

        {/* Env probe */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Ortam Değişkenleri
              <span className="text-[10px] text-muted-foreground font-normal ml-1">(set/unset — değerler gizli)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8">
              {Object.entries(envProbe).map(([key, set]) => (
                <EnvRow key={key} label={key} set={set} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
