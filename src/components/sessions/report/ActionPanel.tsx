'use client'

import { useMemo } from 'react'
import styles from './report.module.css'
import { getScoreColor, type ReportDimension } from './report-utils'

interface ActionPanelProps {
  dimensions: ReportDimension[]
  onJump?: (dimensionCode: string) => void
}

/**
 * Layer 4 — Aksiyon Paneli (4 kart):
 *  - Güçlü Alanlar (skor ≥4, ilk 3)
 *  - Gelişim Alanları (skor ≤3, son 3)
 *  - Bir Sonraki Odak (en düşük puanlı boyutun improvement_tip + rationale)
 *  - Oturum Kontrol Listesi (is_required boyutlarda skor ≥3 → geçti)
 */
export function ActionPanel({ dimensions, onJump }: ActionPanelProps) {
  const { strong, growth, focus, required } = useMemo(() => {
    const sortedDesc = [...dimensions].sort((a, b) => b.score - a.score)
    const sortedAsc = [...dimensions].sort((a, b) => a.score - b.score)
    const strongList = sortedDesc.filter((d) => d.score >= 4).slice(0, 3)
    const growthList = sortedAsc.filter((d) => d.score < 3.5).slice(0, 3)
    const focusDim = sortedAsc[0] ?? null
    const requiredList = dimensions.filter((d) => d.is_required)
    return {
      strong: strongList,
      growth: growthList,
      focus: focusDim,
      required: requiredList,
    }
  }, [dimensions])

  const passed = required.filter((d) => d.score >= 3).length
  const passedPct = required.length > 0 ? Math.round((passed / required.length) * 100) : 0

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={`${styles.caps} ${styles.muted}`}>Aksiyon Paneli</span>
        <h2 className={styles.serif}>
          Güçlü, gelişim, odak — <em>net</em> olarak.
        </h2>
      </div>

      <div className={styles.actionGrid}>
        {/* Güçlü */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardLabel}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#4CAF82" strokeWidth="2">
              <polyline points="2,9 6,5 10,8 14,4" />
            </svg>
            Güçlü Alanlar
          </div>
          {strong.length === 0 ? (
            <p className={styles.actionEmpty}>Bu seansta 4/5 üstü boyut yok.</p>
          ) : (
            strong.map((d) => (
              <button
                key={d.code}
                type="button"
                className={styles.actionItem}
                onClick={() => onJump?.(d.code)}
              >
                <span className={styles.actionItemName}>{d.name}</span>
                <span className={styles.actionItemScore} style={{ color: getScoreColor(d.score) }}>
                  {d.score.toFixed(1)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Gelişim */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardLabel}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#E8A534" strokeWidth="2">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3" />
              <circle cx="8" cy="11" r="0.5" fill="#E8A534" />
            </svg>
            Gelişim Alanları
          </div>
          {growth.length === 0 ? (
            <p className={styles.actionEmpty}>Tüm boyutlar 3.5+ seviyede — mükemmel.</p>
          ) : (
            growth.map((d) => (
              <button
                key={d.code}
                type="button"
                className={styles.actionItem}
                onClick={() => onJump?.(d.code)}
              >
                <span className={styles.actionItemName}>{d.name}</span>
                <span className={styles.actionItemScore} style={{ color: getScoreColor(d.score) }}>
                  {d.score.toFixed(1)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Bir Sonraki Odak */}
        <div className={styles.actionCardFocus}>
          <div className={styles.actionCardLabel}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#B990F0" strokeWidth="2">
              <circle cx="8" cy="8" r="3" />
              <circle cx="8" cy="8" r="6.5" />
            </svg>
            Bir Sonraki Odak
          </div>
          {focus ? (
            <>
              <div className={styles.focusSentence}>
                <em>{focus.name}</em> alanında:{' '}
                {focus.improvement_tip || 'Bir sonraki seansa bu boyuta odaklanarak başla.'}
              </div>
              {focus.rationale && (
                <div className={styles.focusRationale}>
                  <strong>Neden: </strong>
                  {focus.rationale}
                </div>
              )}
            </>
          ) : (
            <div className={styles.focusSentence}>Bu seansda öncelik belirlemek için yeterli veri yok.</div>
          )}
        </div>

        {/* Kontrol Listesi */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardLabel}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="10" height="10" rx="2" />
              <path d="M6 8l2 2 4-4" />
            </svg>
            Oturum Kontrol Listesi
          </div>
          {required.length === 0 ? (
            <p className={styles.actionEmpty}>Bu rubric&apos;te zorunlu boyut yok.</p>
          ) : (
            <>
              {required.map((d) => (
                <div key={d.code} className={styles.checklistRow}>
                  <span
                    className={`${styles.checkIcon} ${d.score >= 3 ? styles.checkPass : styles.checkFail}`}
                  >
                    {d.score >= 3 ? (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#4CAF82" strokeWidth="2.5">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#D95F5F" strokeWidth="2.5">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    )}
                  </span>
                  <span className={styles.checkName}>{d.name}</span>
                </div>
              ))}
              <div className={styles.checklistSummary}>
                <strong>
                  {passed} / {required.length}
                </strong>{' '}
                maddenin uyumu sağlandı · %{passedPct}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
