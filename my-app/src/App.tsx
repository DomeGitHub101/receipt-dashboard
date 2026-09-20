import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ArrowLeftRight,
  ScanLine,
  Tags,
  Plus,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Leaf,
  CheckCircle2,
  Trash2,
  PiggyBank,
  Settings as SettingsIcon,
} from 'lucide-react'
import { api, restoreSession, signOut } from './api'
import type { Category, Entry, EntryInput, Summary, User } from './types'
import { Brand, Busy, EntryForm, ErrorBox, Modal } from './components'
import { message, today } from './utils'
import Auth from './Auth'
const Dashboard = lazy(() => import('./Dashboard'))
import Transactions from './Transactions'
import Upload from './Upload'
import Categories from './Categories'
import Budgets from './Budgets'
import Settings from './Settings'
import EmailAction from './EmailAction'
import './App.css'

type Page = 'overview' | 'transactions' | 'upload' | 'budgets' | 'categories' | 'settings'
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'upload', label: 'Scan receipt', icon: ScanLine },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

export default function App() {
  const [emailAction, setEmailAction] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const action = params.has('reset') ? 'reset' : params.has('verify') ? 'verify' : null
    return action ? { action: action as 'reset' | 'verify', token: params.get(action)! } : null
  })
  useEffect(() => {
    if (emailAction) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [emailAction])
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [page, setPage] = useState<Page>('overview')
  const [categories, setCategories] = useState<Category[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [month, setMonth] = useState(today().slice(0, 7))
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<Partial<Entry> | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  useEffect(() => {
    let active = true
    restoreSession()
      .then((s) => {
        if (active) setUser(s.user)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBooting(false)
      })
    const expired = () => {
      setMobileNav(false)
      setUser(null)
      setEditing(null)
      setSummary(null)
      setEntries([])
      setCategories([])
    }
    window.addEventListener('session-expired', expired)
    return () => {
      active = false
      window.removeEventListener('session-expired', expired)
    }
  }, [])
  const loadCategories = useCallback(async () => {
    setCategories(await api<Category[]>('/categories'))
  }, [])
  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setError('')
    const [year, m] = month.split('-').map(Number)
    const last = new Date(year, m, 0).getDate()
    Promise.all([
      api<Category[]>('/categories'),
      api<Summary>(`/dashboard/summary?month=${month}`),
      api<Entry[]>(`/transactions?start=${month}-01&end=${month}-${last}`),
    ])
      .then(([cats, sum, items]) => {
        if (active) {
          setCategories(cats)
          setSummary(sum)
          setEntries(items)
        }
      })
      .catch((e) => {
        if (active) setError(message(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, month, revision])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  function navigate(next: Page) {
    setPage(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  async function save(data: EntryInput) {
    await api(editing?.id ? `/transactions/${editing.id}` : '/transactions', {
      method: editing?.id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    })
    setEditing(null)
    setRevision((r) => r + 1)
    setToast('Saved. One less thing to remember.')
  }
  async function remove() {
    if (!editing?.id) return
    setBusy(true)
    try {
      await api(`/transactions/${editing.id}`, { method: 'DELETE' })
      setDeleting(false)
      setEditing(null)
      setRevision((r) => r + 1)
      setToast('Transaction deleted.')
    } catch (e) {
      setError(message(e))
      setDeleting(false)
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    setBusy(true)
    try {
      await signOut()
      setMobileNav(false)
      setUser(null)
      setSummary(null)
      setEntries([])
      setCategories([])
      setPage('overview')
      setEditing(null)
      setToast('')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  if (emailAction) return <EmailAction {...emailAction} onDone={() => setEmailAction(null)} />
  if (booting)
    return (
      <div className="boot-screen">
        <Brand />
        <Busy text="Finding your little moments…" />
      </div>
    )
  if (!user)
    return (
      <Auth
        onAuth={(u) => {
          setMobileNav(false)
          setUser(u)
          setPage('overview')
          setRevision((r) => r + 1)
        }}
      />
    )
  const titles = {
    overview: `A little clarity, ${user.name.split(' ')[0]}.`,
    transactions: 'Your money, in moments.',
    upload: 'Less paper. More perspective.',
    budgets: 'Give every baht a little direction.',
    settings: 'Your account. Your peace of mind.',
    categories: 'Organized, your way.',
  }
  const subtitles = {
    overview: 'Here’s how your month is shaping up.',
    transactions: 'Every income, every expense, all in one place.',
    upload: 'Turn that receipt into something useful.',
    budgets: 'Set a plan, follow your progress, and adjust as life happens.',
    settings: 'Security, privacy, and a safe copy of your data.',
    categories: 'Little groups that make the big picture clearer.',
  }
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">YOUR LITTLE CORNER</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {page === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-leaf">
            <Leaf size={22} />
          </span>
          <h3>Good habits grow.</h3>
          <p>
            A quick scan today.
            <br />A clearer picture tomorrow.
          </p>
          <button onClick={() => navigate('upload')}>
            Let’s make it a habit
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>Personal workspace</small>
            </div>
          </div>
          <button className="logout" onClick={logout} disabled={busy}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              My workspace <span>/</span>{' '}
              <strong>{navigation.find((n) => n.id === page)?.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="personal-badge">
              <i />
              Personal account
            </span>
            <span className="avatar small">{user.name.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'overview'
                  ? 'YOUR MONTH, AT A GLANCE'
                  : page === 'upload'
                    ? 'A FRESH LITTLE HABIT'
                    : 'MAKE YOURSELF AT HOME'}
              </span>
              <h1>{titles[page]}</h1>
              <p>{subtitles[page]}</p>
            </div>
            <div className="heading-actions">
              {(page === 'overview' || page === 'budgets') && (
                <label className="month-picker">
                  <span className="sr-only">Dashboard month</span>
                  <input
                    type="month"
                    value={month}
                    min="2000-01"
                    max="2100-12"
                    onChange={(e) => {
                      if (e.target.value) setMonth(e.target.value)
                    }}
                  />
                </label>
              )}
              {page === 'overview' && (
                <button className="button primary desktop-add" onClick={() => setEditing({})}>
                  <Plus size={18} />
                  Add transaction
                </button>
              )}
            </div>
          </div>
          <ErrorBox error={error} />
          {error && (
            <button className="text-button" onClick={() => setRevision((r) => r + 1)}>
              Try loading again
            </button>
          )}
          {page === 'overview' &&
            (loading ? (
              <Busy text="Gathering your month…" />
            ) : (
              summary && (
                <Suspense fallback={<Busy text="Preparing your charts…" />}>
                  <Dashboard
                    summary={summary}
                    entries={entries}
                    categories={categories}
                    onScan={() => navigate('upload')}
                    onAdd={() => setEditing({})}
                    onAll={() => navigate('transactions')}
                    onEdit={setEditing}
                  />
                </Suspense>
              )
            ))}
          {page === 'transactions' && (
            <Transactions
              categories={categories}
              revision={revision}
              onAdd={() => setEditing({})}
              onEdit={setEditing}
            />
          )}
          {page === 'upload' && (
            <Upload
              categories={categories}
              onSaved={() => {
                setRevision((r) => r + 1)
                navigate('transactions')
              }}
            />
          )}
          {page === 'categories' && (
            <Categories
              categories={categories}
              onChange={async () => {
                await loadCategories()
                setRevision((r) => r + 1)
              }}
              notify={setToast}
            />
          )}
          {page === 'budgets' && (
            <Budgets
              month={month}
              revision={revision}
              onSaved={() => {
                setRevision((r) => r + 1)
                setToast('Budget saved for this month.')
              }}
            />
          )}
          {page === 'settings' && <Settings onRestored={() => setRevision((r) => r + 1)} />}
        </main>
        <footer className="app-footer">
          <span>
            slipsnap. <span>A little clarity goes a long way.</span>
          </span>
          <span>Thoughtfully simple.</span>
        </footer>
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'The details of your day' : 'A new little moment'}
          onClose={() => {
            if (!busy) {
              setEditing(null)
              setDeleting(false)
            }
          }}
        >
          <EntryForm
            categories={categories}
            initial={editing}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
          {editing.id && !deleting && (
            <button
              className="text-button danger-text delete-entry"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={15} />
              Delete transaction
            </button>
          )}
          {deleting && (
            <div className="delete-confirm">
              <p>Delete this transaction? This cannot be undone.</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                Keep it
              </button>
              <button className="button danger" disabled={busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Delete transaction'}
              </button>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
