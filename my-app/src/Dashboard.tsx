import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ReceiptText,
  Plus,
  ArrowRight,
  ScanLine,
  Leaf,
  Check,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { Summary, Entry, Category } from './types'
import { Empty } from './components'
import { money } from './utils'
import { TransactionTable } from './TransactionTable'

export default function Dashboard({
  summary,
  entries,
  categories,
  onScan,
  onAdd,
  onAll,
  onEdit,
}: {
  summary: Summary
  entries: Entry[]
  categories: Category[]
  onScan: () => void
  onAdd: () => void
  onAll: () => void
  onEdit: (entry: Entry) => void
}) {
  const stats = [
    {
      label: 'Money in',
      value: summary.income,
      icon: ArrowDownLeft,
      detail: 'Your income this month',
      style: 'income',
    },
    {
      label: 'Money out',
      value: summary.expense,
      icon: ArrowUpRight,
      detail: 'Your expenses this month',
      style: 'expense',
    },
    {
      label: 'Left this month',
      value: summary.balance,
      icon: Wallet,
      detail: 'Income minus expenses',
      style: 'balance',
    },
    {
      label: 'Receipts saved',
      value: summary.receipts,
      icon: ReceiptText,
      detail: `${summary.count} total transactions`,
      style: 'receipts',
    },
  ]
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">LESS PAPER. MORE PEACE OF MIND.</span>
          <h2>
            Your next good habit
            <br />
            starts with a snap.
          </h2>
          <p>Let your receipts do the remembering.</p>
          <button className="button primary" onClick={onScan}>
            <ScanLine size={18} />
            Scan a receipt
            <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-circle" />
          <div className="mini-receipt">
            <Leaf size={23} />
            <b>A little well spent.</b>
            <span>COFFEE & GOOD DAYS</span>
            <i />
            <div>
              <span>Everyday moments</span>
              <span>✓</span>
            </div>
            <div>
              <span>All accounted for</span>
              <span>✓</span>
            </div>
            <i />
            <div>
              <b>Peace of mind</b>
              <b>Priceless</b>
            </div>
          </div>
          <span className="art-check">
            <Check size={25} />
          </span>
          <span className="art-spark">✦</span>
        </div>
      </section>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article className={`stat-card ${stat.style}`} key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <stat.icon size={18} />
            </div>
            <strong>
              {stat.style === 'receipts' ? String(stat.value).padStart(2, '0') : money(stat.value)}
            </strong>
            <small>{stat.detail}</small>
          </article>
        ))}
      </section>
      <div className="charts-grid">
        <section className="card activity-card">
          <div className="section-heading">
            <div>
              <h2>The monthly picture</h2>
              <p>A little perspective on what comes in and goes out.</p>
            </div>
            <span className="small-tag">Daily</span>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: '#00704a' }} />
              Income
            </span>
            <span>
              <i style={{ background: '#d0aa7b' }} />
              Expenses
            </span>
          </div>
          {summary.count ? (
            <div className="area-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.daily.map((d) => ({
                    ...d,
                    income: Number(d.income),
                    expense: Number(d.expense),
                  }))}
                  margin={{ top: 15, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00704a" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#00704a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eeeee7" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#91968b' }}
                    minTickGap={25}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#91968b' }}
                    width={48}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    labelFormatter={(v) => `Day ${v}`}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e6e8df', fontSize: 12 }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#00704a"
                    strokeWidth={2.5}
                    fill="url(#incomeFill)"
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="expense"
                    name="Expenses"
                    stroke="#c79254"
                    strokeWidth={2.5}
                    fill="#d0aa7b"
                    fillOpacity={0.06}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
              <p>Little things, by category.</p>
            </div>
          </div>
          {summary.categories.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={summary.categories.map((c) => ({ ...c, amount: Number(c.amount) }))}
                      dataKey="amount"
                      innerRadius={66}
                      outerRadius={88}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {summary.categories.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <small>Total spent</small>
                  <strong>{money(summary.expense)}</strong>
                </div>
              </div>
              <div className="category-legend">
                {summary.categories.map((c) => (
                  <div key={c.name}>
                    <span>
                      <i style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <strong>
                      {Math.round((Number(c.amount) / Number(summary.expense)) * 100)}%
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="Make room for clarity"
              text="Your spending categories will appear here as you go."
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
      <div className="page-footnote">
        <Leaf size={14} />
        Small habits. A clearer tomorrow.
      </div>
    </>
  )
}
