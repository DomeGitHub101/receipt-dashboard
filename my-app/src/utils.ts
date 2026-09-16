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
