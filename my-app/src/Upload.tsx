import { useEffect, useRef, useState } from 'react'
import {
  UploadCloud,
  Camera,
  FileImage,
  Check,
  ScanLine,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { api } from './api'
import { Busy, EntryForm, ErrorBox } from './components'
import { message, today } from './utils'
import type { Category, EntryInput, Scan } from './types'

export default function Upload({
  categories,
  onSaved,
}: {
  categories: Category[]
  onSaved: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [scan, setScan] = useState<Scan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [saved, setSaved] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  async function process(selected: File | undefined) {
    if (!selected || busy) return
    setError('')
    setScan(null)
    setSaved(false)
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(selected.type)) {
      setError('Please choose a JPG, PNG or PDF file.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('That file is a little large. The maximum size is 10 MB.')
      return
    }
    setFile(selected)
    setBusy(true)
    const data = new FormData()
    data.append('file', selected)
    try {
      setScan(await api<Scan>('/receipts/upload', { method: 'POST', body: data }))
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  function reset() {
    setFile(null)
    setScan(null)
    setSaved(false)
    setError('')
    if (input.current) input.current.value = ''
    if (camera.current) camera.current.value = ''
  }
  async function save(data: EntryInput) {
    await api('/transactions', { method: 'POST', body: JSON.stringify(data) })
    setSaved(true)
  }
  return (
    <>
      <div className="scan-steps">
        {['Upload a receipt', 'Review the details', 'All tucked away'].map((step, index) => (
          <div key={step} className={(saved ? 2 : scan ? 1 : 0) >= index ? 'active' : ''}>
            <span>
              {(saved ? 2 : scan ? 1 : 0) > index ? <Check size={16} /> : `0${index + 1}`}
            </span>
            {step}
            {index < 2 && <i />}
          </div>
        ))}
      </div>
      {saved ? (
        <section className="card saved-state">
          <span className="saved-check">
            <Check size={34} />
          </span>
          <span className="eyebrow">ONE LESS THING TO REMEMBER</span>
          <h2>All tucked away.</h2>
          <p>Your receipt and transaction are saved. A little more clarity, just like that.</p>
          <div>
            <button className="button secondary" onClick={reset}>
              <ScanLine size={17} />
              Scan another
            </button>
            <button className="button primary" onClick={onSaved}>
              See my transactions
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      ) : (
        <div className="upload-grid">
          <section className="card upload-card">
            <div className="section-heading">
              <div>
                <h2>A receipt, a little clarity.</h2>
                <p>We’ll read it. You give it a quick once-over.</p>
              </div>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="sr-only"
              aria-label="Upload receipt file"
              onChange={(e) => process(e.target.files?.[0])}
              disabled={busy}
            />
            <input
              ref={camera}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="sr-only"
              aria-label="Take receipt photo"
              onChange={(e) => process(e.target.files?.[0])}
              disabled={busy}
            />
            <ErrorBox error={error} />
            {file ? (
              <div className="receipt-preview">
                {file.type === 'application/pdf' ? (
                  <div className="pdf-preview">
                    <FileImage size={48} />
                    <strong>{file.name}</strong>
                    <p>PDF receipt · {(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <img src={preview} alt="Your uploaded receipt" />
                )}
                <div className="preview-footer">
                  <span title={file.name}>{file.name}</span>
                  <button disabled={busy} className="text-button" onClick={reset}>
                    <RotateCcw size={15} />
                    Start over
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`dropzone ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  process(e.dataTransfer.files[0])
                }}
              >
                <span className="upload-icon">
                  <UploadCloud size={32} />
                </span>
                <h3>Drop your receipt right here</h3>
                <p>or choose a file from your device</p>
                <button className="button primary" onClick={() => input.current?.click()}>
                  Choose a receipt
                  <ArrowRight size={17} />
                </button>
                <small>JPG, PNG or PDF · Up to 10 MB · 5 PDF pages</small>
              </div>
            )}
            <button
              disabled={busy}
              className="button secondary camera-button"
              onClick={() => camera.current?.click()}
            >
              <Camera size={18} />
              Take a photo
            </button>
            <div className="upload-tip">
              <span className="tip-bulb">✦</span>
              <div>
                <strong>A little tip for a better scan</strong>
                <p>
                  Lay your receipt flat, find good light, and get all four corners in the frame.
                </p>
              </div>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={16} />
              Only your account can access this receipt.
            </div>
          </section>
          <section className="card review-card">
            <div className="section-heading">
              <div>
                <h2>The little details</h2>
                <p>Check everything looks right before saving.</p>
              </div>
              <span className="small-tag">{scan ? 'Ready to review' : 'Awaiting receipt'}</span>
            </div>
            {busy ? (
              <div className="scanning-state">
                <Busy text="Reading your receipt…" />
                <p>This can take a moment, especially for multi-page PDFs.</p>
              </div>
            ) : scan ? (
              <>
                <div className="notice">
                  <Check size={17} />
                  <span>{scan.warning}</span>
                </div>
                <EntryForm
                  key={scan.receipt_id}
                  categories={categories}
                  initial={{
                    merchant: scan.merchant,
                    date: scan.date || today(),
                    amount: scan.amount ?? '',
                    receipt_id: scan.receipt_id,
                    line_items: scan.line_items,
                  }}
                  onSave={save}
                />
                <details className="raw-text">
                  <summary>View original OCR text</summary>
                  <pre>{scan.raw_text || 'No text was detected.'}</pre>
                </details>
              </>
            ) : (
              <div className="review-placeholder">
                <ScanLine size={45} />
                <h3>We’ll fill in the blanks.</h3>
                <p>
                  Upload a receipt and its merchant, date, total, and available items will appear
                  here.
                </p>
                <div className="skeleton-field" />
                <div className="skeleton-field short" />
                <div className="skeleton-field" />
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
