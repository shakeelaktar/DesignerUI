import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEntities, listLists, upsertList, deleteList, type EntitySchema, type ListViewDefinition, type ListColumn, type ListSort, type ListFilter } from '../api/metadata'
import { useAuth } from '../auth/store'

type Step = 0 | 1 | 2 | 3 | 4 | 5

function isValidCode(code: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(code)
}

function isValidExpr(expr: string): boolean {
  return /^[a-zA-Z0-9_.>_-]+(->[a-zA-Z0-9_.>_-]+)*$/.test(expr)
}

type WizardDraft = {
  code: string
  name: string
  entityName: string
  columns: ListColumn[]
  sorts: ListSort[]
  filters: ListFilter[]
  pageSize: number
  version: number
  isPublished: boolean
}

const emptyDraft: WizardDraft = {
  code: '',
  name: '',
  entityName: '',
  columns: [],
  sorts: [],
  filters: [],
  pageSize: 50,
  version: 1,
  isPublished: false,
}

export default function Lists() {
  const { tenantId, token } = useAuth()
  const tId = tenantId || 't1'
  const qc = useQueryClient()

  const { data: entities } = useQuery({ queryKey: ['entities', tId], queryFn: () => listEntities(tId, token || undefined) })
  const { data: lists, isLoading: listsLoading, refetch: refetchLists } = useQuery({ queryKey: ['lists', tId], queryFn: () => listLists(tId, token || undefined) })

  const [step, setStep] = React.useState<Step>(0)
  const [showWizard, setShowWizard] = React.useState(false)
  const [editingCode, setEditingCode] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<WizardDraft>({ ...emptyDraft })
  const [error, setError] = React.useState<string>('')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenantId: tId,
        code: draft.code.trim(),
        name: draft.name.trim(),
        entityName: draft.entityName.trim(),
        columns: draft.columns,
        sorts: draft.sorts,
        filters: draft.filters,
        pageSize: draft.pageSize,
        version: draft.version,
        isPublished: draft.isPublished,
      }
      return await upsertList(payload, token || undefined)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists', tId] })
      setShowWizard(false)
      setEditingCode(null)
      setDraft({ ...emptyDraft })
      setStep(0)
    },
    onError: async (e: any) => {
      setError(e?.message || 'Failed to save list')
    }
  })

  const delMutation = useMutation({
    mutationFn: async (code: string) => await deleteList(tId, code, token || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists', tId] })
  })

  function startCreate() {
    setDraft({ ...emptyDraft })
    setEditingCode(null)
    setStep(0)
    setError('')
    setShowWizard(true)
  }

  function startEdit(code: string) {
    const cur = (lists || []).find(l => l.code === code)
    if (!cur) return
    const d: WizardDraft = {
      code: cur.code,
      name: cur.name,
      entityName: cur.entityName,
      columns: cur.columns || [],
      sorts: cur.sorts || [],
      filters: cur.filters || [],
      pageSize: cur.pageSize || 50,
      version: cur.version || 1,
      isPublished: !!cur.isPublished,
    }
    setDraft(d)
    setEditingCode(code)
    setStep(0)
    setError('')
    setShowWizard(true)
  }

  function cancelWizard() {
    setShowWizard(false)
    setEditingCode(null)
    setError('')
    setStep(0)
  }

  function next() {
    setError('')
    // simple per-step validation
    if (step === 0) {
      if (!isValidCode(draft.code)) { setError('Code must start with a letter and contain only letters, numbers, _ or - (2-64 chars).'); return }
      if (!draft.name.trim()) { setError('Name is required.'); return }
      if (!draft.entityName.trim()) { setError('Primary entity is required.'); return }
      // uniqueness check on create
      if (!editingCode) {
        const exists = (lists || []).some(l => l.code.toLowerCase() === draft.code.trim().toLowerCase())
        if (exists) { setError('A list with this code already exists. Choose another.'); return }
      }
    }
    if (step === 1) {
      if ((draft.columns || []).length === 0) { setError('Add at least one column.'); return }
      for (const c of draft.columns) {
        if (!c.title?.trim()) { setError('Column title is required.'); return }
        if (!isValidExpr(c.expression || '')) { setError(`Invalid column expression '${c.expression}'.`); return }
      }
    }
    if (step === 2) {
      for (const s of draft.sorts) {
        if (!isValidExpr(s.expression || '')) { setError(`Invalid sort expression '${s.expression}'.`); return }
      }
    }
    if (step === 3) {
      for (const f of draft.filters) {
        if (!isValidExpr(f.expression || '')) { setError(`Invalid filter expression '${f.expression}'.`); return }
      }
    }
    setStep((s) => Math.min(5, (s + 1) as Step))
  }

  function back() { setError(''); setStep((s)=> Math.max(0, (s-1) as Step)) }

  function addColumn() {
    setDraft(d => ({ ...d, columns: [...d.columns, { title: '', expression: '', format: null, width: null }] }))
  }
  function removeColumn(idx: number) {
    setDraft(d => ({ ...d, columns: d.columns.filter((_,i)=>i!==idx) }))
  }
  function addSort() { setDraft(d => ({ ...d, sorts: [...d.sorts, { expression: '', direction: 'Asc' }] })) }
  function removeSort(idx: number) { setDraft(d => ({ ...d, sorts: d.sorts.filter((_,i)=>i!==idx) })) }
  function addFilter() { setDraft(d => ({ ...d, filters: [...d.filters, { expression: '', operator: 'Eq', value: '' }] })) }
  function removeFilter(idx: number) { setDraft(d => ({ ...d, filters: d.filters.filter((_,i)=>i!==idx) })) }

  function StepHeader() {
    const steps = ['Basics', 'Columns', 'Sorts', 'Filters', 'Options', 'Review']
    return (
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
        {steps.map((label, i)=>{
          const active = i === step
          const done = i < step
          return (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:26, height:26, borderRadius:13, background: active? '#2563eb' : done? '#10b981' : '#e5e7eb', color: active||done? '#fff':'#111', display:'grid', placeItems:'center', fontWeight:600 }}>{i+1}</div>
              <div style={{ fontWeight: active? 600: 500 }}>{label}</div>
              {i < steps.length - 1 && <div style={{ width:24, height:2, background:'#e5e7eb', margin:'0 8px' }} />}
            </div>
          )
        })}
      </div>
    )
  }

  function BasicsStep() {
    return (
      <div style={{ display:'grid', gap:12 }}>
        <div>
          <label>Code</label>
          <input value={draft.code} onChange={e=> setDraft(d=>({ ...d, code: e.target.value }))} placeholder="e.g. customers" />
        </div>
        <div>
          <label>Name</label>
          <input value={draft.name} onChange={e=> setDraft(d=>({ ...d, name: e.target.value }))} placeholder="Display name" />
        </div>
        <div>
          <label>Primary Entity</label>
          <select value={draft.entityName} onChange={e=> setDraft(d=>({ ...d, entityName: e.target.value }))}>
            <option value="">— Select —</option>
            {(entities||[]).map((e: EntitySchema)=> <option key={e.entityName} value={e.entityName}>{e.displayName || e.entityName}</option>)}
          </select>
        </div>
      </div>
    )
  }

  function ColumnsStep() {
    return (
      <div>
        <div style={{ marginBottom:8 }}>
          <button type="button" onClick={addColumn}>+ Add column</button>
          <span style={{ marginLeft:8, color:'#6b7280' }}>Expression can be field or chained relation like customerId-&gt;firstName</span>
        </div>
        {(draft.columns||[]).length === 0 && <div style={{ color:'#6b7280' }}>No columns yet.</div>}
        <div style={{ display:'grid', gap:10 }}>
          {draft.columns.map((c, idx)=> (
            <div key={idx} style={{ border:'1px solid #e5e7eb', padding:10, borderRadius:8, display:'grid', gap:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'center' }}>
                <input value={c.title} onChange={e=> setDraft(d=>({ ...d, columns: d.columns.map((x,i)=> i===idx? { ...x, title: e.target.value }: x) }))} placeholder="Title" />
                <input value={c.expression} onChange={e=> setDraft(d=>({ ...d, columns: d.columns.map((x,i)=> i===idx? { ...x, expression: e.target.value }: x) }))} placeholder="Expression (e.g. firstName or customerId->firstName)" />
                <input value={c.format || ''} onChange={e=> setDraft(d=>({ ...d, columns: d.columns.map((x,i)=> i===idx? { ...x, format: e.target.value || null }: x) }))} placeholder="Format (optional)" />
                <input type="number" value={c.width ?? ''} onChange={e=> setDraft(d=>({ ...d, columns: d.columns.map((x,i)=> i===idx? { ...x, width: e.target.value? Number(e.target.value): null }: x) }))} placeholder="Width" />
                <button type="button" onClick={()=> removeColumn(idx)} style={{ marginLeft:8 }}>Remove</button>
              </div>
              {!isValidExpr(c.expression || '') && <div style={{ color:'#b91c1c' }}>Invalid expression</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function SortsStep() {
    return (
      <div>
        <div style={{ marginBottom:8 }}>
          <button type="button" onClick={addSort}>+ Add sort</button>
        </div>
        {(draft.sorts||[]).length === 0 && <div style={{ color:'#6b7280' }}>No sorts.</div>}
        <div style={{ display:'grid', gap:10 }}>
          {draft.sorts.map((s, idx)=> (
            <div key={idx} style={{ border:'1px solid #e5e7eb', padding:10, borderRadius:8, display:'grid', gap:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:8, alignItems:'center' }}>
                <input value={s.expression} onChange={e=> setDraft(d=>({ ...d, sorts: d.sorts.map((x,i)=> i===idx? { ...x, expression: e.target.value }: x) }))} placeholder="Expression" />
                <select value={s.direction} onChange={e=> setDraft(d=>({ ...d, sorts: d.sorts.map((x,i)=> i===idx? { ...x, direction: e.target.value as any }: x) }))}>
                  <option value="Asc">Asc</option>
                  <option value="Desc">Desc</option>
                </select>
                <button type="button" onClick={()=> removeSort(idx)}>Remove</button>
              </div>
              {!isValidExpr(s.expression || '') && <div style={{ color:'#b91c1c' }}>Invalid expression</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function FiltersStep() {
    const ops = ['Eq','Ne','Gt','Ge','Lt','Le','Contains','StartsWith','EndsWith','In']
    return (
      <div>
        <div style={{ marginBottom:8 }}>
          <button type="button" onClick={addFilter}>+ Add filter</button>
        </div>
        {(draft.filters||[]).length === 0 && <div style={{ color:'#6b7280' }}>No filters.</div>}
        <div style={{ display:'grid', gap:10 }}>
          {draft.filters.map((f, idx)=> (
            <div key={idx} style={{ border:'1px solid #e5e7eb', padding:10, borderRadius:8, display:'grid', gap:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 2fr auto', gap:8, alignItems:'center' }}>
                <input value={f.expression} onChange={e=> setDraft(d=>({ ...d, filters: d.filters.map((x,i)=> i===idx? { ...x, expression: e.target.value }: x) }))} placeholder="Expression" />
                <select value={f.operator} onChange={e=> setDraft(d=>({ ...d, filters: d.filters.map((x,i)=> i===idx? { ...x, operator: e.target.value }: x) }))}>
                  {ops.map(o=> <option key={o} value={o}>{o}</option>)}
                </select>
                <input value={f.value || ''} onChange={e=> setDraft(d=>({ ...d, filters: d.filters.map((x,i)=> i===idx? { ...x, value: e.target.value }: x) }))} placeholder="Value (optional)" />
                <button type="button" onClick={()=> removeFilter(idx)}>Remove</button>
              </div>
              {!isValidExpr(f.expression || '') && <div style={{ color:'#b91c1c' }}>Invalid expression</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function OptionsStep() {
    return (
      <div style={{ display:'grid', gap:12 }}>
        <div>
          <label>Page Size</label>
          <input type="number" min={1} max={1000} value={draft.pageSize} onChange={e=> setDraft(d=>({ ...d, pageSize: Math.max(1, Math.min(1000, Number(e.target.value||'50'))) }))} />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input id="isPublished" type="checkbox" checked={draft.isPublished} onChange={e=> setDraft(d=>({ ...d, isPublished: e.target.checked }))} />
          <label htmlFor="isPublished">Published</label>
        </div>
      </div>
    )
  }

  function ReviewStep() {
    const preview: Partial<ListViewDefinition> = {
      tenantId: tId,
      code: draft.code.trim(),
      name: draft.name.trim(),
      entityName: draft.entityName.trim(),
      columns: draft.columns,
      sorts: draft.sorts,
      filters: draft.filters,
      pageSize: draft.pageSize,
      version: draft.version,
      isPublished: draft.isPublished,
    }
    return (
      <div>
        <p>Review and save your list. You can go back to adjust any step.</p>
        <pre style={{ background:'#0b1020', color:'#d1d5db', padding:12, borderRadius:8, overflow:'auto', maxHeight:320 }}>{JSON.stringify(preview, null, 2)}</pre>
      </div>
    )
  }

  function Wizard() {
    return (
      <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:16, background:'#fff', maxWidth:980 }}>
        <StepHeader />
        {error && <div style={{ color:'#b91c1c', marginBottom:8 }}>{error}</div>}
        {step === 0 && <BasicsStep />}
        {step === 1 && <ColumnsStep />}
        {step === 2 && <SortsStep />}
        {step === 3 && <FiltersStep />}
        {step === 4 && <OptionsStep />}
        {step === 5 && <ReviewStep />}
        <div style={{ display:'flex', gap:8, justifyContent:'space-between', marginTop:16 }}>
          <div>
            <button type="button" onClick={cancelWizard}>Cancel</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={back} disabled={step===0}>Back</button>
            {step < 5 && <button type="button" onClick={next}>Next</button>}
            {step === 5 && <button type="button" onClick={()=> saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending? 'Saving…':'Save'}</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>Lists</h2>
      <p>Create list views mapped to a primary entity. Include related fields via chain expressions like customerId-&gt;firstName.</p>

      {!showWizard && (
        <div style={{ margin:'12px 0' }}>
          <button type="button" onClick={startCreate}>+ New List</button>
        </div>
      )}

      {showWizard ? (
        <Wizard />
      ) : (
        <div>
          {listsLoading ? <div>Loading…</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'6px 4px', borderBottom:'1px solid #e5e7eb' }}>Code</th>
                  <th style={{ textAlign:'left', padding:'6px 4px', borderBottom:'1px solid #e5e7eb' }}>Name</th>
                  <th style={{ textAlign:'left', padding:'6px 4px', borderBottom:'1px solid #e5e7eb' }}>Entity</th>
                  <th style={{ textAlign:'left', padding:'6px 4px', borderBottom:'1px solid #e5e7eb' }}>Columns</th>
                  <th style={{ textAlign:'left', padding:'6px 4px', borderBottom:'1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(lists||[]).length === 0 && (
                  <tr><td colSpan={5} style={{ padding:8, color:'#6b7280' }}>No lists yet.</td></tr>
                )}
                {(lists||[]).map((l: ListViewDefinition)=> (
                  <tr key={l.code}>
                    <td style={{ padding:'6px 4px', borderBottom:'1px solid #f3f4f6' }}>{l.code}</td>
                    <td style={{ padding:'6px 4px', borderBottom:'1px solid #f3f4f6' }}>{l.name}</td>
                    <td style={{ padding:'6px 4px', borderBottom:'1px solid #f3f4f6' }}>{l.entityName}</td>
                    <td style={{ padding:'6px 4px', borderBottom:'1px solid #f3f4f6' }}>{(l.columns||[]).map(c=>c.title).join(', ')}</td>
                    <td style={{ padding:'6px 4px', borderBottom:'1px solid #f3f4f6' }}>
                      <button type="button" onClick={()=> startEdit(l.code)} style={{ marginRight:8 }}>Edit</button>
                      <button type="button" onClick={()=> delMutation.mutate(l.code)} disabled={delMutation.isPending}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
