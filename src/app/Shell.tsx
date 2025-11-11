import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth/store'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const loc = useLocation()
  const active = loc.pathname.startsWith(to)
  return (
    <Link to={to} style={{
      padding: '6px 10px',
      borderRadius: 6,
      textDecoration: 'none',
      color: active ? '#111' : '#333',
      background: active ? '#e9eef5' : 'transparent'
    }}>{children}</Link>
  )
}

export default function Shell() {
  const { userId, tenantId, signOut } = useAuth()
  return (
    <div style={{display:'grid', gridTemplateColumns:'220px 1fr', height:'100vh', fontFamily:'Inter, system-ui, Arial'}}>
      <aside style={{borderRight:'1px solid #e5e7eb', padding:12}}>
        <h3 style={{marginTop:8}}>Designer</h3>
        <nav style={{display:'grid', gap:6}}>
          <NavLink to="/designer/entities">Entities</NavLink>
          <NavLink to="/designer/lists">Lists</NavLink>
          <NavLink to="/designer/forms">Forms</NavLink>
          <NavLink to="/designer/pages">Pages</NavLink>
          <NavLink to="/designer/menu">Menu</NavLink>
          <NavLink to="/designer/workflow">Workflow</NavLink>
          <NavLink to="/designer/reports">Reports</NavLink>
          <div style={{height:8}} />
          <NavLink to="/designer/audit">Audit</NavLink>
          <NavLink to="/designer/admin">Admin</NavLink>
        </nav>
      </aside>
      <div style={{display:'grid', gridTemplateRows:'52px 1fr'}}>
        <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid #e5e7eb'}}>
          <div style={{fontWeight:600}}>XStudio Designer</div>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{fontSize:12, color:'#475569'}}>Tenant: {tenantId} • User: {userId}</div>
            <button onClick={signOut} style={{padding:'6px 10px'}}>Sign out</button>
          </div>
        </header>
        <main style={{padding:16, overflow:'auto'}}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
