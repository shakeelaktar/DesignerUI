import React from 'react'
import { useAuth } from '../auth/store'
import { listForms, listFields, listEntities, type FormDefinition } from '../api/metadata'
import { lookupSearch } from '../api/runtime'
import { createRecord } from '../api/runtime'

export default function Runtime() {
  const { tenantId, token } = useAuth()
  const tId = tenantId || 't1'
  const [forms, setForms] = React.useState<FormDefinition[]>([])
  const [entities, setEntities] = React.useState<any[]>([])
  const [entityName, setEntityName] = React.useState('')
  const [selectedFormId, setSelectedFormId] = React.useState<string>('')
  const [fields, setFields] = React.useState<any[]>([])
  const [payload, setPayload] = React.useState<Record<string, any>>({})
  const [status, setStatus] = React.useState<string>('')

  React.useEffect(() => { (async()=>{
    try {
      const f = await listForms(tId, token || undefined)
      setForms(f)
      const ents = await listEntities(tId, token || undefined)
      setEntities(ents)
    } catch (e:any) { setStatus(e.message || String(e)) }
  })() }, [tId, token])

  React.useEffect(() => { (async()=>{
    if (!entityName) { setFields([]); return }
    const list = await listFields(tId, entityName, token || undefined)
    setFields(list)
  })() }, [tId, entityName, token])

  function onChange(name: string, val: any) {
    setPayload(p => ({ ...p, [name]: val }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('')
    if (!entityName) { setStatus('Choose entity'); return }
    try {
  const res = await createRecord({ tenantId: tId, entityName, payload, token: token || undefined, userId: 'designer-user' })
      setStatus(`Created recordId=${res.recordId}`)
      setPayload({})
    } catch (e:any) {
      setStatus(e.message || String(e))
    }
  }

  const form = forms.find(f => f.id === selectedFormId)

  return (
    <div>
      <h2>Runtime Form</h2>
      <p style={{fontSize:12, color:'#64748b'}}>Pick a form, fill it, and submit to create a record.</p>
      {status && <div style={{marginTop:8, color: status.startsWith('Created')? '#10b981' : 'crimson'}}>{status}</div>}
      <div style={{display:'flex', gap:12, alignItems:'center', marginTop:8}}>
        <label>Entity
          <select value={entityName} onChange={e=>setEntityName(e.target.value)}>
            <option value="">—</option>
            {entities.map((e:any)=> <option key={e.entityName} value={e.entityName}>{e.entityName}</option>)}
          </select>
        </label>
        <label>Form
          <select value={selectedFormId} onChange={e=>setSelectedFormId(e.target.value)}>
            <option value="">—</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.displayName} (v{f.version})</option>)}
          </select>
        </label>
      </div>
      <form onSubmit={onSubmit} style={{display:'grid', gap:10, marginTop:12, maxWidth:560}}>
        {!form && <div style={{color:'#64748b', fontSize:12}}>Select a form</div>}
        {form && form.fields.map((c, i) => {
          const val = payload[c.fieldName]
          const cfg = c.config || {}
          const dt = (c.dataType || '').toLowerCase()
          const isPicklist = dt === 'picklist'
          const isMultiPicklist = dt === 'multipicklist'
          const isLookup = dt === 'lookup' || dt === 'externallookup'
          if (isPicklist) {
            const options: string[] = Array.isArray(cfg.options)? cfg.options : []
            return (
              <label key={i}>{c.label}{c.required?'*':''}
                <select value={val || ''} required={!!c.required} onChange={e=>onChange(c.fieldName, e.target.value)}>
                  <option value="">—</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            )
          }
          if (isMultiPicklist) {
            return (
              <MultiPicklistControl key={i} label={c.label} required={!!c.required} options={Array.isArray(cfg.options)? cfg.options : []} value={Array.isArray(val)? val : []} onChange={v=>onChange(c.fieldName, v)} />
            )
          }
          if (isLookup) {
            const rel = cfg.relationship || {}
            const targetEntity: string | undefined = rel.targetEntity
            const displayField: string | undefined = rel.displayField || rel.targetDisplayField || 'name'
            return (
              <LookupControl key={i} label={c.label} required={!!c.required} tenantId={tId} token={token || undefined} targetEntity={targetEntity} displayField={displayField} value={val} onChange={v=>onChange(c.fieldName, v)} />
            )
          }
          return (
            <label key={i}>{c.label}{c.required?'*':''}
              <input value={val || ''} onChange={e=>onChange(c.fieldName, e.target.value)} placeholder={c.fieldName} required={!!c.required} />
            </label>
          )
        })}
        <div>
          <button type="submit">Submit</button>
        </div>
      </form>
    </div>
  )
}

function MultiPicklistControl(props: { label: string; required?: boolean; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const { label, required, options, value, onChange } = props
  function toggle(opt: string) {
    const next = value.includes(opt) ? value.filter(x=>x!==opt) : [...value, opt]
    onChange(next)
  }
  return (
    <fieldset style={{border:'1px solid #e2e8f0', padding:8}}>
      <legend style={{fontSize:12}}>{label}{required?'*':''}</legend>
      <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
        {options.map(o => (
          <label key={o} style={{display:'flex', alignItems:'center', gap:4}}>
            <input type="checkbox" checked={value.includes(o)} onChange={()=>toggle(o)} /> {o}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function LookupControl(props: {
  label: string
  required?: boolean
  tenantId: string
  token?: string
  targetEntity?: string
  displayField?: string
  value?: any
  onChange: (v: any) => void
}) {
  const { label, required, tenantId, token, targetEntity, displayField, value, onChange } = props
  const [query, setQuery] = React.useState('')
  const [options, setOptions] = React.useState<any[]>([])
  const [busy, setBusy] = React.useState(false)
  React.useEffect(()=>{
    let cancelled = false
    async function run() {
      if (!targetEntity || !displayField || !query) { setOptions([]); return }
      setBusy(true)
      try {
        const res = await lookupSearch({ tenantId, entityName: targetEntity, displayField, q: query, token })
        if (!cancelled) setOptions(res)
      } catch (e:any) { if (!cancelled) setOptions([]) }
      finally { if (!cancelled) setBusy(false) }
    }
    const handle = setTimeout(run, 250)
    return ()=> { cancelled = true; clearTimeout(handle) }
  }, [query, tenantId, token, targetEntity, displayField])
  return (
    <div style={{display:'grid', gap:4}}>
      <label>{label}{required?'*':''}
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${targetEntity || 'entity'}...`} />
      </label>
      {value && <div style={{fontSize:12, color:'#047857'}}>Selected: {value}</div>}
      <div style={{maxHeight:140, overflowY:'auto', border:'1px solid #e2e8f0', padding:4}}>
        {busy && <div style={{fontSize:12, color:'#64748b'}}>Searching...</div>}
        {!busy && options.length===0 && query && <div style={{fontSize:12, color:'#64748b'}}>No matches</div>}
        {options.map(o => (
          <div key={o.recordId} style={{cursor:'pointer', padding:4, borderRadius:4, background: value===o.recordId? '#d1fae5':'transparent'}} onClick={()=>onChange(o.recordId)}>
            <strong style={{fontSize:12}}>{o.display}</strong>
            <div style={{fontSize:10, color:'#64748b'}}>{o.recordId}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
