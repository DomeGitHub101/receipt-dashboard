import { useState } from 'react'
import type { FormEvent } from 'react'
import { publicApi, clearSession } from './api'
import { Brand, ErrorBox } from './components'
import { message } from './utils'

export default function EmailAction({ action, token, onDone }: { action: 'reset' | 'verify'; token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await publicApi<{ message: string }>(`/auth/${action === 'reset' ? 'reset-password' : 'verify-email'}`, { token, new_password: data.get('password'), code: data.get('code') || '' })
      setNotice(result.message)
      if (action === 'reset') clearSession()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <main className="account-action-page"><section className="card"><Brand /><h1>{action === 'reset' ? 'Choose a new password' : 'Verify your email'}</h1>
    <ErrorBox error={error} />
    {notice ? <><p role="status">{notice}</p><button className="button primary" onClick={onDone}>Continue to SlipSnap</button></> : <form className="entry-form" onSubmit={submit}>
      {action === 'reset' && <><label>New password<input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label><label>Authenticator / recovery code (if enabled)<input name="code" autoComplete="one-time-code" maxLength={80} /></label></>}
      <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : action === 'reset' ? 'Reset password' : 'Verify email'}</button>
      <button className="text-button" type="button" onClick={onDone}>Back to sign in</button>
    </form>}
  </section></main>
}
