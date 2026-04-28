export function formatIdleTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} dakika ${s} saniye` : `${s} saniye`
}
