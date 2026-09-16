import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal, Download, Plus, X } from 'lucide-react'
import type { Category, Entry } from './types'
import { api, download } from './api'
import { Busy, Empty, ErrorBox } from './components'
import { message, money } from './utils'
import { TransactionTable } from './TransactionTable'

export default function Transactions({
  categories,
  onEdit,
  onAdd,
  revision,
}: {
  categories: Category[]
  onEdit: (entry: Entry) => void
  onAdd: () => void
  revision: number
}) {
  const [filters, setFilters] = useState({
    merchant: '',
    category_id: '',
    start: '',
    end: '',
    minimum: '',
    maximum: '',
    kind: '',
  })
  const [advanced, setAdvanced] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [reload, setReload] = useState(0)
  const [page, setPage] = useState(1)
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
  const invalid =
    filters.start && filters.end && filters.start > filters.end
      ? 'Start date must be before the end date.'
      : filters.minimum && filters.maximum && Number(filters.minimum) > Number(filters.maximum)
        ? 'Minimum amount must not exceed maximum amount.'
        : ''
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      if (invalid) {
        setEntries([])
        setError(invalid)
        setLoading(false)
        return
      }
      setError('')
      api<Entry[]>(`/transactions?${query}`)
        .then((data) => {
          if (!cancelled) {
            setEntries(data)
            setPage(1)
          }
        })
        .catch((e) => {
          if (!cancelled) setError(message(e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, revision, invalid, reload])
  async function exportFile(format: 'csv' | 'xlsx') {
    setExporting(true)
    setError('')
    try {
      await download(`/transactions/export/${format}?${query}`, `slipsnap-transactions.${format}`)
    } catch (e) {
      setError(message(e))
    } finally {
      setExporting(false)
    }
  }
  const update = (key: keyof typeof filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }))
  const total = entries.reduce(
    (sum, entry) => sum + (entry.kind === 'income' ? 1 : -1) * Number(entry.amount),
    0,
  )
  return (
    <section className="card transactions-card">
      <div className="section-heading">
        <div>
          <h2>Every little moment, accounted for.</h2>
          <p>Find, review, and make sense of your everyday spending.</p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} />
          Add transaction
        </button>
      </div>
      <div className="filter-bar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search merchants"
            placeholder="Search a merchant or description…"
            value={filters.merchant}
            onChange={(e) => update('merchant', e.target.value)}
          />
        </div>
        <select
          aria-label="Filter category"
          value={filters.category_id}
          onChange={(e) => update('category_id', e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className={`button secondary ${advanced ? 'selected' : ''}`}
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>
      {advanced && (
        <div className="advanced-filters">
          <label>
            From date
            <input
              type="date"
              value={filters.start}
              onChange={(e) => update('start', e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={filters.end}
              onChange={(e) => update('end', e.target.value)}
            />
          </label>
          <label>
            Minimum (THB)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={filters.minimum}
              onChange={(e) => update('minimum', e.target.value)}
            />
          </label>
          <label>
            Maximum (THB)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="No limit"
              value={filters.maximum}
              onChange={(e) => update('maximum', e.target.value)}
            />
          </label>
          <label>
            Type
            <select value={filters.kind} onChange={(e) => update('kind', e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
        </div>
      )}
      <div className="results-bar">
        <span>
          <span>
            {loading
              ? 'Finding your moments…'
              : `${entries.length} transaction${entries.length === 1 ? '' : 's'}`}
          </span>
          {!!query && (
            <button
              className="text-button"
              onClick={() =>
                setFilters({
                  merchant: '',
                  category_id: '',
                  start: '',
                  end: '',
                  minimum: '',
                  maximum: '',
                  kind: '',
                })
              }
            >
              <X size={13} />
              Clear filters
            </button>
          )}
        </span>
        <div className="export-buttons">
          <Download size={15} />
          <button disabled={loading || exporting || !!invalid} onClick={() => exportFile('csv')}>
            CSV
          </button>
          <i />
          <button disabled={loading || exporting || !!invalid} onClick={() => exportFile('xlsx')}>
            Excel
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Busy />
      ) : error ? (
        <button className="button secondary" onClick={() => setReload((r) => r + 1)}>
          Try again
        </button>
      ) : entries.length ? (
        <TransactionTable
          entries={entries.slice((page - 1) * 10, page * 10)}
          categories={categories}
          onEdit={onEdit}
        />
      ) : (
        <Empty
          title={query ? 'No moments found' : 'Your story starts with one entry'}
          text={
            query
              ? 'Try a different search or give your filters a little more room.'
              : 'Add an income or expense, or scan your first receipt.'
          }
          action={
            !query && (
              <button className="text-button" onClick={onAdd}>
                <Plus size={16} />
                Add your first transaction
              </button>
            )
          }
        />
      )}
      <div className="table-footer">
        <span>
          Net of matching transactions <strong>{money(total)}</strong>
        </span>
        <div>
          <button
            className="button secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil(entries.length / 10))}
          </span>
          <button
            className="button secondary"
            disabled={page * 10 >= entries.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
