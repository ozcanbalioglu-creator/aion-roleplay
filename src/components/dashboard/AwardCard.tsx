/**
 * AwardCard — Rozetler ve tamamlanmış görevler için ortak kart tasarımı.
 *
 * Site renk paleti:
 * - bg-surface-container-low (#F5F2FF) — açık lavanta zemin
 * - border-surface-container-highest/60 — yumuşak mor sınır
 * - text-amber-600 — tarih (gamification accent)
 * - bg-[#9D6BDF]/15 + text-[#2A0056] — DP pill (accent + primary)
 * - font-headline italic — açıklama (serif vurgu)
 */
interface AwardCardProps {
  icon: string
  name: string
  description: string
  date: string | null
  xpReward?: number | null
}

export function AwardCard({ icon, name, description, date, xpReward }: AwardCardProps) {
  const formattedDate = date
    ? new Date(date)
        .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
        .toUpperCase()
    : null

  return (
    <div className="group flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-surface-container-low border border-surface-container-highest/60 hover:border-[#9D6BDF]/40 hover:shadow-md hover:shadow-[#9D6BDF]/10 transition-all duration-300">
      {/* İkon */}
      <div className="text-5xl mt-2 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>

      {/* Ad + Açıklama */}
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground leading-tight">
          {name}
        </p>
        <p className="text-sm font-headline italic text-muted-foreground leading-snug">
          {description}
        </p>
      </div>

      {/* Tarih */}
      {formattedDate && (
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
          {formattedDate}
        </p>
      )}

      {/* DP ödülü pill (opsiyonel) */}
      {typeof xpReward === 'number' && xpReward > 0 && (
        <div className="mt-1 px-4 py-1.5 rounded-full bg-[#9D6BDF]/15 border border-[#9D6BDF]/15">
          <span className="text-xs font-bold text-[#2A0056]">
            +{xpReward} Deneyim Puanı
          </span>
        </div>
      )}
    </div>
  )
}
