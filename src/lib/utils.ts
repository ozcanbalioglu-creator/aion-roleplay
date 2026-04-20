export type ClassValue = string | boolean | null | undefined | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const result: string[] = []

  function process(val: ClassValue) {
    if (!val) return
    if (typeof val === 'string') {
      result.push(val)
    } else if (Array.isArray(val)) {
      val.forEach(process)
    }
  }

  inputs.forEach(process)
  return result.join(' ')
}
