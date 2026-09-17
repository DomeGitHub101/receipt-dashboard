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
import { message } from './utils'
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
        {['อัปโหลดสลิป SCB', 'ตรวจข้อมูลการโอน', 'บันทึกเงินออก'].map((step, index) => (
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
          <p>บันทึกวันที่ จำนวนเงินที่โอนออก และรหัสอ้างอิงแล้ว</p>
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
                <h2>อ่านสลิปโอนเงิน SCB</h2>
                <p>รองรับสลิปโอนเงิน จ่ายเงิน และเติมเงิน ครั้งละหนึ่งรายการ</p>
              </div>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="sr-only"
              aria-label="Upload bank slip file"
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
                    <p>PDF bank slip · {(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <img src={preview} alt="สลิปโอนเงินที่อัปโหลด" />
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
                <h3>วางสลิปโอนเงินที่นี่</h3>
                <p>หรือเลือกรูปสลิปที่บันทึกจาก SCB EASY</p>
                <button className="button primary" onClick={() => input.current?.click()}>
                  เลือกสลิปโอนเงิน
                  <ArrowRight size={17} />
                </button>
                <small>JPG, PNG หรือ PDF · สูงสุด 10 MB · PDF 1 หน้า</small>
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
                <strong>ให้เห็นวันที่ ยอดเงิน และ QR ชัดเจน</strong>
                <p>
                  ใช้รูปสลิปต้นฉบับ ไม่ตัดขอบ QR เพื่อช่วยอ่านรหัสอ้างอิงให้ตรงทุกตัว
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
                <h2>ข้อมูลการโอนออก</h2>
                <p>ตรวจวันที่ จำนวนเงิน และรหัสอ้างอิงก่อนบันทึก</p>
              </div>
              <span className="small-tag">{scan ? 'Ready to review' : 'Awaiting receipt'}</span>
            </div>
            {busy ? (
              <div className="scanning-state">
                <Busy text="กำลังอ่านสลิปและ QR…" />
                <p>ระบบอ่านข้อความและ QR ภายในเครื่อง</p>
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
                    date: scan.date || '',
                    amount: scan.amount ?? '',
                    receipt_id: scan.receipt_id,
                    line_items: scan.line_items,
                    reference_code: scan.reference_code,
                    source: 'bank_transfer',
                    kind: 'expense',
                    category_id: categories.find(c => c.name === 'Other')?.id || categories[0]?.id || '',
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
                <h3>ข้อมูลจากสลิปจะปรากฏที่นี่</h3>
                <p>
                  วันที่และเดือนปีที่โอน จำนวนเงินที่โอนออก และรหัสอ้างอิง พร้อมแก้ไขก่อนบันทึก
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
