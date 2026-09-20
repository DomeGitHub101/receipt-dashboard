import { useEffect, useState } from 'react'
import { CheckCircle2, PiggyBank, Save, TriangleAlert } from 'lucide-react'
import { api } from './api'
import type { Budget } from './types'
import { Busy, ErrorBox } from './components'
import { message, money } from './utils'

function ratio(spent: number, amount: number) {
  if (!amount) return spent ? 100 : 0
  return Math.min((spent / amount) * 100, 100)
}

export default function Budgets({ month, revision, onSaved }: { month: string; revision: number; onSaved: () => void }) {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [total, setTotal] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api<Budget>(`/budgets/${month}`)
      .then((data) => {
        if (!active) return
        setBudget(data)
        setTotal(Number(data.amount) ? String(data.amount) : '')
        setAmounts(Object.fromEntries(data.categories.map((item) => [item.category_id, Number(item.amount) ? String(item.amount) : ''])))
      })
      .catch((e) => active && setError(message(e)))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [month, revision])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const categories = Object.entries(amounts)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([category_id, amount]) => ({ category_id, amount }))
      const data = await api<Budget>(`/budgets/${month}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: total || 0, categories }),
      })
      setBudget(data)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(message(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Busy text="Loading your budget…" />
  if (!budget) return <ErrorBox error={error} />
  const over = Number(budget.remaining) < 0
  return (
    <form className="budget-page" onSubmit={submit}>
      <ErrorBox error={error} />
      <section className={`budget-hero ${over ? 'over' : ''}`}>
        <div className="budget-hero-icon"><PiggyBank size={30} /></div>
        <div className="budget-hero-copy">
          <span className="eyebrow">MONTHLY SPENDING PLAN</span>
          <h2>{over ? `${money(Math.abs(Number(budget.remaining)))} over budget` : `${money(Number(budget.remaining))} remaining`}</h2>
          <p>{money(Number(budget.spent))} spent from a {money(Number(budget.amount))} monthly budget.</p>
          <div className="budget-track"><i style={{ width: `${ratio(Number(budget.spent), Number(budget.amount))}%` }} /></div>
        </div>
        <label className="budget-total">
          <span>Monthly budget</span>
          <div><span>฿</span><input aria-label="Monthly budget" type="number" min="0" step="0.01" value={total} placeholder="0.00" onChange={(e) => setTotal(e.target.value)} /></div>
        </label>
      </section>

      <section className="card budget-card">
        <div className="section-heading">
          <div><h2>Budgets by category</h2><p>Set limits where you want a little more control.</p></div>
          <span className="small-tag">{month}</span>
        </div>
        <div className="budget-list">
          {budget.categories.map((item) => {
            const limit = Number(amounts[item.category_id] || 0)
            const itemOver = limit > 0 && Number(item.spent) > limit
            return (
              <div className="budget-row" key={item.category_id}>
                <span className="budget-dot" style={{ background: item.color }} />
                <div className="budget-row-main">
                  <div><strong>{item.name}</strong><span>{money(Number(item.spent))} spent{limit ? ` of ${money(limit)}` : ''}</span></div>
                  <div className={`budget-track small ${itemOver ? 'over' : ''}`}><i style={{ width: `${ratio(Number(item.spent), limit)}%`, background: item.color }} /></div>
                </div>
                <label className="category-limit"><span>฿</span><input aria-label={`${item.name} budget`} type="number" min="0" step="0.01" value={amounts[item.category_id] || ''} placeholder="No limit" onChange={(e) => setAmounts((current) => ({ ...current, [item.category_id]: e.target.value }))} /></label>
                <span className={`budget-state ${itemOver ? 'over' : ''}`}>{itemOver ? <><TriangleAlert size={14} /> Over</> : limit ? `${money(Math.max(limit - Number(item.spent), 0))} left` : 'Not set'}</span>
              </div>
            )
          })}
        </div>
        <div className="budget-actions">
          {saved && <span className="budget-saved"><CheckCircle2 size={16} /> Budget saved</span>}
          <button className="button primary" disabled={saving}><Save size={17} />{saving ? 'Saving…' : 'Save budget'}</button>
        </div>
      </section>
    </form>
  )
}
