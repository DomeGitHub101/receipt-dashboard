import { useEffect, useRef, useState } from 'react'

type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode: 'popup'; auto_select: boolean }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

let loader: Promise<GoogleId> | null = null
function loadGoogle() {
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error()))
    script.onerror = () => {
      loader = null
      script.remove()
      reject(new Error())
    }
    document.head.appendChild(script)
  })
  return loader
}

const LABELS = { continue_with: 'Continue with Google', signin_with: 'Sign in with Google', signup_with: 'Sign up with Google' }
// Google's rendered button is 40px tall at size "large" and at most 400px wide.
const HEIGHT = 40
const MAX_WIDTH = 400

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * A dark "Continue with Google" button with the full-colour logo. Google's own button is layered on top
 * (transparent) so the click still goes through Google Identity Services and yields a verifiable ID token.
 */
export function GoogleButton({ clientId, onCredential, text = 'continue_with' }: { clientId: string; onCredential: (credential: string) => void; text?: 'continue_with' | 'signin_with' | 'signup_with' }) {
  const wrap = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { callback.current = onCredential })
  useEffect(() => {
    let active = true
    setReady(false)
    loadGoogle()
      .then((google) => {
        if (!active || !target.current || !wrap.current) return
        google.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential), ux_mode: 'popup', auto_select: false })
        target.current.replaceChildren()
        google.renderButton(target.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text,
          locale: 'en',
          width: Math.max(200, Math.min(wrap.current.offsetWidth || 320, MAX_WIDTH)),
        })
        setReady(true)
      })
      .catch(() => active && setFailed(true))
    return () => { active = false }
  }, [clientId, text])
  return (
    <div className="w-full" style={{ maxWidth: MAX_WIDTH }}>
      <div
        ref={wrap}
        className="group relative w-full overflow-hidden rounded-md border border-input bg-secondary transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
        style={{ height: HEIGHT }}
      >
        <div aria-hidden="true" className={`flex h-full items-center justify-center gap-3 text-sm font-medium text-foreground ${ready ? '' : 'opacity-60'}`}>
          <GoogleLogo />
          {LABELS[text]}
        </div>
        <div ref={target} className="absolute inset-0 flex items-center justify-center opacity-0" />
      </div>
      {failed && <p className="security-muted mt-2" role="alert">Google sign-in could not load. Check your connection and refresh the page.</p>}
    </div>
  )
}
