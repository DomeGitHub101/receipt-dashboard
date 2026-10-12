import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Wallet, ReceiptText, Plus, ArrowRight, ScanLine, Leaf } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import type { Summary, Entry, Category } from './types'
import { Empty } from './components'
import { money, today } from './utils'
import { TransactionTable } from './TransactionTable'

// Validated against the dark card surface: both clear 3:1 contrast and stay distinct under colour-blindness.
const SERIES = {
  expense: { color: '#c08645', title: 'Daily spending', verb: 'spent', empty: 'No spending recorded this month yet.' },
  income: { color: '#13784f', title: 'Daily income', verb: 'received', empty: 'No income recorded this month yet.' },
} as const
type View = keyof typeof SERIES
const MAX_CATEGORY_ROWS = 6

const compact = (value: number) => (value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : String(value))
const shortMoney = (value: number) => money(Math.round(value))
// Round axis steps (1, 2, 2.5 or 5 × 10^n) so the gridlines land on clean amounts.
function axisTicks(max: number) {
  if (max <= 0) return [0]
  const raw = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw) as number
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

export default function Dashboard({
  summary,
  month,
  entries,
  categories,
  onScan,
  onAdd,
  onAll,
  onEdit,
}: {
  summary: Summary
  month: string
  entries: Entry[]
  categories: Category[]
  onScan: () => void
  onAdd: () => void
  onAll: () => void
  onEdit: (entry: Entry) => void
}) {
  const [view, setView] = useState<View>('expense')
  const income = Number(summary.income)
  const expense = Number(summary.expense)
  const monthName = new Date(`${month}-01T00:00:00`).toLocaleString('en-GB', { month: 'short' })
  const dayLabel = (day: number) => `${day} ${monthName}`

  const daily = summary.daily.map((d) => ({ day: d.day, income: Number(d.income), expense: Number(d.expense) }))
  const series = SERIES[view]
  const values = daily.map((d) => d[view])
  const total = view === 'expense' ? expense : income
  const yTicks = axisTicks(Math.max(...values))
  const peak = values.reduce((best, value, i) => (value > values[best] ? i : best), 0)
  // Average over the days that have happened: the whole month in the past, up to today in the current month.
  const current = today().slice(0, 7)
  const elapsed = month < current ? daily.length : month === current ? Number(today().slice(8)) : 0
  const lastDay = daily.length
  const ticks = [1, 5, 10, 15, 20, 25, lastDay].filter((d, i, all) => d <= lastDay && all.indexOf(d) === i && !(d !== lastDay && lastDay - d < 3))

  const spentShare = income > 0 ? Math.round((expense / income) * 100) : null
  const rows = summary.categories.map((c) => ({ ...c, amount: Number(c.amount) }))
  const shown = rows.length > MAX_CATEGORY_ROWS + 1 ? rows.slice(0, MAX_CATEGORY_ROWS) : rows
  const rest = rows.slice(shown.length).reduce((sum, c) => sum + c.amount, 0)
  const categoryRows = rest ? [...shown, { name: 'Everything else', color: '#a5a59a', amount: rest }] : shown

  const stats = [
    { label: 'Money in', value: money(income), icon: ArrowDownLeft, detail: 'Your income this month', style: 'income' },
    { label: 'Money out', value: money(expense), icon: ArrowUpRight, detail: 'Your expenses this month', style: 'expense' },
    { label: 'Left this month', value: money(summary.balance), icon: Wallet, detail: 'Income minus expenses', style: 'balance' },
    { label: 'Receipts saved', value: String(summary.receipts), icon: ReceiptText, detail: `${summary.count} total transactions`, style: 'receipts' },
  ]
  return (
    <>
      <section className="welcome-banner">
        <span className="banner-icon" aria-hidden="true">
          <ScanLine size={22} />
        </span>
        <div className="banner-copy">
          <span className="eyebrow">LESS PAPER. MORE PEACE OF MIND.</span>
          <h2>Your next good habit starts with a snap.</h2>
        </div>
        <button className="button primary" onClick={onScan}>
          <ScanLine size={17} />
          Scan a receipt
        </button>
      </section>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article className={`stat-card ${stat.style}`} key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <stat.icon size={18} />
            </div>
            <strong>{stat.value}</strong>
            {stat.style === 'balance' && spentShare !== null ? (
              <div className="spend-meter">
                <div className="meter-track" role="meter" aria-label="Share of income spent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(spentShare, 100)}>
                  <span className={spentShare > 100 ? 'over' : spentShare > 80 ? 'high' : ''} style={{ width: `${Math.min(spentShare, 100)}%` }} />
                </div>
                <small>{spentShare > 100 ? `Spent ${spentShare}% of income · over by ${money(expense - income)}` : `Spent ${spentShare}% of your income`}</small>
              </div>
            ) : (
              <small>{stat.detail}</small>
            )}
          </article>
        ))}
      </section>
      <div className="charts-grid">
        <section className="card activity-card">
          <div className="section-heading">
            <div>
              <h2>{series.title}</h2>
              <p>How much was {series.verb} on each day of the month.</p>
            </div>
            <div className="segmented" role="group" aria-label="Chart data">
              {(Object.keys(SERIES) as View[]).map((key) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
                  {key === 'expense' ? 'Spending' : 'Income'}
                </button>
              ))}
            </div>
          </div>
          {summary.count ? (
            <>
              <dl className="chart-facts">
                <div>
                  <dt>Total</dt>
                  <dd>{money(total)}</dd>
                </div>
                {view === 'expense' && elapsed > 0 && (
                  <div>
                    <dt>Daily average</dt>
                    <dd>{shortMoney(total / elapsed)}</dd>
                  </div>
                )}
                {values[peak] > 0 && (
                  <div>
                    <dt>Biggest day</dt>
                    <dd>
                      {dayLabel(daily[peak].day)} · {shortMoney(values[peak])}
                    </dd>
                  </div>
                )}
              </dl>
              {total > 0 ? (
                <div className="bar-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily} margin={{ top: 22, right: 6, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <CartesianGrid vertical={false} stroke="#212a25" />
                      <XAxis
                        dataKey="day"
                        ticks={ticks}
                        interval={0}
                        axisLine={{ stroke: '#2c3832' }}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#8f9b94' }}
                        tickFormatter={(d) => String(d)}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={42}
                        domain={[0, yTicks[yTicks.length - 1]]}
                        ticks={yTicks}
                        interval={0}
                        tick={{ fontSize: 11, fill: '#8f9b94' }}
                        tickFormatter={compact}
                      />
                      <Tooltip
                        cursor={{ fill: '#ffffff0a' }}
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="chart-tooltip">
                              <span>{dayLabel(Number(label))}</span>
                              <strong>{money(Number(payload[0].value))}</strong>
                              <small>{series.verb}</small>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey={view} fill={series.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                        <LabelList
                          dataKey={view}
                          content={({ x, y, width, index }) =>
                            index === peak ? (
                              <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" className="peak-label">
                                {compact(Math.round(values[peak]))}
                              </text>
                            ) : null
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="chart-empty">{series.empty}</p>
              )}
              <table className="sr-only">
                <caption>{series.title}</caption>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.filter((d) => d[view] > 0).map((d) => (
                    <tr key={d.day}>
                      <td>{dayLabel(d.day)}</td>
                      <td>{money(d[view])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <Empty
              title="Your picture starts here"
              text="Add your first transaction to see your month take shape."
              action={
                <button className="text-button" onClick={onAdd}>
                  <Plus size={16} />
                  Add a transaction
                </button>
              }
            />
          )}
        </section>
        <section className="card category-chart">
          <div className="section-heading">
            <div>
              <h2>Where it went</h2>
              <p>Spending by category, largest first.</p>
            </div>
          </div>
          {categoryRows.length ? (
            <>
              <div className="category-total">
                <strong>{money(expense)}</strong>
                <span>
                  spent across {rows.length} {rows.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
              <ol className="category-bars">
                {categoryRows.map((c) => {
                  const share = expense ? (c.amount / expense) * 100 : 0
                  return (
                    <li key={c.name}>
                      <div className="category-bar-head">
                        <span className="category-name">
                          <i style={{ background: c.color }} />
                          {c.name}
                        </span>
                        <span className="category-value">
                          {shortMoney(c.amount)}
                          <em>{share < 1 ? '<1' : Math.round(share)}%</em>
                        </span>
                      </div>
                      <div className="category-track">
                        <span style={{ width: `${Math.max(share, 1.5)}%`, background: c.color }} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <Empty title="Make room for clarity" text="Your spending categories will appear here as you go." />
          )}
        </section>
      </div>
      <section className="card recent-card">
        <div className="section-heading">
          <div>
            <h2>Your latest little moments</h2>
            <p>Recent transactions this month.</p>
          </div>
          <button className="text-button" onClick={onAll}>
            View all
            <ArrowRight size={16} />
          </button>
        </div>
        {entries.length ? (
          <TransactionTable entries={entries.slice(0, 5)} categories={categories} onEdit={onEdit} />
        ) : (
          <Empty title="A clean slate feels good" text="Scan a receipt or add an entry. We’ll take it from there." />
        )}
      </section>
      <div className="page-footnote">
        <Leaf size={14} />
        Small habits. A clearer tomorrow.
      </div>
    </>
  )
}
