import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AtSignIcon, Eye, EyeOff, LoaderCircle, LockIcon, UserIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { signIn, publicApi, authOptions, googleSignIn } from './api'
import { GoogleButton } from './Google'
import { message } from './utils'
import type { User } from './types'
import { AuthPage, AuthSeparator } from '@/components/ui/auth-page'
import { Input } from '@/components/ui/input'
import type { InputProps } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type EmailAction = 'forgot-password' | 'request-verification'

function FormError({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {error}
    </p>
  ) : null
}

// Input with a leading icon, as in the auth-page design; the label stays available to screen readers.
function IconInput({
  id,
  label,
  icon: Icon,
  children,
  className,
  ...props
}: InputProps & { id: string; label: string; icon: LucideIcon }) {
  return (
    <div className="relative h-max">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input id={id} className={`peer ps-9 ${className || ''}`} {...props} />
      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground peer-disabled:opacity-50">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}

export default function Auth({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [notice, setNotice] = useState('')
  const [emailAction, setEmailAction] = useState<EmailAction | null>(null)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)
  useEffect(() => {
    authOptions()
      .then((o) => setGoogleClientId(o.google_client_id))
      .catch(() => setGoogleClientId(null))
  }, [])
  function showEmailAction(next: EmailAction | null) {
    setEmailAction(next)
    setError('')
    setNotice('')
  }
  async function google(credential: string) {
    setBusy(true)
    setError('')
    try {
      onAuth(await googleSignIn(credential))
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = new FormData(e.currentTarget)
      const result = await publicApi<{ message: string }>(`/auth/${emailAction}`, {
        email: data.get('email'),
      })
      setNotice(result.message)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
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

  if (emailAction)
    return (
      <AuthPage onBack={() => showEmailAction(null)}>
        <div className="flex flex-col space-y-1">
          <h1 className="text-2xl font-bold tracking-wide">
            {emailAction === 'forgot-password' ? 'Reset your password.' : 'Verify your email.'}
          </h1>
          <p className="text-base text-muted-foreground">
            Enter your account email and we’ll send you a secure link.
          </p>
        </div>
        <form className="space-y-2" onSubmit={sendLink} key={emailAction}>
          <FormError error={error} />
          {notice && (
            <p role="status" className="rounded-md bg-primary/10 px-3 py-2.5 text-sm text-primary">
              {notice}
            </p>
          )}
          <IconInput
            id="reset-email"
            label="Account email"
            icon={AtSignIcon}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="your.email@example.com"
            required
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="me-2 size-4 spin" />}
            {busy ? 'Sending…' : 'Send email link'}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          {emailAction === 'forgot-password' ? 'Need to verify your email?' : 'Forgot your password?'}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() =>
              showEmailAction(
                emailAction === 'forgot-password' ? 'request-verification' : 'forgot-password',
              )
            }
          >
            {emailAction === 'forgot-password' ? 'Verify email' : 'Reset password'}
          </button>
        </p>
      </AuthPage>
    )

  return (
    <AuthPage>
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-wide">
          {mode === 'login' ? 'Good to see you.' : 'A fresh start for your finances.'}
        </h1>
        <p className="text-base text-muted-foreground">
          {mode === 'login'
            ? 'Sign in to see where your money went this month.'
            : 'Create your SlipSnap account in a few seconds.'}
        </p>
      </div>
      {googleClientId && (
        <>
          <GoogleButton
            clientId={googleClientId}
            text={mode === 'login' ? 'continue_with' : 'signup_with'}
            onCredential={google}
          />
          <AuthSeparator />
        </>
      )}
      <form className="space-y-2" onSubmit={submit}>
        <p className="text-start text-xs text-muted-foreground">
          {googleClientId ? 'Or ' : ''}
          {mode === 'login'
            ? `${googleClientId ? 's' : 'S'}ign in with your email and password`
            : `${googleClientId ? 'c' : 'C'}reate an account with your email`}
        </p>
        <FormError error={error} />
        {mode === 'register' && (
          <IconInput
            id="auth-name"
            label="Your name"
            icon={UserIcon}
            name="name"
            autoComplete="name"
            placeholder="What should we call you?"
            required
            maxLength={80}
          />
        )}
        <IconInput
          id="auth-email"
          label="Email address"
          icon={AtSignIcon}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="your.email@example.com"
          required
        />
        <IconInput
          id="auth-password"
          label="Password"
          icon={LockIcon}
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          maxLength={72}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
          className="pe-10"
          required
        >
          <button
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 end-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </IconInput>
        {mode === 'login' && (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => showEmailAction('forgot-password')}
            >
              Forgot password?
            </button>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <LoaderCircle className="me-2 size-4 spin" />}
          {busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <p className="mt-8 text-sm text-muted-foreground">
        {mode === 'login' ? 'New to SlipSnap?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </AuthPage>
  )
}
