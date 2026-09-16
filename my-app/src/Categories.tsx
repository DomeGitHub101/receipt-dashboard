import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Category } from './types'
import { api } from './api'
import { ErrorBox, Modal } from './components'
import { message } from './utils'

export default function Categories({
  categories,
  onChange,
  notify,
}: {
  categories: Category[]
  onChange: () => Promise<void>
  notify: (text: string) => void
}) {
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(e.currentTarget)
    try {
      await api(editing?.id ? `/categories/${editing.id}` : '/categories', {
        method: editing?.id ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.get('name'), color: form.get('color') }),
      })
      await onChange()
      setEditing(null)
      notify('Category saved. A place for everything.')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deleting) return
    setBusy(true)
    setError('')
    try {
      await api(`/categories/${deleting.id}`, { method: 'DELETE' })
      await onChange()
      setDeleting(null)
      notify('Category deleted.')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="category-intro">
        <div>
          <h2>A place for every little thing.</h2>
          <p>Make your categories feel like you. Rename them, pick a color, or start fresh.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError('')
            setEditing({})
          }}
        >
          <Plus size={17} />
          New category
        </button>
      </div>
      <div className="category-grid">
        {categories.map((c) => (
          <article key={c.id} className="card category-manage">
            <span className="category-icon" style={{ background: `${c.color}18`, color: c.color }}>
              <Tag size={23} />
            </span>
            <h3>{c.name}</h3>
            <div>
              <button
                className="icon-button"
                aria-label={`Edit ${c.name}`}
                onClick={() => {
                  setError('')
                  setEditing(c)
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label={`Delete ${c.name}`}
                onClick={() => {
                  setError('')
                  setDeleting(c)
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'Edit category' : 'A new category'}
          onClose={() => {
            if (!busy) setEditing(null)
          }}
        >
          <form onSubmit={save} className="entry-form">
            <ErrorBox error={error} />
            <label>
              Category name
              <input
                name="name"
                required
                maxLength={60}
                defaultValue={editing.name || ''}
                placeholder="e.g. Weekend adventures"
              />
            </label>
            <label>
              Make it your color
              <input
                className="color-input"
                type="color"
                name="color"
                defaultValue={editing.color || '#00704a'}
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save category'}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this category?"
          onClose={() => {
            if (!busy) setDeleting(null)
          }}
        >
          <p className="modal-description">
            “{deleting.name}” will be removed. Categories with existing transactions must be emptied
            first.
          </p>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>
              Keep it
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? 'Deleting…' : 'Delete category'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
