const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: '[E-posta]' },
  { re: /\b0?[5][0-9]{9}\b/g, label: '[Telefon]' },
  { re: /\b[1-9][0-9]{10}\b/g, label: '[TC No]' },
  { re: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, label: '[Kart No]' },
]

export function maskPII(text: string): string {
  let result = text
  for (const { re, label } of PATTERNS) {
    result = result.replace(re, label)
  }
  return result
}
