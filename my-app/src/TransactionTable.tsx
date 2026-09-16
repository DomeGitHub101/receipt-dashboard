import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react'
import type { Category, Entry } from './types'
import { money } from './utils'

export function TransactionTable({
  entries,
  categories,
  onEdit,
}: {
  entries: Entry[]
  categories: Category[]
  onEdit: (entry: Entry) => void
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Merchant / description</th>
            <th>Category</th>
            <th>Date</th>
            <th className="amount-cell">Amount</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const cat = categories.find((c) => c.id === entry.category_id)
            return (
              <tr key={entry.id}>
                <td>
                  <div className="merchant-cell">
                    <span
                      className={`merchant-icon ${entry.kind}`}
                      style={{ backgroundColor: `${cat?.color || '#00704a'}14`, color: cat?.color }}
                    >
                      {entry.receipt_id ? (
                        <ReceiptText size={19} />
                      ) : entry.kind === 'income' ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <ArrowUpRight size={19} />
                      )}
                    </span>
                    <div>
                      <button className="merchant-name" onClick={() => onEdit(entry)}>
                        {entry.merchant}
                      </button>
                      <span className="merchant-detail">
                        {entry.receipt_id
                          ? 'Scanned receipt'
                          : entry.kind === 'income'
                            ? 'Income'
                            : 'Manual entry'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="category-pill">
                    <i style={{ background: cat?.color }} />
                    {cat?.name || 'Other'}
                  </span>
                </td>
                <td className="date-cell">
                  {new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className={`amount-cell ${entry.kind === 'income' ? 'positive' : ''}`}>
                  {entry.kind === 'income' ? '+' : '−'}
                  {money(entry.amount)}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${entry.merchant}`}
                    onClick={() => onEdit(entry)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
