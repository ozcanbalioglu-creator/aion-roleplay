import styles from './report.module.css'

interface TrendItem {
  date: string | null
  score: number
}

interface ReflectionSectionProps {
  managerInsight: string
  /**
   * Aynı persona ile yapılmış son seansların skor geçmişi.
   * En az 2 puan varsa son seans ile bir önceki arasındaki delta gösterilir.
   */
  trend: TrendItem[]
}

/**
 * Layer 5 — Yansıma Şeridi.
 * 2 kolon: Liderlik İçgörüsü + Bu Persona İle Trend.
 *
 * Not: `coaching_note` Hero narrative'ında zaten kullanılıyor — burada tekrar
 * göstermek duplikasyon yaratıyordu. Bu yüzden bu komponent yalnızca
 * manager_insight ve trend ile ilgilenir.
 */
export function ReflectionSection({ managerInsight, trend }: ReflectionSectionProps) {
  const hasManagerInsight = managerInsight.trim().length > 0
  const trendDeltas = computeTrendDeltas(trend)

  if (!hasManagerInsight && trendDeltas.length === 0) {
    return null
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={`${styles.caps} ${styles.muted}`}>Yansıma</span>
        <h2 className={styles.serif}>
          Rakamların ötesinde — <em>içgörü.</em>
        </h2>
      </div>

      <div className={`${styles.reflectionCard} ${styles.reflectionCardTwoCol}`}>
        <div className={styles.reflBlock}>
          <div className={styles.reflLabel}>Liderlik İçgörüsü</div>
          <p className={styles.reflText}>
            {hasManagerInsight ? (
              <span dangerouslySetInnerHTML={{ __html: emphasizeFirstClause(managerInsight) }} />
            ) : (
              <em>Bu seans için bir yönetici içgörüsü hazırlanamadı.</em>
            )}
          </p>
        </div>

        <div className={styles.reflBlock}>
          <div className={styles.reflLabel}>Bu Persona İle Trend</div>
          {trendDeltas.length === 0 ? (
            <p className={styles.reflText}>
              <em>Bu persona ile ilk seansınız — trend için en az 2 seans gerekiyor.</em>
            </p>
          ) : (
            <div>
              {trendDeltas.map((t) => (
                <div key={t.label} className={styles.trendRow}>
                  <span className={styles.trendName}>{t.label}</span>
                  <span
                    className={`${styles.trendDelta} ${
                      t.delta > 0
                        ? styles.trendUp
                        : t.delta < 0
                        ? styles.trendDown
                        : styles.trendStable
                    }`}
                  >
                    {t.delta > 0 ? '+' : ''}
                    {t.delta.toFixed(1)} {t.delta > 0 ? '↑' : t.delta < 0 ? '↓' : '→'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * İlk virgül veya nokta öncesi cümle parçasını <em> ile işaretler.
 * "Sen, danışanın ..." → "<em>Sen, danışanın ...</em>"
 * Tasarımda hero/reflection metinlerindeki vurgu efektini yakalar.
 */
function emphasizeFirstClause(text: string): string {
  const escaped = escapeHtml(text)
  const m = escaped.match(/^([^,.]{4,}?[,.])(\s+[\s\S]*)$/)
  if (!m) return escaped
  return `<em>${m[1]}</em>${m[2]}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Son seans (bu seans) ile bir önceki arasındaki delta'yı hesaplar.
 */
function computeTrendDeltas(trend: TrendItem[]): { label: string; delta: number }[] {
  if (trend.length < 2) return []
  const tail = trend.slice(-6)
  const result: { label: string; delta: number }[] = []
  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1]
    const cur = tail[i]
    const dateLabel = cur.date
      ? new Date(cur.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      : `Seans ${i}`
    result.push({
      label: dateLabel,
      delta: cur.score - prev.score,
    })
  }
  return result.slice(-5)
}
