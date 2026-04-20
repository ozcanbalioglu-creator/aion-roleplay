'use client'

/**
 * DashboardCharts — Client Component
 *
 * next/dynamic ile ssr: false yalnızca Client Component'te kullanılabilir.
 * Bu dosya chart bileşenlerini lazy-import eder ve Server Component olan
 * dashboard/page.tsx tarafından tüketilir.
 */
import dynamic from 'next/dynamic'

const Skeleton = () => (
  <div className="h-[320px] bg-card/60 rounded-2xl animate-pulse border border-border/40" />
)

// ── Lazy chart bileşenleri ─────────────────────────────────────────────
export const ScoreTrendChartLazy = dynamic(
  () => import('./ScoreTrendChart').then((m) => m.ScoreTrendChart),
  { ssr: false, loading: () => <Skeleton /> }
)

export const DimensionRadarChartLazy = dynamic(
  () => import('./DimensionRadarChart').then((m) => m.DimensionRadarChart),
  { ssr: false, loading: () => <Skeleton /> }
)

export const PersonaScoreChartLazy = dynamic(
  () => import('./PersonaScoreChart').then((m) => m.PersonaScoreChart),
  { ssr: false, loading: () => <Skeleton /> }
)
