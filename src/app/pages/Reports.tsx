import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { listEntities, listFields, type EntitySchema, type FieldInfo } from '../api/metadata'
import { listRecords, type RuntimeRecord } from '../api/runtime'
import { useAuth } from '../auth/store'

export default function Reports() {
  const { tenantId, token, userId } = useAuth()
  const tId = tenantId || 'tenant-001'
  const { data: entities, isLoading: entsLoading, error: entsError } = useQuery({
    queryKey: ['entities', tId],
    queryFn: () => listEntities(tId, token || undefined)
  })

  const [selectedEntity, setSelectedEntity] = React.useState<string>('')
  const [fields, setFields] = React.useState<FieldInfo[]>([])
  const [selectedFields, setSelectedFields] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<RuntimeRecord[]>([])
  const [loadingPreview, setLoadingPreview] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectedEntity) {
      setFields([]); setSelectedFields([])
      return
    }
    (async () => {
      try {
        setError(null)
        const list = await listFields(tId, selectedEntity, token || undefined)
        setFields(list)
        // Default to show first 3 non-system fields if none selected
        if (selectedFields.length === 0) {
          const sys = new Set(['Identifier','CreatedOn','CreatedBy','UpdatedOn','UpdatedBy','IsDeleted'])
          const picks = list.filter(f => !sys.has(f.name)).slice(0, 3).map(f => f.name)
          setSelectedFields(picks)
        }
      } catch (e: any) {
        setError(e.message || String(e))
      }
    })()
  }, [selectedEntity, tId, token])

  async function preview() {
    if (!selectedEntity) return
    setLoadingPreview(true)
    setError(null)
    try {
      const res = await listRecords({ tenantId: tId, entityName: selectedEntity, pageSize: 20, token: token || undefined, userId: userId || undefined })
      setRows(res.records)
    } catch (e: any) {
      setError(e.message || String(e))
      setRows([])
    } finally {
      setLoadingPreview(false)
    }
  }

  const cols = selectedFields.length > 0 ? selectedFields : []

  return (
    <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:12}}>
      <aside style={{borderRight:'1px solid #e5e7eb', paddingRight:12}}>
        <h3>Dataset</h3>
        <div style={{fontSize:12, color:'#64748b'}}>Choose entity and fields</div>
        {entsLoading && <div style={{fontSize:12}}>Loading entities…</div>}
        {entsError && <div style={{color:'crimson', fontSize:12}}>Failed to load entities</div>}
        <label style={{display:'grid', gap:4, marginTop:8}}>Entity
          <select value={selectedEntity} onChange={e=>setSelectedEntity(e.target.value)}>
            <option value="">—</option>
            {(entities||[]).map((e: EntitySchema) => (
              <option key={e.entityName} value={e.entityName}>{e.entityName}</option>
            ))}
          </select>
        </label>
        <label style={{display:'grid', gap:4, marginTop:8}}>Fields
          <select multiple size={8} value={selectedFields} onChange={e=>{
            const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
            setSelectedFields(opts)
          }}>
            {fields.map(f => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
        </label>
        <button style={{marginTop:8}} onClick={preview} disabled={!selectedEntity || loadingPreview}>{loadingPreview ? 'Loading…' : 'Preview'}</button>
        {error && <div style={{color:'crimson', fontSize:12, marginTop:8}}>{error}</div>}
      </aside>
      <section>
        <h2>Preview</h2>
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, height:'60vh', overflow:'auto', padding:8}}>
          {!selectedEntity && <div style={{color:'#64748b'}}>Select an entity to preview.</div>}
          {selectedEntity && rows.length === 0 && !loadingPreview && <div style={{color:'#64748b'}}>No data.</div>}
          {selectedEntity && rows.length > 0 && (
            <table style={{borderCollapse:'collapse', width:'100%'}}>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c} style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 8px'}}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    {cols.map(c => (
                      <td key={c} style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>{formatCell(r.fields[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function formatCell(val: any) {
  if (val == null) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
