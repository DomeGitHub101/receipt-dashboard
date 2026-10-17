import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { X, ArrowUpRight, LoaderCircle, Plus, Trash2, Download } from 'lucide-react'
import type { Category, Entry, EntryInput } from './types'
import { download } from './api'
import { today, message, palTint } from './utils'

// The mascot: หมูตังค์, a piggy bank with a coin on its way in.
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="5.2" r="3.4" fill="#ffd166" stroke="#2a2f5a" strokeWidth="1.3" />
      <path d="M16 3.8v2.8" stroke="#c98a12" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M7.5 13 6 7.8l5 2.6Z" fill="#ff8fb1" stroke="#2a2f5a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M24.5 13 26 7.8l-5 2.6Z" fill="#ff8fb1" stroke="#2a2f5a" strokeWidth="1.3" strokeLinejoin="round" />
      <ellipse cx="11" cy="28" rx="2.4" ry="2" fill="#ff8fb1" stroke="#2a2f5a" strokeWidth="1.3" />
      <ellipse cx="21" cy="28" rx="2.4" ry="2" fill="#ff8fb1" stroke="#2a2f5a" strokeWidth="1.3" />
      <ellipse cx="16" cy="18.5" rx="12" ry="10" fill="#ffb3cb" stroke="#2a2f5a" strokeWidth="1.4" />
      <path d="M13.5 10h5" stroke="#2a2f5a" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="16" cy="21" rx="4" ry="2.9" fill="#ff8fb1" stroke="#2a2f5a" strokeWidth="1.2" />
      <ellipse cx="14.6" cy="21" rx=".8" ry="1.1" fill="#2a2f5a" />
      <ellipse cx="17.4" cy="21" rx=".8" ry="1.1" fill="#2a2f5a" />
      <circle cx="11.6" cy="16.6" r="1.3" fill="#2a2f5a" />
      <circle cx="20.4" cy="16.6" r="1.3" fill="#2a2f5a" />
      <circle cx="12" cy="16.2" r=".4" fill="#fff" />
      <circle cx="20.8" cy="16.2" r=".4" fill="#fff" />
      <ellipse cx="8.8" cy="19.6" rx="1.5" ry=".9" fill="#ff6ba7" opacity=".6" />
      <ellipse cx="23.2" cy="19.6" rx="1.5" ry=".9" fill="#ff6ba7" opacity=".6" />
    </svg>
  )
}

// Each category is a little character: its shape comes from the name, its tint from the category colour.
function hash(text: string) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
  return h >>> 0
}
const INK = '#2a2f5a'
const CREAM = '#fffaf3'
const BLUSH = '#ff8fb1'

// Eyes with a catchlight, a little "w" mouth and rosy cheeks, centred on (x, y).
function Face({ x = 40, y = 40, gap = 8 }: { x?: number; y?: number; gap?: number }) {
  return (
    <g>
      <ellipse cx={x - gap} cy={y} rx="2.9" ry="3.3" fill={INK} />
      <ellipse cx={x + gap} cy={y} rx="2.9" ry="3.3" fill={INK} />
      <circle cx={x - gap + 1} cy={y - 1.3} r="1" fill="#fff" />
      <circle cx={x + gap + 1} cy={y - 1.3} r="1" fill="#fff" />
      <path d={`M${x - 3} ${y + 4}q1.5 2 3 0q1.5 2 3 0`} fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={x - gap - 5} cy={y + 4.5} rx="3.6" ry="2.2" fill={BLUSH} opacity=".55" />
      <ellipse cx={x + gap + 5} cy={y + 4.5} rx="3.6" ry="2.2" fill={BLUSH} opacity=".55" />
    </g>
  )
}

// A chibi body shared by the upright pals: feet, a round tummy, stubby arms and a big head.
function Chibi({ body, deep, children, headY = 37 }: { body: string; deep: string; children?: ReactNode; headY?: number }) {
  return (
    <g>
      <ellipse cx="31" cy="73" rx="7" ry="4" fill={deep} />
      <ellipse cx="49" cy="73" rx="7" ry="4" fill={deep} />
      <ellipse cx="40" cy="60" rx="17" ry="14" fill={body} />
      <ellipse cx="40" cy="63" rx="10" ry="8" fill={CREAM} />
      <ellipse cx="23.5" cy="59" rx="4.5" ry="6.5" fill={body} transform="rotate(25 23.5 59)" />
      <ellipse cx="56.5" cy="59" rx="4.5" ry="6.5" fill={body} transform="rotate(-25 56.5 59)" />
      <ellipse cx="40" cy={headY} rx="22" ry="19" fill={body} />
      <ellipse cx="31" cy={headY - 9} rx="7" ry="4" fill="#fff" opacity=".35" transform={`rotate(-20 31 ${headY - 9})`} />
      {children}
    </g>
  )
}

type Look = { body: string; deep: string }
const PALS: ((look: Look) => ReactNode)[] = [
  // Bunny with a ribbon bow.
  ({ body, deep }) => (
    <>
      <ellipse cx="30" cy="15" rx="6" ry="14" fill={body} transform="rotate(-8 30 15)" />
      <ellipse cx="50" cy="15" rx="6" ry="14" fill={body} transform="rotate(8 50 15)" />
      <ellipse cx="30" cy="16" rx="2.8" ry="9" fill={BLUSH} opacity=".6" transform="rotate(-8 30 16)" />
      <ellipse cx="50" cy="16" rx="2.8" ry="9" fill={BLUSH} opacity=".6" transform="rotate(8 50 16)" />
      <Chibi body={body} deep={deep}>
        <Face y={39} />
        <path d="M40 53l-7-4v8Zm0 0 7-4v8Z" fill="#ff6ba7" />
        <circle cx="40" cy="53" r="2.4" fill="#e24d8b" />
      </Chibi>
    </>
  ),
  // Bear with a muzzle.
  ({ body, deep }) => (
    <>
      <circle cx="22" cy="22" r="8" fill={body} />
      <circle cx="58" cy="22" r="8" fill={body} />
      <circle cx="22" cy="22" r="4.2" fill={deep} />
      <circle cx="58" cy="22" r="4.2" fill={deep} />
      <Chibi body={body} deep={deep}>
        <ellipse cx="40" cy="45" rx="8" ry="6" fill={CREAM} />
        <Face y={38} gap={9} />
        <ellipse cx="40" cy="42.2" rx="2.4" ry="1.7" fill={INK} />
      </Chibi>
    </>
  ),
  // Chick: one round egg of a body, little wings, a beak and a tuft.
  ({ body, deep }) => (
    <>
      <path d="M37 13q1-7 4-1q3-6 4 1" fill="none" stroke={deep} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="74" rx="6" ry="3.5" fill="#f5a623" />
      <ellipse cx="48" cy="74" rx="6" ry="3.5" fill="#f5a623" />
      <ellipse cx="40" cy="46" rx="25" ry="27" fill={body} />
      <ellipse cx="31" cy="30" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 31 30)" />
      <ellipse cx="40" cy="57" rx="13" ry="11" fill={CREAM} />
      <ellipse cx="16" cy="51" rx="5" ry="9" fill={deep} transform="rotate(20 16 51)" />
      <ellipse cx="64" cy="51" rx="5" ry="9" fill={deep} transform="rotate(-20 64 51)" />
      <Face y={39} gap={9} />
      <path d="M36.5 45.5h7l-3.5 4Z" fill="#f5a623" />
    </>
  ),
  // Dino with back spikes and a tail.
  ({ body, deep }) => (
    <>
      <path d="M54 64q16 2 20-8q-4 14-20 16Z" fill={body} />
      <path d="m24 24 3-9 5 6 3-9 5 7 4-8 3 8 5-6 2 10Z" fill={deep} />
      <Chibi body={body} deep={deep}>
        <Face y={40} />
        <path d="M33 59l3-3 3 3 3-3 3 3 3-3" fill="none" stroke={deep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      </Chibi>
    </>
  ),
  // Cat with a curled tail and whiskers.
  ({ body, deep }) => (
    <>
      <path d="M55 68q14 0 12-14q-1-6 3-7" fill="none" stroke={body} strokeWidth="6" strokeLinecap="round" />
      <path d="M19 30 21 11l15 12Z" fill={body} />
      <path d="M61 30 59 11 44 23Z" fill={body} />
      <path d="M23 25.5 24 16l7 6Z" fill={BLUSH} opacity=".6" />
      <path d="M57 25.5 56 16l-7 6Z" fill={BLUSH} opacity=".6" />
      <Chibi body={body} deep={deep}>
        <path d="M30 38c-3 0-4 2-5 4M50 38c3 0 4 2 5 4" fill="none" stroke={deep} strokeWidth="3" strokeLinecap="round" opacity=".7" />
        <Face y={40} />
        <path d="M13 43h7M13 47l7-1.5M67 43h-7M67 47l-7-1.5" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
      </Chibi>
    </>
  ),
  // Whale with a spout.
  ({ body, deep }) => (
    <>
      <path d="M36 16q-4-7 0-11M40 16V3M44 16q4-7 0-11" fill="none" stroke="#7cc8f5" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 50q12-10 16-2q-6 2-8 8q-4-2-8-6Z" fill={deep} />
      <path d="M8 46c0-16 14-26 30-26s26 10 26 24c0 16-14 26-29 26S8 62 8 46Z" fill={body} />
      <ellipse cx="25" cy="31" rx="8" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 25 31)" />
      <path d="M13 54c6 9 15 13 24 13s19-5 24-13q-12 6-24 6t-24-6Z" fill={CREAM} />
      <ellipse cx="14" cy="57" rx="4" ry="6.5" fill={deep} transform="rotate(40 14 57)" />
      <Face x={34} y={44} />
    </>
  ),
]
export function Pal({ name, color, size = 64, resting = false }: { name: string; color: string; size?: number; resting?: boolean }) {
  const draw = PALS[hash(name) % PALS.length]
  return (
    <svg className={`pal ${resting ? 'resting' : ''}`} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      {draw({ body: palTint(color, 82), deep: palTint(color, 66) })}
    </svg>
  )
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'light' : ''}`}>
      <BrandMark />
      <span>
        หมู<span className="brand-soft">ตังค์</span>
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
        <Pal name={title} color="#b79cff" size={76} />
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
      {isTransfer ? (
        <div className="notice">สลิปโอนเงินออก · บันทึกเป็นรายจ่าย</div>
      ) : (
        <div className="segmented" aria-label="Transaction type">
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
        </div>
      )}
      {!isTransfer && (
        <label>
          Merchant / description
          <input
            required
            maxLength={160}
            placeholder="e.g. Your neighborhood café"
            value={form.merchant}
            onChange={(e) => update('merchant', e.target.value)}
          />
        </label>
      )}
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
      {isTransfer && (
        <>
          {form.date && (
            <p className="transfer-date">
              {new Date(`${form.date}T12:00:00`).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          <label>
            <span>รหัสอ้างอิง <span className="optional">· ไม่จำเป็นต้องกรอก</span></span>
            <input
              minLength={8}
              maxLength={80}
              pattern="[A-Za-z0-9]+"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="รหัสอ้างอิงตามสลิป (ถ้ามี)"
              value={form.reference_code || ''}
              onChange={(e) => update('reference_code', e.target.value)}
            />
          </label>
        </>
      )}
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
        <span>Notes <span className="optional">· optional</span></span>
        <textarea
          maxLength={2000}
          rows={2}
          placeholder="A little detail for later…"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>
      {!isTransfer && (
        <details className="line-items" open={form.line_items.length > 0}>
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
                    form.line_items.map((v, i) =>
                      i === index ? { ...v, name: e.target.value } : v,
                    ),
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
        </details>
      )}
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
