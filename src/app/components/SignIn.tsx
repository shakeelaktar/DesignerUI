import React from 'react'
import { useAuth } from '../auth/store'

export default function SignInBox() {
  const { token, userId, tenantId, signingIn, error, signIn, signOut } = useAuth()
  const [tId, setTId] = React.useState(tenantId || 't1')
  const [uId, setUId] = React.useState(userId || 'admin@t1')
  const [pwd, setPwd] = React.useState('Abcd@1234')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await signIn({ tenantId: tId, userId: uId, password: pwd })
  }

  return (
    <div style={{border:'1px solid #e5e7eb', padding:12, borderRadius:8}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <strong>Sign in</strong>
        {token && <span style={{fontSize:12, color:'#10b981'}}>Signed in</span>}
      </div>
      {!token ? (
        <form onSubmit={onSubmit} style={{display:'grid', gap:8, marginTop:8}}>
          <label>Tenant
            <input value={tId} onChange={e=>setTId(e.target.value)} placeholder="t1" />
          </label>
          <label>User
            <input value={uId} onChange={e=>setUId(e.target.value)} placeholder="admin@t1" />
          </label>
          <label>Password
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} />
          </label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
            {error && <span style={{color:'crimson', fontSize:12}}>{error}</span>}
          </div>
        </form>
      ) : (
        <div style={{display:'flex', gap:12, alignItems:'center', marginTop:8}}>
          <div style={{fontSize:12, color:'#555'}}>Tenant: {tenantId} • User: {userId}</div>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}
