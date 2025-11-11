const IDP_BASE: string = (import.meta as any).env?.VITE_IDP_BASE || ''

export type PasswordPolicy = {
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireDigit: boolean
  requireSpecial: boolean
  regexPattern?: string
  regexDescription?: string
}

export async function fetchPasswordPolicy(params?: { baseUrl?: string; tenantId?: string }): Promise<PasswordPolicy> {
  const baseUrl = params?.baseUrl ?? IDP_BASE
  const q = params?.tenantId ? `?tenantId=${encodeURIComponent(params.tenantId)}` : ''
  const res = await fetch(`${baseUrl}/idp/auth/password-policy${q}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fetch password policy failed: ${res.status} ${text}`)
  }
  const raw = await res.json()
  return {
    minLength: raw.minLength ?? raw.MinLength ?? 8,
    requireUpper: raw.requireUpper ?? raw.RequireUpper ?? true,
    requireLower: raw.requireLower ?? raw.RequireLower ?? true,
    requireDigit: raw.requireDigit ?? raw.RequireDigit ?? true,
    requireSpecial: raw.requireSpecial ?? raw.RequireSpecial ?? true,
    regexPattern: raw.regexPattern ?? raw.RegexPattern ?? undefined,
    regexDescription: raw.regexDescription ?? raw.RegexDescription ?? undefined,
  }
}

export async function signupTenant(params: { tenantId: string; baseUrl?: string }) {
  const { tenantId, baseUrl = IDP_BASE } = params
  const res = await fetch(`${baseUrl}/idp/auth/signup/tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tenant signup failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function signupUser(params: {
  tenantId: string
  userId: string
  email: string
  password: string
  roles?: string[]
  baseUrl?: string
}) {
  const { tenantId, userId, email, password, roles, baseUrl = IDP_BASE } = params
  const res = await fetch(`${baseUrl}/idp/auth/signup/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, userId, email, password, roles })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`User signup failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function approveTenant(params: { tenantId: string; token: string; baseUrl?: string }) {
  const { tenantId, token, baseUrl = IDP_BASE } = params
  const res = await fetch(`${baseUrl}/idp/auth/admin/tenants/${encodeURIComponent(tenantId)}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Approve tenant failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function approveUser(params: { tenantId: string; userId: string; token: string; baseUrl?: string }) {
  const { tenantId, userId, token, baseUrl = IDP_BASE } = params
  const res = await fetch(`${baseUrl}/idp/auth/admin/users/${encodeURIComponent(tenantId)}/${encodeURIComponent(userId)}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Approve user failed: ${res.status} ${text}`)
  }
  return res.json()
}
