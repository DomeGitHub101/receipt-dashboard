export type User = { id: string; name: string; email: string }
export type Category = { id: string; name: string; color: string }
export type LineItem = { name: string; amount: string | number }
export type Entry = {
  id: string
  merchant: string
  date: string
  amount: string | number
  kind: 'income' | 'expense'
  category_id: string
  receipt_id: string | null
  notes: string
  line_items: LineItem[]
  source: 'manual' | 'receipt' | 'bank_transfer'
  reference_code: string | null
}
export type EntryInput = Omit<Entry, 'id'>
export type Scan = {
  receipt_id: string
  merchant: string
  date: string | null
  amount: string | number | null
  reference_code: string | null
  reference_source: 'qr' | 'ocr' | null
  source: 'bank_transfer'
  kind: 'expense'
  line_items: LineItem[]
  raw_text: string
  warning: string
}
export type Summary = {
  income: number
  expense: number
  balance: number
  count: number
  receipts: number
  categories: { name: string; color: string; amount: number }[]
  daily: { day: number; income: number; expense: number }[]
}
