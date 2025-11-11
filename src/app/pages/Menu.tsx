import React from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listLists, type ListViewDefinition } from '../api/metadata'
import { useAuth } from '../auth/store'

export default function Menu() {
  const { tenantId, token } = useAuth()
  const tId = tenantId || 't1'
  const { data: lists, isLoading } = useQuery({ queryKey: ['lists', tId], queryFn: () => listLists(tId, token || undefined) })

  const staticItems = [
    { to: '/designer/entities', label: 'Entities' },
    { to: '/designer/forms', label: 'Forms' },
    { to: '/designer/workflow', label: 'Workflows' },
    { to: '/designer/audit', label: 'Audit' }
  ]

  return (
    <div>
      <h2>Navigation</h2>
      <p style={{fontSize:12, color:'#64748b'}}>Core design areas plus generated List views.</p>
      <ul style={{listStyle:'none', padding:0, display:'grid', gap:6, marginTop:12}}>
        {staticItems.map(i => (
          <li key={i.to}>
            <NavLink to={i.to} style={({isActive}) => ({
              padding:'6px 10px',
              display:'inline-block',
              borderRadius:6,
              textDecoration:'none',
              background: isActive ? '#0d9488' : '#e2e8f0',
              color: isActive ? 'white' : '#334155',
              fontSize:13,
              fontWeight:500
            })}>{i.label}</NavLink>
          </li>
        ))}
      </ul>
      <div style={{marginTop:20}}>
        <h3 style={{fontSize:14, margin:'4px 0'}}>Lists</h3>
        {isLoading && <div style={{fontSize:12, color:'#64748b'}}>Loading…</div>}
        {!isLoading && (lists||[]).length === 0 && <div style={{fontSize:12, color:'#64748b'}}>No lists yet. Create one under Lists.</div>}
        <ul style={{listStyle:'none', padding:0, display:'grid', gap:4}}>
          {(lists||[]).map((l: ListViewDefinition) => (
            <li key={l.code}>
              <NavLink to={`/designer/lists?code=${encodeURIComponent(l.code)}`} style={({isActive}) => ({
                padding:'4px 8px',
                display:'inline-block',
                borderRadius:6,
                textDecoration:'none',
                background: isActive ? '#6366f1' : '#f1f5f9',
                color: isActive ? 'white' : '#1e293b',
                fontSize:12,
                fontWeight:500
              })}>{l.name || l.code}</NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
