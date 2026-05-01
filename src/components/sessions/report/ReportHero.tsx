import styles from './report.module.css'
import { getStatusPill, type ReportDimension } from './report-utils'

interface ReportHeroProps {
  overallAverage: number
  personaName: string
  scenarioTitle: string
  formattedDate: string
  durationLabel: string
  narrative: string
  dimensions: ReportDimension[]
}

const STATUS_TO_CLASS: Record<string, string> = {
  critical: styles.statusCritical,
  developing: styles.statusDeveloping,
  growing: styles.statusGrowing,
  solid: styles.statusSolid,
  mastery: styles.statusMastery,
}

export function ReportHero({
  overallAverage,
  personaName,
  scenarioTitle,
  formattedDate,
  durationLabel,
  narrative,
  dimensions,
}: ReportHeroProps) {
  const status = getStatusPill(overallAverage)
  const statusClass = STATUS_TO_CLASS[status.band] ?? styles.statusGrowing

  return (
    <section className={styles.hero}>
      <div className={styles.heroGlow} />

      <div className={styles.heroMeta}>
        <span className={styles.heroMetaChip}>Seans Raporu</span>
        <span className={styles.heroMetaChip}>{formattedDate}</span>
        <span className={styles.heroMetaChip}>{durationLabel}</span>
        <span className={styles.heroMetaChip}>
          {personaName} · {scenarioTitle}
        </span>
      </div>

      <div className={styles.heroCenter}>
        <div className={styles.heroScoreWrap}>
          <div className={styles.heroScore}>
            {overallAverage.toFixed(1)}
            <span className={styles.heroScoreDenom}> / 5</span>
          </div>
          <div className={styles.heroStatus}>
            <span className={`${styles.pill} ${statusClass}`}>{status.label}</span>
          </div>
        </div>

        <div className={styles.heroNarrative}>
          <p>{narrative || 'Bu seans için ayrıntılı bir özet oluşturulamadı.'}</p>
        </div>
      </div>

      <div className={styles.heroDimsNote}>
        <div className={styles.dimsNoteItem}>
          <div className={styles.dimsNoteDot} />
          {dimensions.length > 0
            ? `${dimensions.length} ICF boyutu değerlendirildi`
            : 'Boyut değerlendirmesi henüz hazır değil'}
        </div>
        <div className={styles.dimsNoteItem}>
          <div className={styles.dimsNoteDot} />
          ICF Core Competencies 2019 standardı
        </div>
        <div className={styles.dimsNoteItem}>
          <div className={styles.dimsNoteDot} />
          Ortalama / 5 ölçeği
        </div>
      </div>
    </section>
  )
}
