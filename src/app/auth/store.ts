import create from 'zustand'

type AuthState = {
  token: string | null
  userId: string | null
  tenantId: string | null
  signingIn: boolean
  error: string | null
  signIn: (args: { tenantId: string; userId: string; password: string }) => Promise<void>
  signOut: () => void
}

const IDP_BASE = (import.meta as any).env?.VITE_IDP_BASE || ''

export const useAuth = create<AuthState>((set, get) => ({
  token: typeof localStorage !== 'undefined' ? localStorage.getItem('auth.token') : null,
  userId: typeof localStorage !== 'undefined' ? localStorage.getItem('auth.userId') : null,
  tenantId: typeof localStorage !== 'undefined' ? localStorage.getItem('auth.tenantId') : null,
  signingIn: false,
  error: null,
  async signIn({ tenantId, userId, password }) {
    set({ signingIn: true, error: null })
    try {
      const res = await fetch(`${IDP_BASE}/idp/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, password })
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Sign-in failed (${res.status})`)
      }
      const body = await res.json()
      const token = body.accessToken || body.token || null
      if (!token) throw new Error('No accessToken in response')
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth.token', token)
        localStorage.setItem('auth.userId', userId)
        localStorage.setItem('auth.tenantId', tenantId)
      }
      set({ token, userId, tenantId, signingIn: false })
    } catch (e: any) {
      set({ error: e.message || String(e), signingIn: false })
    }
  },
  signOut() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth.token')
      localStorage.removeItem('auth.userId')
      localStorage.removeItem('auth.tenantId')
    }
    set({ token: null, userId: null, tenantId: null })
  }
}))
