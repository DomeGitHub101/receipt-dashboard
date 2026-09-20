import type { User } from './types'

let token: string | null = null
export function acceptSession(session: { access_token: string }) {
  token = session.access_token
}
export function clearSession() {
  token = null
  window.dispatchEvent(new Event('session-expired'))
}
export async function publicApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(await errorMessage(response))
  return response.json()
}
let refreshPromise: Promise<{ user: User; access_token: string }> | null = null

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (Array.isArray(data.detail)) return data.detail.map((d: { msg: string }) => d.msg).join('. ')
  return data.detail || 'Could not connect to SlipSnap. Please try again.'
}

export async function restoreSession() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          token = null
          throw new Error(await errorMessage(r))
        }
        const data = await r.json()
        token = data.access_token
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function signIn(
  mode: 'login' | 'register',
  data: { email: string; password: string; name?: string; code?: string },
) {
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const session = await response.json()
  token = session.access_token
  return session.user as User
}

export async function signOut() {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  if (!response.ok) throw new Error(await errorMessage(response))
  token = null
}

async function request(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...options, credentials: 'include', headers })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  if (response.status === 401 && retry) {
    try {
      await restoreSession()
    } catch {
      window.dispatchEvent(new Event('session-expired'))
      throw new Error('Your session expired. Please sign in again.')
    }
    return request(path, options, false)
  }
  if (!response.ok) throw new Error(await errorMessage(response))
  return response
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options)
  return response.status === 204 ? (undefined as T) : response.json()
}

export async function download(path: string, filename?: string, options?: RequestInit) {
  const response = await request(path, options)
  const url = URL.createObjectURL(await response.blob())
  const a = document.createElement('a')
  a.href = url
  const disposition = response.headers.get('Content-Disposition') || ''
  const encodedName = disposition.match(/filename\*=utf-8''([^;]+)/i)?.[1]
  const plainName = disposition.match(/filename="([^"]+)"/)?.[1]
  a.download = filename || (encodedName ? decodeURIComponent(encodedName) : plainName) || 'receipt'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
