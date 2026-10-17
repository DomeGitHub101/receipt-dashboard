export const money = (value: number | string) =>
  new Intl.NumberFormat('en-TH', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
  }).format(Number(value))
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

// A pastel tint of a category colour at the given lightness; near-greys fall back to lilac.
export function palTint(color: string, lightness = 84) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (!Number.isFinite(max) || max - min < 0.08) return `hsl(258 45% ${lightness}%)`
  const d = max - min
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return `hsl(${Math.round(hue * 60 + 360) % 360} 72% ${lightness}%)`
}
