import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck, Download, KeyRound, Mail, Trash2, Upload, LockKeyhole } from 'lucide-react'
import { api, publicApi, acceptSession, clearSession, download } from './api'
import { Busy, ErrorBox, Modal } from './components'
import { message } from './utils'

type Security = { email: string; email_verified: boolean; two_factor_enabled: boolean; recovery_codes_remaining: number; email_delivery_configured: boolean }
type Action = 'password' | 'setup' | 'enable' | 'disable' | 'export' | 'restore' | 'delete'
type Session = { access_token: string; recovery_codes?: string[] }

export default function Settings({ onRestored }: { onRestored: () => void }) {
  const [status, setStatus] = useState<Security | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [secret, setSecret] = useState('')
  const [recovery, setRecovery] = useState<string[]>([])
  async function load() { setStatus(await api<Security>('/account/security')) }
  useEffect(() => { load().catch((e) => setError(message(e))) }, [])
  function open(next: Action) { setError(''); setNotice(''); setAction(next) }
  async function verifyEmail() {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await publicApi<{ message: string }>('/auth/request-verification', { email: status?.email })
      setNotice(result.message)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = { password: String(form.get('password')), code: String(form.get('code') || ''), confirmation: String(form.get('confirmation') || ''), new_password: String(form.get('new_password') || '') }
    setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'password' && payload.new_password !== form.get('repeat_password')) throw new Error('New passwords do not match.')
      if (action === 'export') {
        await download('/account/export', 'slipsnap-backup.zip', { method: 'POST', body: JSON.stringify(payload) })
        setNotice('Backup downloaded. Store it safely: it contains original slips and personal data.')
      } else if (action === 'restore') {
        const result = await api<{ message: string; files_pending_cleanup: number }>('/account/restore', { method: 'POST', body: form })
        setNotice(result.message + (result.files_pending_cleanup ? ' Some old receipt files need administrator cleanup.' : ''))
        onRestored()
      } else if (action === 'delete') {
        const result = await api<{ files_pending_cleanup: number }>('/account/delete', { method: 'POST', body: JSON.stringify(payload) })
        if (result.files_pending_cleanup) window.alert('Account deleted. Some original files could not be removed; contact the administrator for cleanup.')
        clearSession()
        return
      } else if (action === 'setup') {
        const result = await api<{ secret: string }>('/account/2fa/setup', { method: 'POST', body: JSON.stringify(payload) })
        setSecret(result.secret); setAction('enable'); return
      } else {
        const path = action === 'password' ? '/account/password' : `/account/2fa/${action}`
        const result = await api<Session>(path, { method: 'POST', body: JSON.stringify(payload) })
        acceptSession(result)
        if (result.recovery_codes) setRecovery(result.recovery_codes)
        setSecret('')
        setNotice(action === 'password' ? 'Password changed. Other sessions have been signed out.' : action === 'enable' ? 'Two-factor authentication enabled. Save your recovery codes below.' : 'Two-factor authentication disabled.')
      }
      setAction(null)
      await load()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const titles: Record<Action, string> = { password: 'Change password', setup: 'Set up 2FA', enable: 'Confirm authenticator', disable: 'Turn off 2FA', export: 'Download all data', restore: 'Restore a backup', delete: 'Delete account permanently' }
  if (!status) return error ? <><ErrorBox error={error} /><button className="button secondary" onClick={() => load().catch((e) => setError(message(e)))}>Try again</button></> : <Busy text="Loading account settings…" />
  return <div className="security-settings">
    {!action && <ErrorBox error={error} />}
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="card security-overview"><ShieldCheck size={30} /><div><h2>Your account, under your control.</h2><p>Manage how you sign in and keep a copy of your financial records.</p></div></section>
    <div className="security-grid">
      <section className="card security-card"><Mail /><h2>Email verification</h2><p>{status.email}</p><span className="small-tag">{status.email_verified ? 'Verified' : 'Not verified'}</span>
        {!status.email_delivery_configured && <p className="security-muted">Email delivery has not been configured by the administrator yet.</p>}
        {!status.email_verified && <button className="button secondary" disabled={busy || !status.email_delivery_configured} onClick={verifyEmail}>Send verification link</button>}
        <button className="text-button" disabled={busy} onClick={() => load().catch((e) => setError(message(e)))}>Refresh verification status</button>
      </section>
      <section className="card security-card"><KeyRound /><h2>Password</h2><p>Choose a unique password. Changing it signs out your other sessions.</p><button className="button secondary" onClick={() => open('password')}>Change password</button></section>
      <section className="card security-card"><LockKeyhole /><h2>Two-factor authentication</h2><p>Use a time-based code from your authenticator app when signing in.</p><span className="small-tag">{status.two_factor_enabled ? `Enabled · ${status.recovery_codes_remaining} recovery codes left` : 'Not enabled'}</span><button className="button secondary" onClick={() => open(status.two_factor_enabled ? 'disable' : 'setup')}>{status.two_factor_enabled ? 'Turn off 2FA' : 'Set up 2FA'}</button></section>
      <section className="card security-card"><Download /><h2>Backup & download</h2><p>Download your profile, transactions, categories, budgets and original slips in one ZIP file (up to 50 MB). Passwords and security keys are excluded.</p><button className="button secondary" onClick={() => open('export')}>Download all data</button></section>
      <section className="card security-card"><Upload /><h2>Restore your data</h2><p>Replace this account’s financial data with a SlipSnap backup. Your login and security settings stay the same.</p><button className="button secondary" onClick={() => open('restore')}>Restore backup</button></section>
      <section className="card security-card danger-zone"><Trash2 /><h2>Delete account</h2><p>Permanently delete your account, transactions, budgets and stored slips. Download a backup first if you need a copy.</p><button className="button danger" onClick={() => open('delete')}>Delete account</button></section>
    </div>
    {recovery.length > 0 && <section className="card recovery-card"><h2>Save your recovery codes</h2><p>Each code works once in place of an authenticator code. These codes are shown only now. Keep them somewhere safe outside SlipSnap.</p><pre>{recovery.join('\n')}</pre><button className="button primary" onClick={() => setRecovery([])}>I have saved my codes</button></section>}
    {action && <Modal title={titles[action]} onClose={() => { if (!busy) { setAction(null); setSecret(''); setError('') } }}>
      <form className="entry-form" onSubmit={submit} key={action}>
        <ErrorBox error={error} />
        {action === 'enable' && <><p>In your authenticator app, add an account manually. Choose a time-based key and enter this setup key. Then enter the 6-digit code below. Setup expires in 10 minutes.</p><code className="setup-key">{secret}</code></>}
        {action === 'restore' && <><p>This replaces all transactions, categories, budgets and slips in this account. Download a backup first.</p><label>SlipSnap backup ZIP<input type="file" name="file" accept=".zip,application/zip" required /></label></>}
        {action === 'delete' && <p>This action cannot be undone. Your account and all stored financial data will be permanently deleted.</p>}
        {action === 'export' && <p>The ZIP contains personal information and original slips. Keep it in a safe place.</p>}
        <label>Current password<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="current-password" /></label>
        {(status.two_factor_enabled || action === 'enable') && <label>Authenticator or recovery code<input name="code" required maxLength={80} autoComplete="one-time-code" /></label>}
        {action === 'password' && <><label>New password<input name="new_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label><label>Repeat new password<input name="repeat_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label></>}
        {(action === 'delete' || action === 'restore') && <label>Type {action === 'delete' ? 'DELETE' : 'RESTORE'} to confirm<input name="confirmation" required pattern={action === 'delete' ? 'DELETE' : 'RESTORE'} autoComplete="off" /></label>}
        <button className={`button ${action === 'delete' ? 'danger' : 'primary'}`} disabled={busy}>{busy ? 'Please wait…' : titles[action]}</button>
      </form>
    </Modal>}
  </div>
}
