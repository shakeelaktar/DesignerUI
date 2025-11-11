import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuditSummary } from '../api/runtime'
import { useAuth } from '../auth/store'
import SignInBox from '../components/SignIn'

function useAuditSummary(state: {
  tenantId: string
  entityName: string
  limit: number
  actionType?: string
  performedBy?: string
  nextPageToken?: string
  token?: string | null
}) {
  const { tenantId, entityName, limit, actionType, performedBy, nextPageToken, token } = state
  return useQuery({
    queryKey: ['audit-summary', tenantId, entityName, limit, actionType, performedBy, nextPageToken, !!token],
    queryFn: () => fetchAuditSummary({ tenantId, entityName, limit, actionType, performedBy, nextPageToken, token: token || undefined }),
    enabled: !!tenantId && !!entityName && !!token,
  })
}

export default function Audit() {
  const qc = useQueryClient()
  const { token } = useAuth()
  const [tenantId, setTenantId] = React.useState('t1')
  const [entityName, setEntityName] = React.useState('ProductSurvey')
  const [limit, setLimit] = React.useState(10)
  const [actionType, setActionType] = React.useState('')
  const [performedBy, setPerformedBy] = React.useState('')
  const [nextToken, setNextToken] = React.useState<string | undefined>(undefined)

  const { data, isLoading, isError, error, refetch, isFetching } = useAuditSummary({
    tenantId,
    entityName,
    limit,
    actionType: actionType || undefined,
    performedBy: performedBy || undefined,
    nextPageToken: nextToken,
    token,
  })

  function applyFilters() {
    setNextToken(undefined)
    qc.removeQueries({ queryKey: ['audit-summary'] })
    refetch()
  }

  function loadMore() {
    if (data?.nextPageToken) {
      setNextToken(data.nextPageToken)
    }
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <h2>Audit Viewer</h2>
      <SignInBox />
      <div style={{display:'flex', gap:12, alignItems:'end', flexWrap:'wrap'}}>
        <label>Tenant
          <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="t1" />
        </label>
        <label>Entity
          <input value={entityName} onChange={e=>setEntityName(e.target.value)} placeholder="ProductSurvey" />
        </label>
        <label>Limit
          <input type="number" value={limit} min={1} max={200} onChange={e=>setLimit(Number(e.target.value)||10)} />
        </label>
        <label>actionType (comma)
          <input value={actionType} onChange={e=>setActionType(e.target.value)} placeholder="create,update" />
        </label>
        <label>performedBy
          <input value={performedBy} onChange={e=>setPerformedBy(e.target.value)} placeholder="admin@t1" />
        </label>
        <button onClick={applyFilters} disabled={isFetching}>Apply</button>
      </div>

      {!token && <div style={{color:'#555'}}>Sign in to view audit data.</div>}
      {isLoading && token && <div>Loading…</div>}
      {isError && token && <div style={{color:'crimson'}}>Error: {(error as Error)?.message}</div>}

      {data && token && (
        <>
          <div style={{fontSize:12, color:'#555'}}>Total: {data.total} • Showing {data.items.length} items</div>
          <table style={{borderCollapse:'collapse', width:'100%', fontSize:14}}>
            <thead>
              <tr>
                <th style={th}>RecordId</th>
                <th style={th}>Action</th>
                <th style={th}>Performed By</th>
                <th style={th}>Created On</th>
                <th style={th}>Δ Changed</th>
                <th style={th}>+ Added</th>
                <th style={th}>- Removed</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.recordId}</td>
                  <td style={td}>{r.actionType}</td>
                  <td style={td}>{r.performedBy}</td>
                  <td style={td}>{new Date(r.createdOn).toLocaleString()}</td>
                  <td style={td}>{r.changed}</td>
                  <td style={td}>{r.added}</td>
                  <td style={td}>{r.removed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:12}}>
            <button onClick={loadMore} disabled={!data.nextPageToken || isFetching}>
              {data.nextPageToken ? 'Load more' : 'End of list'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 8px' }
const td: React.CSSProperties = { borderBottom:'1px solid #f1f5f9', padding:'6px 8px' }
