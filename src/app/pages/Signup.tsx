import React from 'react'
import { signupTenant, signupUser, fetchPasswordPolicy, type PasswordPolicy } from '../api/idp'
import { useAuth } from '../auth/store'

export default function Signup() {
  const { token } = useAuth()
  const [policy, setPolicy] = React.useState<PasswordPolicy | null>(null)
  // Tenant form
  const [tenantId, setTenantId] = React.useState('t1')
  const [tStatus, setTStatus] = React.useState<string | null>(null)
  const [tError, setTError] = React.useState<string | null>(null)
  const [tBusy, setTBusy] = React.useState(false)

  // User form
  const [uTenantId, setUTenantId] = React.useState('t1')
  const [userId, setUserId] = React.useState('admin@t1')
  const [email, setEmail] = React.useState('admin@t1')
  const [password, setPassword] = React.useState('P@ssw0rd!')
  const [roles, setRoles] = React.useState('Admin')
  const [uStatus, setUStatus] = React.useState<string | null>(null)
  const [uError, setUError] = React.useState<string | null>(null)
  const [uBusy, setUBusy] = React.useState(false)
  const [pwValid, setPwValid] = React.useState<boolean>(true)

  React.useEffect(() => {
    // Fetch per-tenant policy for the user creation form
    fetchPasswordPolicy({ tenantId: uTenantId }).then(setPolicy).catch(() => setPolicy(null))
  }, [uTenantId])

  React.useEffect(() => {
    if (!policy) { setPwValid(true); return }
    setPwValid(checkPassword(password, policy).ok)
  }, [password, policy])

  async function createTenant(e: React.FormEvent) {
    e.preventDefault()
    setTStatus(null); setTError(null); setTBusy(true)
    try {
      const res = await signupTenant({ tenantId }) as any
      const msg = (res && (res.message || res.Message)) ?? `Tenant '${tenantId}' created`
      setTStatus(msg)
    } catch (e: any) {
      setTError(e.message || String(e))
    } finally {
      setTBusy(false)
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setUStatus(null); setUError(null); setUBusy(true)
    try {
      const roleList = roles.split(',').map(r => r.trim()).filter(Boolean)
      const res = await signupUser({ tenantId: uTenantId, userId, email, password, roles: roleList }) as any
      const msg = (res && (res.message || res.Message)) ?? `User '${userId}' created in tenant '${uTenantId}'.`
      setUStatus(msg)
    } catch (e: any) {
      setUError(e.message || String(e))
    } finally {
      setUBusy(false)
    }
  }

  return (
    <div style={{display:'grid', gap:16}}>
      <h2>Signup</h2>
      <p style={{fontSize:12, color:'#555'}}>
        Create a tenant and user. Accounts are stored in the Identity database and may require email verification and admin approval based on policy.
      </p>
      {/* Removed always-visible policy panel in favor of a lightweight tooltip near the password field */}
      <section style={{border:'1px solid #e5e7eb', padding:12, borderRadius:8}}>
        <h3>Create Tenant</h3>
        <form onSubmit={createTenant} style={{display:'grid', gap:8, marginTop:8}}>
          <label>Tenant Id
            <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="t1" />
          </label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button type="submit" disabled={tBusy}>{tBusy ? 'Creating…' : 'Create tenant'}</button>
            {tStatus && <span style={{color:'#10b981', fontSize:12}}>{tStatus}</span>}
            {tError && <span style={{color:'crimson', fontSize:12}}>{tError}</span>}
          </div>
        </form>
      </section>

      <section style={{border:'1px solid #e5e7eb', padding:12, borderRadius:8}}>
        <h3>Create User</h3>
        <form onSubmit={createUser} style={{display:'grid', gap:8, marginTop:8}}>
          <label>Tenant Id
            <input value={uTenantId} onChange={e=>setUTenantId(e.target.value)} placeholder="t1" />
          </label>
          <label>User Id
            <input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="admin@t1" />
          </label>
          <label>Email
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com" />
          </label>
          <label style={{display:'grid', gap:4}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              Password
              {policy && <PolicyTooltip policy={policy} />}
            </span>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </label>
          {policy && (
            <PasswordChecklist password={password} policy={policy} />
          )}
          <label>Roles (comma separated)
            <input value={roles} onChange={e=>setRoles(e.target.value)} placeholder="Admin,RM" />
          </label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button type="submit" disabled={uBusy || (policy ? !pwValid : false)}>{uBusy ? 'Creating…' : 'Create user'}</button>
            {uStatus && <span style={{color:'#10b981', fontSize:12}}>{uStatus}</span>}
            {uError && <span style={{color:'crimson', fontSize:12}}>{uError}</span>}
          </div>
        </form>
      </section>

      {token && (
        <div style={{fontSize:12, color:'#555'}}>
          You are signed in. You can still create additional tenants/users for testing.
        </div>
      )}
    </div>
  )
}

function checkPassword(pw: string, policy: PasswordPolicy): { ok: boolean; fails: string[] } {
  const fails: string[] = []
  if (pw.length < Math.max(1, policy.minLength)) fails.push(`At least ${policy.minLength} characters`)
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  if (policy.requireUpper && !hasUpper) fails.push('An uppercase letter')
  if (policy.requireLower && !hasLower) fails.push('A lowercase letter')
  if (policy.requireDigit && !hasDigit) fails.push('A digit')
  if (policy.requireSpecial && !hasSpecial) fails.push('A special character')
  if (policy.regexPattern) {
    try {
      const re = new RegExp(policy.regexPattern)
      if (!re.test(pw)) fails.push(policy.regexDescription || 'Must match regex policy')
    } catch {
      // Ignore invalid regex on client; server will enforce
    }
  }
  return { ok: fails.length === 0, fails }
}

function PolicyTooltip({ policy }: { policy: PasswordPolicy }) {
  const [open, setOpen] = React.useState(false)
  return (
    <span style={{position:'relative', display:'inline-block'}}
      onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      <button type="button" aria-label="Password policy" title="Password policy"
        style={{
          width:18, height:18, borderRadius:999, border:'1px solid #94a3b8',
          background:'#f8fafc', color:'#334155', fontSize:12, lineHeight:'16px', textAlign:'center', cursor:'help', padding:0
        }}>?
      </button>
      {open && (
        <div role="tooltip" style={{
          position:'absolute', top:'120%', left:0, zIndex:10,
          background:'#0f172a', color:'white', padding:'8px 10px', borderRadius:8,
          fontSize:12, minWidth:240, boxShadow:'0 6px 18px rgba(0,0,0,0.2)'
        }}>
          <div style={{fontWeight:600, marginBottom:6}}>Password policy</div>
          <ul style={{margin:0, paddingLeft:18}}>
            <li>Min length: {policy.minLength}</li>
            {policy.requireUpper && <li>Uppercase letter</li>}
            {policy.requireLower && <li>Lowercase letter</li>}
            {policy.requireDigit && <li>Digit</li>}
            {policy.requireSpecial && <li>Special character</li>}
            {policy.regexPattern && (
              <li>
                Must match pattern{policy.regexDescription ? `: ${policy.regexDescription}` : ''}
              </li>
            )}
          </ul>
        </div>
      )}
    </span>
  )
}

function PasswordChecklist({ password, policy }: { password: string; policy: PasswordPolicy }) {
  const res = React.useMemo(() => checkPassword(password, policy), [password, policy])
  if (!password) return <div style={{fontSize:12, color:'#64748b'}}>Enter a password to see validation.</div>
  return res.ok ? (
    <div style={{fontSize:12, color:'#10b981'}}>Password meets policy.</div>
  ) : (
    <div style={{fontSize:12, color:'#b91c1c'}}>Missing: {res.fails.join(', ')}.</div>
  )
}
