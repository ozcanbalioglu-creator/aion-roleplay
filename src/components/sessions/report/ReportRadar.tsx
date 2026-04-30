'use client'

import { useMemo } from 'react'
import styles from './report.module.css'
import { getScoreColor, shortDimName, type ReportDimension } from './report-utils'

interface ReportRadarProps {
  dimensions: ReportDimension[]
  overallAverage: number
  onJump?: (dimensionCode: string) => void
}

const RADAR_SIZE = 320
const RADAR_R = 120
const CX = RADAR_SIZE / 2
const CY = RADAR_SIZE / 2

export function ReportRadar({ dimensions, overallAverage, onJump }: ReportRadarProps) {
  const sortedByOrder = useMemo(
    () => [...dimensions].sort((a, b) => a.sort_order - b.sort_order),
    [dimensions],
  )
  const sortedByScore = useMemo(
    () => [...dimensions].sort((a, b) => b.score - a.score),
    [dimensions],
  )

  const n = sortedByOrder.length
  if (n < 3) {
    // Radar için en az 3 nokta lazım — çok az boyut varsa basit liste döndür
    return (
      <div className={styles.radarGrid}>
        <div className={styles.radarWrap}>
          <p className={styles.dimEmpty}>Radar grafiği için yeterli boyut yok.</p>
        </div>
        <div>
          <Legend dimensions={sortedByScore} onJump={onJump} />
        </div>
      </div>
    )
  }

  // SVG path hesaplamaları
  const angle = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const point = (i: number, score: number) => {
    const r = (Math.max(0, Math.min(5, score)) / 5) * RADAR_R
    const a = angle(i)
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  }

  const gridPolygon = (s: number) =>
    sortedByOrder
      .map((_, i) => {
        const r = (s / 5) * RADAR_R
        const a = angle(i)
        return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`
      })
      .join(' ')

  const dataPts = sortedByOrder.map((d, i) => point(i, d.score))
  const dataStr = dataPts.map((p) => `${p.x},${p.y}`).join(' ')

  const best = sortedByScore[0]
  const worst = sortedByScore[sortedByScore.length - 1]

  return (
    <div className={styles.radarGrid}>
      <div className={styles.radarWrap}>
        <svg
          className={styles.radarSvg}
          viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          role="img"
          aria-label={`${n} boyut radar grafiği`}
        >
          <title>Boyut Skorları Radar Grafiği</title>

          {/* Grid halkaları (1, 3, 5) */}
          {[1, 3, 5].map((s) => (
            <g key={s}>
              <polygon
                points={gridPolygon(s)}
                fill="none"
                stroke="rgba(26,26,46,0.08)"
                strokeWidth="1"
              />
              <text
                x={CX + ((s / 5) * RADAR_R) * Math.cos(-Math.PI / 2) + 5}
                y={CY + ((s / 5) * RADAR_R) * Math.sin(-Math.PI / 2) - 3}
                fontSize="8"
                fill="rgba(26,26,46,0.3)"
              >
                {s}
              </text>
            </g>
          ))}

          {/* Eksen çizgileri */}
          {sortedByOrder.map((_, i) => {
            const a = angle(i)
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={CX + RADAR_R * Math.cos(a)}
                y2={CY + RADAR_R * Math.sin(a)}
                stroke="rgba(26,26,46,0.07)"
                strokeWidth="1"
              />
            )
          })}

          {/* Veri poligonu */}
          <polygon
            points={dataStr}
            fill="rgba(157,107,223,0.15)"
            stroke="#9D6BDF"
            strokeWidth="1.5"
          />

          {/* Veri noktaları */}
          {dataPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#9D6BDF" opacity="0.85" />
          ))}

          {/* Etiketler */}
          {sortedByOrder.map((d, i) => {
            const a = angle(i)
            const lr = RADAR_R + 22
            const x = CX + lr * Math.cos(a)
            const y = CY + lr * Math.sin(a)
            const anchor =
              Math.cos(a) > 0.1 ? 'start' : Math.cos(a) < -0.1 ? 'end' : 'middle'
            return (
              <text
                key={i}
                x={x}
                y={y}
                fontSize="8.5"
                fill="rgba(26,26,46,0.6)"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {shortDimName(d.name, d.code)}
              </text>
            )
          })}
        </svg>
      </div>

      <div>
        <div className={`${styles.caps} ${styles.muted}`} style={{ marginBottom: '1rem' }}>
          Boyut Skorları
        </div>
        <Legend dimensions={sortedByScore} onJump={onJump} />
        <div className={styles.radarStats}>
          {best && (
            <div className={styles.rstat}>
              <strong>
                {shortDimName(best.name, best.code)} · {best.score.toFixed(1)}/5
              </strong>
              En Güçlü
            </div>
          )}
          {worst && (
            <div className={styles.rstat}>
              <strong>
                {shortDimName(worst.name, worst.code)} · {worst.score.toFixed(1)}/5
              </strong>
              En Zayıf
            </div>
          )}
          <div className={styles.rstat}>
            <strong>{overallAverage.toFixed(1)} / 5</strong>
            Ortalama
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({
  dimensions,
  onJump,
}: {
  dimensions: ReportDimension[]
  onJump?: (code: string) => void
}) {
  return (
    <div className={styles.radarLegend}>
      {dimensions.map((d) => {
        const color = getScoreColor(d.score)
        return (
          <button
            key={d.code}
            type="button"
            className={styles.legendItem}
            onClick={() => onJump?.(d.code)}
            aria-label={`${d.name}: ${d.score.toFixed(1)} üzerinden 5`}
          >
            <span className={styles.legendLeft}>
              <span className={styles.legendDot} style={{ background: color }} />
              <span className={styles.legendName}>{d.name}</span>
            </span>
            <span className={styles.legendScore} style={{ color }}>
              {d.score.toFixed(1)}/5
            </span>
          </button>
        )
      })}
    </div>
  )
}
