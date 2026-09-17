import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { X, ReceiptText, ArrowUpRight, LoaderCircle, Plus, Trash2, Download } from 'lucide-react'
import type { Category, Entry, EntryInput } from './types'
import { download } from './api'
import { today, message } from './utils'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'light' : ''}`}>
      <span className="brand-mark">
        <ReceiptText size={23} />
      </span>
      <span>
        slip<span className="brand-soft">snap</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  )
}

export function Busy({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="busy" role="status">
      <LoaderCircle className="spin" size={23} />
      {text}
    </div>
  )
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="error-box">
      {error}
    </div>
  ) : null
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ReceiptText size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current!
    el.showModal()
    return () => el.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content">
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function EntryForm({
  categories,
  initial,
  onSave,
  onCancel,
}: {
  categories: Category[]
  initial?: Partial<Entry>
  onSave: (data: EntryInput) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState<EntryInput>({
    merchant: '',
    date: today(),
    amount: '',
    kind: 'expense',
    category_id: categories[0]?.id || '',
    receipt_id: null,
    notes: '',
    line_items: [],
    source: 'manual',
    reference_code: null,
    ...initial,
  })
  const [busy, setBusy] = useState(false)
  const isTransfer = form.source === 'bank_transfer'
  const [error, setError] = useState('')
  const update = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(form)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <ErrorBox error={error} />
      {isTransfer ? <div className="notice">สลิปโอนเงินออก · บันทึกเป็นรายจ่าย</div> : <div className="segmented" aria-label="Transaction type">
        {(['expense', 'income'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={form.kind === kind}
            className={form.kind === kind ? 'active' : ''}
            onClick={() => update('kind', kind)}
          >
            {kind === 'expense' ? '↗ Expense' : '↙ Income'}
          </button>
        ))}
      </div>}
      {!isTransfer && <label>
        Merchant / description
        <input
          required
          maxLength={160}
          placeholder="e.g. Your neighborhood café"
          value={form.merchant}
          onChange={(e) => update('merchant', e.target.value)}
        />
      </label>}
      <div className="form-grid">
        <label>
          {isTransfer ? 'จำนวนเงินที่โอนออก (บาท)' : 'Amount (THB)'}
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            max="999999999999.99"
            step="0.01"
            required
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </label>
        <label>
          {isTransfer ? 'วันที่โอน (วัน/เดือน/ปี)' : 'Date'}
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
          />
        </label>
      </div>
      {isTransfer && <>
        {form.date && <p className="transfer-date">{new Date(`${form.date}T12:00:00`).toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})}</p>}
        <label>รหัสอ้างอิง
          <input required minLength={8} maxLength={80} pattern="[A-Za-z0-9]+" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="รหัสอ้างอิงตามสลิป" value={form.reference_code || ''} onChange={e => update('reference_code', e.target.value)} />
        </label>
      </>}
      <label>
        Category
        <select
          aria-label="Category"
          required
          value={form.category_id}
          onChange={(e) => update('category_id', e.target.value)}
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notes <span className="optional">optional</span>
        <textarea
          maxLength={2000}
          rows={2}
          placeholder="A little detail for later…"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>
      {!isTransfer && <details className="line-items" open={form.line_items.length > 0}>
        <summary>Line items ({form.line_items.length})</summary>
        {form.line_items.map((item, index) => (
          <div className="line-item" key={index}>
            <input
              aria-label={`Item ${index + 1} name`}
              required
              maxLength={200}
              value={item.name}
              onChange={(e) =>
                update(
                  'line_items',
                  form.line_items.map((v, i) => (i === index ? { ...v, name: e.target.value } : v)),
                )
              }
            />
            <input
              aria-label={`Item ${index + 1} amount`}
              type="number"
              min="0"
              step="0.01"
              required
              value={item.amount}
              onChange={(e) =>
                update(
                  'line_items',
                  form.line_items.map((v, i) =>
                    i === index ? { ...v, amount: e.target.value } : v,
                  ),
                )
              }
            />
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove item ${index + 1}`}
              onClick={() =>
                update(
                  'line_items',
                  form.line_items.filter((_, i) => i !== index),
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() => update('line_items', [...form.line_items, { name: '', amount: '' }])}
        >
          <Plus size={15} />
          Add line item
        </button>
      </details>}
      {form.receipt_id && (
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            try {
              await download(`/receipts/${form.receipt_id}/file`)
            } catch (e) {
              setError(message(e))
            }
          }}
        >
          <Download size={16} />
          {isTransfer ? 'ดาวน์โหลดสลิปต้นฉบับ' : 'Download original receipt'}
        </button>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="button primary" disabled={busy || !categories.length}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowUpRight size={17} />}
          {busy ? 'Saving…' : isTransfer ? 'บันทึกเงินโอนออก' : 'Save transaction'}
        </button>
      </div>
    </form>
  )
}
