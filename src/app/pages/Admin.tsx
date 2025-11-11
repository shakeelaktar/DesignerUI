import React from 'react'
import { approveTenant, approveUser } from '../api/idp'
import { useAuth } from '../auth/store'

export default function Admin() {
  const { token } = useAuth()
  const [tenantToApprove, setTenantToApprove] = React.useState('t1')
  const [userTenant, setUserTenant] = React.useState('t1')
  const [userId, setUserId] = React.useState('admin@t1')
  const [tMsg, setTMsg] = React.useState<string | null>(null)
  const [uMsg, setUMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function doApproveTenant(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setErr('Sign in as Admin first'); return }
    setErr(null); setTMsg(null); setBusy(true)
    try {
      await approveTenant({ tenantId: tenantToApprove, token })
      setTMsg(`Tenant '${tenantToApprove}' approved`)
    } catch (e: any) {
      setErr(e.message || String(e))
    } finally { setBusy(false) }
  }

  async function doApproveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setErr('Sign in as Admin first'); return }
    setErr(null); setUMsg(null); setBusy(true)
    try {
      await approveUser({ tenantId: userTenant, userId, token })
      setUMsg(`User '${userId}' approved in tenant '${userTenant}'`)
    } catch (e: any) {
      setErr(e.message || String(e))
    } finally { setBusy(false) }
  }

  return (
    <div style={{display:'grid', gap:16}}>
      <h2>Admin</h2>
      <p style={{fontSize:12, color:'#555'}}>Approve tenants and users. Requires an Admin bearer token.</p>
      {!token && <div style={{color:'#b45309'}}>Sign in as an Admin user to perform approvals.</div>}
      {err && <div style={{color:'crimson'}}>{err}</div>}
      <section style={{border:'1px solid #e5e7eb', padding:12, borderRadius:8}}>
        <h3>Approve Tenant</h3>
        <form onSubmit={doApproveTenant} style={{display:'grid', gap:8, marginTop:8}}>
          <label>Tenant Id
            <input value={tenantToApprove} onChange={e=>setTenantToApprove(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>Approve tenant</button>
          {tMsg && <span style={{color:'#10b981', fontSize:12}}>{tMsg}</span>}
        </form>
      </section>
      <section style={{border:'1px solid #e5e7eb', padding:12, borderRadius:8}}>
        <h3>Approve User</h3>
        <form onSubmit={doApproveUser} style={{display:'grid', gap:8, marginTop:8}}>
          <label>Tenant Id
            <input value={userTenant} onChange={e=>setUserTenant(e.target.value)} />
          </label>
          <label>User Id
            <input value={userId} onChange={e=>setUserId(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>Approve user</button>
          {uMsg && <span style={{color:'#10b981', fontSize:12}}>{uMsg}</span>}
        </form>
      </section>
    </div>
  )
}
