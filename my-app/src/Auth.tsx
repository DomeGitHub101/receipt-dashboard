import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  ScanLine,
  ShieldCheck,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
} from 'lucide-react'
import { signIn } from './api'
import { Brand, ErrorBox } from './components'
import { message } from './utils'
import type { User } from './types'

export default function Auth({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const data = new FormData(e.currentTarget)
    try {
      onAuth(
        await signIn(mode, {
          email: String(data.get('email')),
          password: String(data.get('password')),
          name: String(data.get('name') || ''),
        }),
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-form-wrap">
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>{mode === 'login' ? 'Good to see you.' : 'A fresh start for your finances.'}</h1>
          <p className="subtitle">
            {mode === 'login'
              ? 'Your everyday spending, all in one happy place.'
              : 'Less receipt clutter. More room for what matters.'}
          </p>
          <form onSubmit={submit} className="auth-form">
            <ErrorBox error={error} />
            {mode === 'register' && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="What should we call you?"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  maxLength={72}
                  placeholder={
                    mode === 'register' ? 'At least 8 characters' : 'Enter your password'
                  }
                  required
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  className="icon-button"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button disabled={busy} className="button primary auth-submit">
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'New around here?' : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <div className="auth-assurance">
            <ShieldCheck size={16} /> Your receipts. Your account. Your peace of mind.
          </div>
        </div>
        <span className="auth-footer">Made for the little things that add up.</span>
      </section>
      <section className="auth-story">
        <div className="story-top">
          <Leaf size={20} />
          <span>A fresh perspective on your money</span>
        </div>
        <h2>
          Small spends.
          <br />
          Bigger picture.
        </h2>
        <p>Turn a pocket full of receipts into a little more peace of mind.</p>
        <div className="receipt-scene">
          <span className="scene-orbit orbit-one" />
          <span className="scene-orbit orbit-two" />
          <div className="paper-receipt">
            <div className="receipt-leaf">
              <Leaf size={30} />
            </div>
            <strong>THE DAILY BREW</strong>
            <span>Good coffee. Good company.</span>
            <div className="receipt-rule" />
            <div>
              <span>Oat milk latte</span>
              <span>฿125.00</span>
            </div>
            <div>
              <span>Butter croissant</span>
              <span>฿85.00</span>
            </div>
            <div className="receipt-rule" />
            <div className="receipt-total">
              <span>Total</span>
              <span>฿210.00</span>
            </div>
            <div className="receipt-barcode" />
            <small>Every little moment counts.</small>
          </div>
          <div className="scan-floating">
            <span>
              <Check size={19} />
            </span>
            <div>
              <strong>Receipt, meet clarity.</strong>
              <small>Scan. Review. Save. Simple.</small>
            </div>
          </div>
          <span className="sample-caption">An everyday moment, illustrated.</span>
        </div>
        <div className="story-features">
          <span>
            <ScanLine size={18} />
            Scan in seconds
          </span>
          <span>
            <Check size={18} />
            Stay in the know
          </span>
        </div>
      </section>
    </main>
  )
}
