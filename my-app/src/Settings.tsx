import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Mail, Trash2, UserRound, Link2, CheckCircle2 } from 'lucide-react'
import { api, publicApi, acceptSession, clearSession, authOptions } from './api'
import { Busy, ErrorBox, Modal } from './components'
import { GoogleButton } from './Google'
import { message } from './utils'
import type { User } from './types'

type Security = {
  name: string; email: string; email_verified: boolean
  email_delivery_configured: boolean; has_password: boolean; google_linked: boolean; google_available: boolean
}
type Action = 'password' | 'delete' | 'link' | 'unlink'

export default function Settings({ onUser }: { onUser: (user: User) => void }) {
  const [status, setStatus] = useState<Security | null>(null)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Google-only accounts confirm sensitive actions with a fresh Google sign-in instead of a password.
  const [googleConfirm, setGoogleConfirm] = useState('')
  const [linkCredential, setLinkCredential] = useState('')
  const needsGoogle = status ? !status.has_password : false
  async function load() { setStatus(await api<Security>('/account/security')) }
  useEffect(() => {
    load().catch((e) => setError(message(e)))
    authOptions().then((o) => setGoogleClientId(o.google_client_id)).catch(() => setGoogleClientId(null))
  }, [])
  function open(next: Action) { setError(''); setNotice(''); setGoogleConfirm(''); setLinkCredential(''); setAction(next) }
  function close() { if (!busy) { setAction(null); setError(''); setGoogleConfirm(''); setLinkCredential('') } }
  async function verifyEmail() {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await publicApi<{ message: string }>('/auth/request-verification', { email: status?.email })
      setNotice(result.message)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') || '')
    setBusy(true); setError(''); setNotice('')
    try {
      onUser(await api<User>('/account/profile', { method: 'PUT', body: JSON.stringify({ name }) }))
      setNotice('Your name has been updated.')
      await load()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) || '')
    const payload = { password: field('password'), confirmation: field('confirmation'), new_password: field('new_password'), google_credential: googleConfirm }
    setBusy(true); setError(''); setNotice('')
    try {
      if (needsGoogle && !googleConfirm) throw new Error('Confirm with Google first.')
      if (action === 'password' && payload.new_password !== form.get('repeat_password')) throw new Error('New passwords do not match.')
      if (action === 'delete') {
        const result = await api<{ files_pending_cleanup: number }>('/account/delete', { method: 'POST', body: JSON.stringify(payload) })
        if (result.files_pending_cleanup) window.alert('Account deleted. Some original files could not be removed; contact the administrator for cleanup.')
        clearSession()
        return
      } else if (action === 'link' || action === 'unlink') {
        if (action === 'link' && !linkCredential) throw new Error('Choose the Google account to connect.')
        const result = await api<{ message: string }>(`/account/google/${action}`, { method: 'POST', body: JSON.stringify({ ...payload, link_credential: linkCredential }) })
        setNotice(result.message)
      } else {
        acceptSession(await api<{ access_token: string }>('/account/password', { method: 'POST', body: JSON.stringify(payload) }))
        setNotice(status?.has_password ? 'Password changed. Other sessions have been signed out.' : 'Password set. You can now also sign in with your email and password.')
      }
      setAction(null); setGoogleConfirm(''); setLinkCredential('')
      await load()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  if (!status) return error ? <><ErrorBox error={error} /><button className="button secondary" onClick={() => load().catch((e) => setError(message(e)))}>Try again</button></> : <Busy text="Loading account settings…" />
  const titles: Record<Action, string> = { password: status.has_password ? 'Change password' : 'Set a password', delete: 'Delete account permanently', link: 'Connect Google', unlink: 'Disconnect Google' }
  return <div className="security-settings">
    {!action && <ErrorBox error={error} />}
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="card settings-panel" aria-label="Account settings">
      <div className="settings-row"><span className="settings-icon"><UserRound size={20} /></span>
        <div className="settings-copy"><h2>Profile</h2><p>This name appears across Moo Tang.</p></div>
        <form className="profile-form" onSubmit={saveProfile} key={status.name}>
          <label>Display name<input name="name" defaultValue={status.name} required maxLength={80} autoComplete="name" /></label>
          <button className="button secondary" disabled={busy}>Save name</button>
        </form>
      </div>
      <div className="settings-row"><span className="settings-icon"><Mail size={20} /></span>
        <div className="settings-copy"><h2>Email verification</h2><p>{status.email} <span className={`small-tag ${status.email_verified ? 'ok' : ''}`}>{status.email_verified ? 'Verified' : 'Not verified'}</span></p>
          {!status.email_verified && !status.email_delivery_configured && <p className="security-muted">Email delivery has not been configured by the administrator yet.{status.google_available ? ' Connecting a Google account with this address also verifies it.' : ''}</p>}
        </div>
        <div className="settings-actions">
          {!status.email_verified && <button className="button secondary" disabled={busy || !status.email_delivery_configured} onClick={verifyEmail}>Send verification link</button>}
          <button className="text-button" disabled={busy} onClick={() => load().catch((e) => setError(message(e)))}>Refresh verification status</button>
        </div>
      </div>
      {/* Only relevant when the server offers Google sign-in. */}
      {status.google_available && <div className="settings-row"><span className="settings-icon"><Link2 size={20} /></span>
        <div className="settings-copy"><h2>Sign-in methods</h2>
          <p>Email & password: <strong>{status.has_password ? 'On' : 'Not set'}</strong><br />Google: <strong>{status.google_linked ? 'Connected' : 'Not connected'}</strong></p>
          {!status.google_linked && !googleClientId && <p className="security-muted">Google sign-in has not been configured by the administrator yet.</p>}
          {status.google_linked && !status.has_password && <p className="security-muted">Set a password before you can disconnect Google.</p>}
        </div>
        <div className="settings-actions">
          {!status.google_linked && googleClientId && <button className="button secondary" onClick={() => open('link')}>Connect Google</button>}
          {status.google_linked && status.has_password && <button className="button secondary" onClick={() => open('unlink')}>Disconnect Google</button>}
        </div>
      </div>}
      <div className="settings-row"><span className="settings-icon"><KeyRound size={20} /></span>
        <div className="settings-copy"><h2>Password</h2><p>{status.has_password ? 'Choose a unique password. Changing it signs out your other sessions.' : 'You sign in with Google. Add a password to also sign in with your email.'}</p></div>
        <div className="settings-actions"><button className="button secondary" onClick={() => open('password')}>{titles.password}</button></div>
      </div>
    </section>
    <section className="card danger-zone">
      <span className="settings-icon"><Trash2 size={20} /></span>
      <div className="settings-copy"><h2>Delete account</h2><p>Permanently delete your account, transactions, budgets and stored slips.</p></div>
      <button className="button danger" onClick={() => open('delete')}>Delete account</button>
    </section>
    {action && <Modal title={titles[action]} onClose={close}>
      <form className="entry-form" onSubmit={submit} key={action}>
        <ErrorBox error={error} />
        {action === 'delete' && <p>This action cannot be undone. Your account and all stored financial data will be permanently deleted.</p>}
        {action === 'link' && googleClientId && <><p>Choose the Google account you want to use for signing in to Moo Tang.</p>
          {linkCredential ? <p className="google-confirmed"><CheckCircle2 size={18} /> Google account selected</p> : <GoogleButton clientId={googleClientId} onCredential={setLinkCredential} />}</>}
        {action === 'unlink' && <p>You will sign in with your email and password only.</p>}
        {needsGoogle
          ? (googleConfirm
            ? <p className="google-confirmed"><CheckCircle2 size={18} /> Confirmed with Google</p>
            : googleClientId
              ? <div className="google-confirm"><p>Confirm it’s you by signing in with Google again.</p><GoogleButton clientId={googleClientId} text="continue_with" onCredential={setGoogleConfirm} /></div>
              : <p className="security-muted">Google sign-in is not available right now, so this action cannot be confirmed.</p>)
          : <label>Current password<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="current-password" /></label>}
        {action === 'password' && <><label>New password<input name="new_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label><label>Repeat new password<input name="repeat_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label></>}
        {action === 'delete' && <label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autoComplete="off" /></label>}
        <button className={`button ${action === 'delete' ? 'danger' : 'primary'}`} disabled={busy || (needsGoogle && !googleConfirm) || (action === 'link' && !linkCredential)}>{busy ? 'Please wait…' : titles[action]}</button>
      </form>
    </Modal>}
  </div>
}
