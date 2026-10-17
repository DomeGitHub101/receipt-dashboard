import { useState } from 'react'
import { Plus, ArrowRight, ScanLine } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import type { Summary, Entry, Category } from './types'
import { Empty, Pal } from './components'
import { money, palTint, today } from './utils'
import { TransactionTable } from './TransactionTable'

// Both series clear 3:1 against the white card; income is blue so nothing reads as the old green.
const SERIES = {
  expense: {
    color: '#e8578f',
    title: 'Daily spending',
    verb: 'spent',
    empty: 'No spending recorded this month yet.',
  },
  income: {
    color: '#3b82c4',
    title: 'Daily income',
    verb: 'received',
    empty: 'No income recorded this month yet.',
  },
} as const
type View = keyof typeof SERIES
const MAX_PALS = 6

const compact = (value: number) =>
  value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : String(value)
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

  const daily = summary.daily.map((d) => ({
    day: d.day,
    income: Number(d.income),
    expense: Number(d.expense),
  }))
  const series = SERIES[view]
  const values = daily.map((d) => d[view])
  const total = view === 'expense' ? expense : income
  const yTicks = axisTicks(Math.max(...values))
  const peak = values.reduce((best, value, i) => (value > values[best] ? i : best), 0)
  // Average over the days that have happened: the whole month in the past, up to today in the current month.
  const current = today().slice(0, 7)
  const elapsed = month < current ? daily.length : month === current ? Number(today().slice(8)) : 0
  const lastDay = daily.length
  const ticks = [1, 5, 10, 15, 20, 25, lastDay].filter(
    (d, i, all) => d <= lastDay && all.indexOf(d) === i && !(d !== lastDay && lastDay - d < 3),
  )

  const spentShare = income > 0 ? Math.round((expense / income) * 100) : null
  const rows = summary.categories.map((c) => ({ ...c, amount: Number(c.amount) }))
  const shown = rows.length > MAX_PALS + 1 ? rows.slice(0, MAX_PALS) : rows
  const rest = rows.slice(shown.length).reduce((sum, c) => sum + c.amount, 0)
  const pals = rest
    ? [...shown, { name: 'Everything else', color: '#b8b8c8', amount: rest }]
    : shown
  // Categories that sat this month out, leaving aside the ones that only collected income.
  const incomeCategories = new Set(
    entries.filter((e) => e.kind === 'income').map((e) => e.category_id),
  )
  const resting = categories.filter(
    (c) => !rows.some((r) => r.name === c.name) && !incomeCategories.has(c.id),
  )

  return (
    <>
      <section className="month-plate" aria-labelledby="month-plate-title">
        <div className="month-plate-main">
          <h2 id="month-plate-title">
            Spent in {new Date(`${month}-01T00:00:00`).toLocaleString('en-GB', { month: 'long' })}
          </h2>
          <strong className="month-total">{money(expense)}</strong>
          {spentShare !== null && (
            <div className="spend-meter">
              <div
                className="meter-track"
                role="meter"
                aria-label="Share of income spent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(spentShare, 100)}
              >
                <span
                  className={spentShare > 100 ? 'over' : spentShare > 80 ? 'high' : ''}
                  style={{ width: `${Math.min(spentShare, 100)}%` }}
                />
              </div>
              <small>
                {spentShare > 100
                  ? `${spentShare}% of income · over by ${money(expense - income)}`
                  : `${spentShare}% of your income`}
              </small>
            </div>
          )}
          <ul className="plate-pills">
            <li className="pill mint">
              Money in <b>{money(income)}</b>
            </li>
            <li className={`pill ${Number(summary.balance) < 0 ? 'blush' : 'butter'}`}>
              Left <b>{money(summary.balance)}</b>
            </li>
            <li className="pill lilac">
              {summary.receipts} {summary.receipts === 1 ? 'slip' : 'slips'} scanned ·{' '}
              {summary.count} entries
            </li>
          </ul>
        </div>
        <div className="month-plate-actions">
          <button className="button primary scan-cta" onClick={onScan}>
            <ScanLine size={19} />
            Scan a slip
          </button>
          <button className="button secondary" onClick={onAdd}>
            <Plus size={17} />
            Add by hand
          </button>
        </div>
      </section>

      <div className="overview-grid">
        <section className="card roster-card" aria-labelledby="roster-title">
          <div className="section-heading">
            <div>
              <h2 id="roster-title">Where it went</h2>
              <p>Your categories, ranked by spending this month.</p>
            </div>
          </div>
          {pals.length ? (
            <ol className="roster">
              {pals.map((c, i) => {
                const share = expense ? (c.amount / expense) * 100 : 0
                return (
                  <li
                    key={c.name}
                    className={`pal-card ${i === 0 ? 'top' : ''}`}
                    style={{ ['--tint' as string]: palTint(c.color, 95) }}
                  >
                    <span className="rank-flag" aria-label={`Rank ${i + 1}`}>
                      {i + 1}
                    </span>
                    <Pal name={c.name} color={c.color} size={92} />
                    <span className="plate name-plate" style={{ background: palTint(c.color, 88) }}>
                      {c.name}
                    </span>
                    <span className="plate amount-plate">{shortMoney(c.amount)}</span>
                    <span className="plate note-plate">
                      {share < 1 ? '<1%' : `${Math.round(share)}%`} of total
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <Empty
              title="Make room for clarity"
              text="Your spending categories will appear here as you go."
            />
          )}
          {pals.length > 0 && resting.length > 0 && (
            <div className="resting-row">
              <h3>Resting this month</h3>
              <ul>
                {resting.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Pal name={c.name} color={c.color} size={48} resting />
                    <span className="plate">{c.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card activity-card">
          <div className="section-heading">
            <div>
              <h2>{series.title}</h2>
              <p>How much was {series.verb} on each day of the month.</p>
            </div>
            <div className="segmented" role="group" aria-label="Chart data">
              {(Object.keys(SERIES) as View[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                >
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
                    <BarChart
                      data={daily}
                      margin={{ top: 22, right: 6, left: 0, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid vertical={false} stroke="#f1e6ef" />
                      <XAxis
                        dataKey="day"
                        ticks={ticks}
                        interval={0}
                        axisLine={{ stroke: '#e3d7e6' }}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#5f6388' }}
                        tickFormatter={(d) => String(d)}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={42}
                        domain={[0, yTicks[yTicks.length - 1]]}
                        ticks={yTicks}
                        interval={0}
                        tick={{ fontSize: 11, fill: '#5f6388' }}
                        tickFormatter={compact}
                      />
                      <Tooltip
                        cursor={{ fill: '#ff6ba714' }}
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
                      <Bar
                        dataKey={view}
                        fill={series.color}
                        radius={[6, 6, 2, 2]}
                        maxBarSize={16}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey={view}
                          content={({ x, y, width, index }) =>
                            index === peak ? (
                              <text
                                x={Number(x) + Number(width) / 2}
                                y={Number(y) - 8}
                                textAnchor="middle"
                                className="peak-label"
                              >
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
              {/* A table cannot shrink to sr-only's 1px box, so a wrapper carries the clipping. */}
              <div className="sr-only">
                <table>
                  <caption>{series.title}</caption>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily
                      .filter((d) => d[view] > 0)
                      .map((d) => (
                        <tr key={d.day}>
                          <td>{dayLabel(d.day)}</td>
                          <td>{money(d[view])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
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
          <Empty
            title="A clean slate feels good"
            text="Scan a receipt or add an entry. We’ll take it from there."
          />
        )}
      </section>
    </>
  )
}
