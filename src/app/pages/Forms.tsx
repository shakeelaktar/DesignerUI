import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEntities, listFields, listForms, upsertForm, type EntitySchema, type FieldInfo, type FormField } from '../api/metadata'
import { useAuth } from '../auth/store'

export default function Forms() {
  const { tenantId, token } = useAuth()
  const tId = tenantId || 't1'
  const qc = useQueryClient()

  const { data: entities } = useQuery({ queryKey: ['entities', tId], queryFn: () => listEntities(tId, token || undefined) })
  const [selectedEntity, setSelectedEntity] = React.useState<string>('')
  const { data: fields } = useQuery({ queryKey: ['fields', tId, selectedEntity], queryFn: () => selectedEntity? listFields(tId, selectedEntity, token || undefined) : Promise.resolve([] as FieldInfo[]) })
  const { data: forms } = useQuery({ queryKey: ['forms', tId], queryFn: () => listForms(tId, token || undefined) })

  const [name, setName] = React.useState('ContactForm')
  const [displayName, setDisplayName] = React.useState('Contact Form')
  const [controls, setControls] = React.useState<FormField[]>([])
  const [selectedField, setSelectedField] = React.useState<string>('')
  const [label, setLabel] = React.useState<string>('')
  const [required, setRequired] = React.useState<boolean>(false)

  const saveMut = useMutation({
    mutationFn: () => upsertForm({ tenantId: tId, name, displayName, fields: controls }, token || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms', tId] }) }
  })

  function addControl() {
    if (!selectedField) return
    const f = (fields || []).find(x => x.name === selectedField)
    let config: Record<string, any> | undefined = undefined
    try {
      if (f?.metaJson) {
        const parsed = JSON.parse(f.metaJson)
        if (parsed.picklist) config = { picklist: parsed.picklist }
        if (parsed.relationship) config = { ...(config||{}), relationship: parsed.relationship }
        if (parsed.autoNumber) config = { ...(config||{}), autoNumber: parsed.autoNumber }
      }
    } catch {}
    const control: FormField = { fieldName: selectedField, label: label || selectedField, controlType: mapFieldToControl(f?.dataType || 'Text'), required, dataType: f?.dataType, config }
    setControls(arr => [...arr, control])
    setSelectedField(''); setLabel(''); setRequired(false)
  }

  function removeControl(idx: number) { setControls(arr => arr.filter((_,i)=>i!==idx)) }

  return (
    <div style={{display:'grid', gridTemplateColumns:'260px 1fr 320px', gap:12, height:'calc(100vh - 52px - 32px)'}}>
      <aside style={{borderRight:'1px solid #e5e7eb', paddingRight:12}}>
        <h3>Form Builder</h3>
        <label>Form name
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="ContactForm" />
        </label>
        <label>Display name
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Contact Form" />
        </label>
        <label>Entity
          <select value={selectedEntity} onChange={e=>setSelectedEntity(e.target.value)}>
            <option value="">—</option>
            {(entities||[]).map((e: EntitySchema)=> <option key={e.entityName} value={e.entityName}>{e.entityName}</option>)}
          </select>
        </label>
        <div style={{marginTop:8}}>
          <div style={{fontWeight:600, marginBottom:6}}>Add field</div>
          <select value={selectedField} onChange={e=>setSelectedField(e.target.value)}>
            <option value="">—</option>
            {(fields||[]).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label (optional)" />
          <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)} /> required
          </label>
          <div>
            <button onClick={addControl}>Add to form</button>
          </div>
        </div>
        <div style={{marginTop:12}}>
          <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending? 'Saving…' : 'Save form'}</button>
          {saveMut.isError && <div style={{color:'crimson', fontSize:12}}>Save failed{(saveMut.error as any)?.message?`: ${(saveMut.error as any).message}`:''}</div>}
          {saveMut.isSuccess && <div style={{color:'#10b981', fontSize:12}}>Saved</div>}
        </div>
        <div style={{marginTop:16}}>
          <h4>Existing forms</h4>
          <ul>
            {(forms||[]).map(f => <li key={f.id}><code>{f.name}</code> v{f.version}</li>)}
          </ul>
        </div>
      </aside>
      <section style={{border:'1px dashed #cbd5e1', borderRadius:8, background:'#f8fafc'}}>
        <div style={{padding:12, color:'#475569'}}>Preview</div>
        <div style={{padding:12, display:'grid', gap:8, maxWidth:560}}>
          {controls.length === 0 && <div style={{color:'#64748b', fontSize:12}}>No controls yet. Add fields from the left.</div>}
          {controls.map((c, i) => (
            <div key={i} style={{display:'grid', gap:6}}>
              <label>{c.label}{c.required?'*':''}
                <input placeholder={c.fieldName} disabled />
              </label>
              {c.config?.picklist && (
                <div style={{fontSize:11, color:'#475569'}}>
                  Options: {(c.config.picklist.options||[]).map((o:any)=>o.label||o.value).join(', ')}
                </div>
              )}
              {c.config?.relationship && (
                <div style={{fontSize:11, color:'#475569'}}>
                  Rel → {c.config.relationship.targetEntity}{c.config.relationship.displayField?` (${c.config.relationship.displayField})`:''}
                </div>
              )}
              <button style={{width:'fit-content'}} onClick={()=>removeControl(i)}>Remove</button>
            </div>
          ))}
        </div>
      </section>
      <aside style={{borderLeft:'1px solid #e5e7eb', paddingLeft:12}}>
        <h3>Properties</h3>
        <div style={{fontSize:12, color:'#64748b'}}>Select a control to edit properties. (Coming soon)</div>
      </aside>
    </div>
  )
}

function mapFieldToControl(dataType: string): string {
  const map: Record<string,string> = {
    Text: 'TextBox',
    Number: 'NumberInput',
    Checkbox: 'Checkbox',
    Date: 'DatePicker'
  }
  return map[dataType] || 'TextBox'
}
