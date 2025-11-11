import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addField, updateField, createEntity, listDataTypes, listEntities, listFields, seedCoreEntities, type DataTypeDescriptor, type EntitySchema } from '../api/metadata'
import { previewDisplay, getRecordById, listRecords, type DisplayToken } from '../api/runtime'
import { useAuth } from '../auth/store'

type PickOpt = { value: string; label?: string; active?: boolean }
type RelKind = 'Lookup' | 'ExternalLookup' | 'Hierarchy' | 'MasterDetail'
type OnDelete = 'Restrict' | 'Cascade'

export default function Entities() {
  const { tenantId, token } = useAuth()
  const qc = useQueryClient()
  const tId = tenantId || 'tenant-001'
  const { data, isLoading, error } = useQuery({
    queryKey: ['entities', tId],
    queryFn: () => listEntities(tId, token || undefined),
  })
  const { data: types, isError: typesError } = useQuery({ queryKey: ['metadata-datatypes'], queryFn: () => listDataTypes(token || undefined) })
  // List filters/pagination
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const filtered = React.useMemo(() => {
    const src = (data || []) as EntitySchema[]
    const q = search.trim().toLowerCase()
    if (!q) return src
    return src.filter(e =>
      e.entityName.toLowerCase().includes(q) ||
      (e.displayName || '').toLowerCase().includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil((filtered?.length || 0) / pageSize))
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  function fmtDate(v?: string | null) {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
  }

  const [showForm, setShowForm] = React.useState(false)
  const [draft, setDraft] = React.useState<EntitySchema>({ entityName: '', displayName: '', fields: [] })
  // Shared field draft state (used by both create modal and manage fields panel)
  const [fieldName, setFieldName] = React.useState('')
  const [fieldLabel, setFieldLabel] = React.useState('') // display label for field meta config
  // Separate type selections for Add vs Advanced Edit to avoid cross-coupling
  const [addFieldType, setAddFieldType] = React.useState('Text')
  const [advFieldType, setAdvFieldType] = React.useState('Text')
  const [fieldReq, setFieldReq] = React.useState(false)
  const [fieldIdx, setFieldIdx] = React.useState(false)
  const [fieldRegex, setFieldRegex] = React.useState('')
  // Optional advanced props
  const [fieldDefaultValue, setFieldDefaultValue] = React.useState('')
  const [fieldMasking, setFieldMasking] = React.useState('')
  const [fieldReadScope, setFieldReadScope] = React.useState('')
  const [fieldWriteScope, setFieldWriteScope] = React.useState('')
  const [fieldUnique, setFieldUnique] = React.useState(false)
  // Type-specific config state
  const [picklistOptions, setPicklistOptions] = React.useState<PickOpt[]>([])
  const [newPickVal, setNewPickVal] = React.useState('')
  const [newPickLabel, setNewPickLabel] = React.useState('')
  const [pickMulti, setPickMulti] = React.useState(false)
  const [pickRestrict, setPickRestrict] = React.useState(true)

  const [relKind, setRelKind] = React.useState<RelKind>('Lookup')
  const [relTargetEntity, setRelTargetEntity] = React.useState('')
  const [relDisplayField, setRelDisplayField] = React.useState<string>('')
  const [relTargetIsCore, setRelTargetIsCore] = React.useState(false)
  const [relOnDelete, setRelOnDelete] = React.useState<OnDelete>('Restrict')
  const [targetFields, setTargetFields] = React.useState<Array<{ name: string; dataType: string; metaJson?: string | null }>>([])
  // Display template tokens for relationship fields
  type LocalDisplayToken = DisplayToken & { locale?: string; tz?: string }
  const [relTemplate, setRelTemplate] = React.useState<LocalDisplayToken[]>([])
  const [newTplText, setNewTplText] = React.useState('')
  const [newTplField, setNewTplField] = React.useState('')
  const [newTplFormat, setNewTplFormat] = React.useState('')
  const [newTplLocale, setNewTplLocale] = React.useState('')
  const [newTplTz, setNewTplTz] = React.useState('')
  const [previewRecordId, setPreviewRecordId] = React.useState<number | ''>('')
  const [renderedPreview, setRenderedPreview] = React.useState<string>('')
  const [previewError, setPreviewError] = React.useState<string>('')
  const [isPreviewing, setIsPreviewing] = React.useState(false)
  const dragIdxRef = React.useRef<number | null>(null)
  const PREVIEW_KEY = React.useMemo(()=> `${tId}:${relTargetEntity}:previewRecordId`, [tId, relTargetEntity])
  const [locale, setLocale] = React.useState('default')
  const [timeZone, setTimeZone] = React.useState('UTC')
  const [pathIssues, setPathIssues] = React.useState<Record<string,string>>({})
  const [includeRelated, setIncludeRelated] = React.useState(false) // enable chaining preview
  const [relatedCache, setRelatedCache] = React.useState<Record<string, any>>({})
  const [fieldMetaCache, setFieldMetaCache] = React.useState<Record<string, any[]>>({}) // entityName -> fields array
  const [relationshipTargetCache, setRelationshipTargetCache] = React.useState<Record<string,string>>({}) // entity.field -> targetEntity
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const datalistId = React.useMemo(()=>`tpl-suggest-${relTargetEntity||'none'}`,[relTargetEntity])
  const [selectedTokenIdx, setSelectedTokenIdx] = React.useState<number | null>(null)
  // Relationship kind helpers
  function normalizeRelationshipKind(kind: string): RelKind {
      const base = typeof kind === 'string' ? kind : ''
      const k = base.toLowerCase().replace(/[^a-z]/g, '')
    if (k.includes('externallookup') || (k.includes('external') && k.includes('lookup'))) return 'ExternalLookup'
    if (k.includes('hierarchy')) return 'Hierarchy'
    if (k.includes('masterdetail') || (k.includes('master') && k.includes('detail'))) return 'MasterDetail'
    if (k.includes('lookup') || k.includes('relationship')) return 'Lookup'
    return 'Lookup'
  }
  function isRelationshipKind(kind: string): boolean {
      if (typeof kind !== 'string') return false
      const k = kind.toLowerCase()
    return k.includes('lookup') || k.includes('relationship') || k.includes('hierarchy') || k.includes('master')
  }
  // Relationship kind normalization for add & advanced contexts
  React.useEffect(()=>{ if (isRelationshipKind(addFieldType)) setRelKind(normalizeRelationshipKind(addFieldType)) }, [addFieldType])
  React.useEffect(()=>{ if (isRelationshipKind(advFieldType)) setRelKind(normalizeRelationshipKind(advFieldType)) }, [advFieldType])
  React.useEffect(()=>{
    // Load last preview recordId when target changes
    const v = PREVIEW_KEY ? localStorage.getItem(PREVIEW_KEY) : null
    if (v) {
      const n = parseInt(v, 10)
      if (!isNaN(n)) setPreviewRecordId(n)
    } else {
      setPreviewRecordId('')
    }
  }, [PREVIEW_KEY])
  React.useEffect(()=>{
    if (previewRecordId !== '' && PREVIEW_KEY) localStorage.setItem(PREVIEW_KEY, String(previewRecordId))
  }, [previewRecordId, PREVIEW_KEY])
  function formatDate(value: any, pattern?: string, locOverride?: string, tzOverride?: string): string {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    const pad = (n:number, w=2)=> n.toString().padStart(w,'0')
    const yyyy = d.getFullYear()
    const MM = pad(d.getMonth()+1)
    const dd = pad(d.getDate())
    const HH = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    let out: string
    switch (pattern) {
      case 'yyyy-MM-dd': out = `${yyyy}-${MM}-${dd}`; break
      case 'yyyy-MM-dd HH:mm': out = `${yyyy}-${MM}-${dd} ${HH}:${mm}`; break
      case 'MM/dd/yyyy': out = `${MM}/${dd}/${yyyy}`; break
      default:
        out = d.toISOString()
    }
    const loc = locOverride ?? locale
    const tz = tzOverride ?? timeZone
    if (loc !== 'default') {
      try {
        out = d.toLocaleString(loc === 'default' ? undefined : loc, { timeZone: tz })
      } catch {}
    }
    return out
  }

  function formatNumber(value: any, pattern?: string, locOverride?: string): string {
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return String(value ?? '')
    const loc = (locOverride ?? locale) === 'default' ? undefined : (locOverride ?? locale)
    switch (pattern) {
      case '0.00': return new Intl.NumberFormat(loc, { minimumFractionDigits:2, maximumFractionDigits:2 }).format(num)
      case '#,##0': return new Intl.NumberFormat(loc, { maximumFractionDigits:0 }).format(num)
      case 'currency': return new Intl.NumberFormat(loc, { style:'currency', currency:'USD' }).format(num)
      case 'percent': return new Intl.NumberFormat(loc, { style:'percent', minimumFractionDigits:2, maximumFractionDigits:2 }).format(num)
      default: return String(value)
    }
  }

  function getValueAtPath(root: any, path?: string): any {
    if (!path) return undefined
    const parts = path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
    let cur: any = root
    for (const p of parts) {
      if (cur == null) return undefined
      cur = cur[p as any]
    }
    return cur
  }

  async function fetchRelatedRecord(fieldValue: any, entityName?: string): Promise<any | null> {
    // Expect lookup target recordId (numeric) or identifier; try numeric first
    if (fieldValue == null) return null
    const rid = typeof fieldValue === 'number' ? fieldValue : parseInt(fieldValue, 10)
    if (isNaN(rid)) return null
    const baseEntity = entityName || relTargetEntity
    const key = `${baseEntity}:${rid}`
    if (relatedCache[key]) return relatedCache[key]
    try {
      const rec = await getRecordById({ tenantId: tId, entityName: baseEntity, recordId: rid, token: token || undefined, userId: 'designer@preview' })
      if (rec) {
        setRelatedCache(c=>({ ...c, [key]: rec.fields }))
        return rec.fields
      }
    } catch {}
    return null
  }

  function splitRelatedPath(path: string): { relField: string; nested?: string } | null {
    // Format: relationField->nested.path
    if (!path.includes('->')) return null
    const [left, right] = path.split('->')
    if (!left || !right) return null
    return { relField: left.trim(), nested: right.trim() }
  }

  function splitChain(path: string): string[] | null {
    if (!path.includes('->')) return null
    return path.split('->').map(s=>s.trim()).filter(Boolean)
  }

  async function getRelationshipTarget(entityName: string, fieldName: string): Promise<string | null> {
    const key = `${entityName}.${fieldName}`
    if (relationshipTargetCache[key]) return relationshipTargetCache[key]
    let fields = fieldMetaCache[entityName]
    if (!fields) {
      try {
        fields = await listFields(tId, entityName, token || undefined) as any
        setFieldMetaCache(m=>({ ...m, [entityName]: fields as any }))
      } catch { fields = [] }
    }
    const info: any = (fields||[]).find((f:any)=>f.name===fieldName)
    if (!info) return null
    try {
      const meta = info.metaJson ? JSON.parse(info.metaJson) : null
      const tEnt = meta?.relationship?.targetEntity || null
      if (tEnt) setRelationshipTargetCache(c=>({ ...c, [key]: tEnt }))
      return tEnt
    } catch { return null }
  }

  async function resolveChainedValue(baseFields: Record<string, any>, baseEntity: string, chain: string): Promise<any> {
    const segments = splitChain(chain)
    if (!segments || segments.length === 0) return undefined
    let currentEntity = baseEntity
    let currentFields: any = baseFields
    for (let i=0;i<segments.length;i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      if (isLast) {
        // last can be nested subpath
        return seg.includes('.') || /\[\d+\]/.test(seg) ? getValueAtPath(currentFields, seg) : currentFields[seg]
      } else {
        const ridVal = currentFields[seg]
        const nextEntity = await getRelationshipTarget(currentEntity, seg)
        if (!nextEntity) return undefined
        const related = await fetchRelatedRecord(ridVal, nextEntity)
        if (!related) return undefined
        currentEntity = nextEntity
        currentFields = related
      }
    }
    return undefined
  }

  function renderTokenSync(t: LocalDisplayToken, fields: Record<string, any>): string | undefined {
    if (t.kind === 'Text') return t.value || ''
    const raw = t.field?.includes('.') || /\[\d+\]/.test(t.field || '')
      ? getValueAtPath(fields, t.field)
      : fields[t.field || '']
    const val = raw
    if (val == null) return ''
    const isDateLike = typeof val === 'string' && /T\d{2}:\d{2}:\d{2}/.test(val)
    if (isDateLike || val instanceof Date) return formatDate(val, t.format, t.locale, t.tz)
    if (typeof val === 'number' || (!isNaN(parseFloat(val)))) return formatNumber(val, t.format, t.locale)
    return String(val)
  }

  function renderTokensLocal(tokens: LocalDisplayToken[], fields: Record<string, any>): string {
    return tokens.map(t => {
      if (t.kind === 'Text') return t.value || ''
      if ((t.field||'').includes('->')) return '' // async path; placeholder empty
      const out = renderTokenSync(t, fields)
      return out ?? ''
    }).join('')
  }

  async function renderTokensLocalAsync(tokens: LocalDisplayToken[], baseFields: Record<string, any>, baseEntity: string): Promise<string> {
    const parts = await Promise.all(tokens.map(async t => {
      if (t.kind === 'Text') return t.value || ''
      const f = t.field || ''
      if (f.includes('->') && includeRelated) {
        const v = await resolveChainedValue(baseFields, baseEntity, f)
        if (v == null) return ''
        const isDateLike = typeof v === 'string' && /T\d{2}:\d{2}:\d{2}/.test(v)
        if (isDateLike || v instanceof Date) return formatDate(v, t.format, t.locale, t.tz)
        if (typeof v === 'number' || (!isNaN(parseFloat(v)))) return formatNumber(v, t.format, t.locale)
        return String(v)
      }
      return renderTokenSync(t, baseFields) ?? ''
    }))
    return parts.join('')
  }
  const formatHintsHelp = 'Date: yyyy-MM-dd, yyyy-MM-dd HH:mm, MM/dd/yyyy\nNumber: 0.00 (two decimals), #,##0 (grouped)\nCurrency: currency (USD)\nPercent: percent (0.00%)'
  function reorderRelTemplate(from: number, to: number) {
    if (from === to) return;
    setRelTemplate(arr => {
      const copy = arr.slice();
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    })
  }

  async function runPreview() {
    setPreviewError(''); setRenderedPreview('');
    if (previewRecordId === '' || !relTargetEntity || relTemplate.length === 0) { setPreviewError('Select target, recordId and add tokens'); return }
    try {
      setIsPreviewing(true)
      const requiresLocal = includeRelated || relTemplate.some(t => (t.field||'').includes('->') || !!t.locale || !!t.tz)
      if (requiresLocal) {
        const rec = await getRecordById({ tenantId: tId, entityName: relTargetEntity, recordId: Number(previewRecordId), token: token || undefined, userId: 'designer@preview' })
        if (!rec) throw new Error('Record not found')
        const rendered = await renderTokensLocalAsync(relTemplate, rec.fields, relTargetEntity)
        setRenderedPreview(rendered)
      } else {
        const rendered = await previewDisplay({ tenantId: tId, entityName: relTargetEntity, recordId: Number(previewRecordId), tokens: relTemplate, token: token || undefined, userId: 'designer@preview' })
        setRenderedPreview(rendered || '')
      }
    } catch (e:any) {
      // Fallback: fetch record and render locally
      try {
        const rec = await getRecordById({ tenantId: tId, entityName: relTargetEntity, recordId: Number(previewRecordId), token: token || undefined, userId: 'designer@preview' })
        if (!rec) { setPreviewError('Record not found for fallback'); }
        else {
          const s = await renderTokensLocalAsync(relTemplate, rec.fields, relTargetEntity)
          setRenderedPreview(s)
          setPreviewError('')
        }
      } catch (err:any) {
        setPreviewError(err?.message || e.message || 'Preview failed')
      }
    } finally { setIsPreviewing(false) }
  }

  // Immediate path validation effect (on token changes or recordId change)
  React.useEffect(()=> {
    const issues: Record<string,string> = {}
    if (previewRecordId === '' || !relTargetEntity || relTemplate.length === 0) { setPathIssues({}); return }
    ;(async ()=> {
      try {
        const rec = await getRecordById({ tenantId: tId, entityName: relTargetEntity, recordId: Number(previewRecordId), token: token || undefined, userId: 'designer@preview' })
        const fieldsObj = rec?.fields || {}
        await Promise.all(relTemplate.map(async t => {
          if (t.kind !== 'Field' || !t.field) return
            if (t.field.includes('->') && includeRelated) {
              const v = await resolveChainedValue(fieldsObj, relTargetEntity, t.field)
              if (v === undefined) issues[t.field] = 'Missing related field'
            } else {
              const val = t.field.includes('.') || /\[\d+\]/.test(t.field) ? getValueAtPath(fieldsObj, t.field) : fieldsObj[t.field]
              if (val === undefined) issues[t.field] = 'Missing field'
            }
        }))
        setPathIssues(issues)
      } catch { setPathIssues({}) }
    })()
  }, [previewRecordId, relTargetEntity, relTemplate, includeRelated, tId, token])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!relTargetEntity) { setTargetFields([]); return }
        const fields = await listFields(tId, relTargetEntity, token || undefined)
        if (!cancelled) setTargetFields(fields as any)
      } catch { setTargetFields([]) }
    }
    load()
    return () => { cancelled = true }
  }, [relTargetEntity, tId, token])

  // Recursive multi-hop suggestions (up to depth 3) with cycle guards
  React.useEffect(()=>{
    (async ()=>{
      if (!relTargetEntity) { setSuggestions([]); return }
      const MAX_DEPTH = 3
      const acc: string[] = []
      const seen = new Set<string>()

      async function loadFields(entity: string): Promise<any[]> {
        let list = fieldMetaCache[entity]
        if (!list) {
          try { list = await listFields(tId, entity, token || undefined) as any }
          catch { list = [] }
          setFieldMetaCache(m=>({ ...m, [entity]: list as any }))
        }
        return list || []
      }

      async function walk(entity: string, prefix: string, depth: number, visited: Set<string>) {
        if (depth < 0) return
        const fields = await loadFields(entity)
        for (const f of fields) {
          const basePath = `${prefix}${f.name}`
          if (!seen.has(basePath)) { acc.push(basePath); seen.add(basePath) }
          if (includeRelated && depth > 0 && ['Lookup','ExternalLookup','Hierarchy','MasterDetail'].includes(f.dataType)) {
            let target: string | null = null
            try { const meta = f.metaJson ? JSON.parse(f.metaJson) : null; target = meta?.relationship?.targetEntity || null } catch { target = null }
            if (target && !visited.has(target)) {
              const chainPrefix = `${basePath}->`
              if (!seen.has(chainPrefix)) { acc.push(chainPrefix); seen.add(chainPrefix) }
              const nextVisited = new Set(visited); nextVisited.add(entity)
              await walk(target, chainPrefix, depth - 1, nextVisited)
            }
          }
        }
      }
      await walk(relTargetEntity, '', MAX_DEPTH, new Set<string>())
      setSuggestions(Array.from(new Set(acc)))
    })()
  }, [relTargetEntity, includeRelated, fieldMetaCache, tId, token])

  function setTokenAt(idx: number, patch: Partial<LocalDisplayToken>) {
    setRelTemplate(arr => arr.map((t,i)=> i===idx ? ({ ...t, ...patch }) : t))
  }

  function renderTokenInspector() {
    if (selectedTokenIdx == null) return null
    const t = relTemplate[selectedTokenIdx]
    if (!t) return null
    if (t.kind === 'Text') {
      return (
        <div style={{marginTop:8, padding:8, border:'1px dashed #e2e8f0', borderRadius:8}}>
          <div style={{fontWeight:600, marginBottom:6}}>Token Inspector • Text</div>
          <label style={{display:'flex', flexDirection:'column', gap:4}}>Text
            <input value={t.value||''} onChange={e=>setTokenAt(selectedTokenIdx, { value: e.target.value })} placeholder="Text" />
          </label>
          <div style={{marginTop:6}}>
            <button type="button" onClick={()=>setSelectedTokenIdx(null)} style={{fontSize:12}}>Close</button>
          </div>
        </div>
      )
    }
    return (
      <div style={{marginTop:8, padding:8, border:'1px dashed #e2e8f0', borderRadius:8}}>
        <div style={{fontWeight:600, marginBottom:6}}>Token Inspector • Field</div>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <label style={{display:'flex', flexDirection:'column', gap:4}}>Field path
            <input list={datalistId} value={t.field||''} onChange={e=>setTokenAt(selectedTokenIdx, { field: e.target.value })} placeholder="field or chain" />
          </label>
          <label style={{display:'flex', flexDirection:'column', gap:4}}>Format
            <input value={t.format||''} onChange={e=>setTokenAt(selectedTokenIdx, { format: e.target.value || undefined })} placeholder="format" />
          </label>
          <label style={{display:'flex', flexDirection:'column', gap:4}}>Locale
            <select value={t.locale||''} onChange={e=>setTokenAt(selectedTokenIdx, { locale: e.target.value || undefined })}>
              <option value=''>—</option>
              <option value='en-US'>en-US</option>
              <option value='en-GB'>en-GB</option>
              <option value='fr-FR'>fr-FR</option>
              <option value='de-DE'>de-DE</option>
              <option value='ja-JP'>ja-JP</option>
            </select>
          </label>
          <label style={{display:'flex', flexDirection:'column', gap:4}}>Time Zone
            <select value={t.tz||''} onChange={e=>setTokenAt(selectedTokenIdx, { tz: e.target.value || undefined })}>
              <option value=''>—</option>
              <option value='UTC'>UTC</option>
              <option value='America/New_York'>America/New_York</option>
              <option value='Europe/London'>Europe/London</option>
              <option value='Europe/Paris'>Europe/Paris</option>
              <option value='Asia/Tokyo'>Asia/Tokyo</option>
            </select>
          </label>
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            <button type="button" onClick={()=>{ if (t.locale) setLocale(t.locale); if (t.tz) setTimeZone(t.tz); }} style={{fontSize:12}}>Promote locale/tz to global</button>
            <button type="button" onClick={()=>setSelectedTokenIdx(null)} style={{fontSize:12}}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  const [autoFmt, setAutoFmt] = React.useState('{0:0000001}')
  const [autoStart, setAutoStart] = React.useState<number>(1)

  // Number-specific props
  const [numPrecision, setNumPrecision] = React.useState<number | ''>('')
  const [numScale, setNumScale] = React.useState<number | ''>('')
  // Text-specific props
  const [textMaxLength, setTextMaxLength] = React.useState<number | ''>('')
  const [textMultiline, setTextMultiline] = React.useState(false)
  // Currency-specific props
  const [currencyCode, setCurrencyCode] = React.useState('')
  const [currencyPrecision, setCurrencyPrecision] = React.useState<number | ''>('')
  const [currencyScale, setCurrencyScale] = React.useState<number | ''>('')
  // Formula
  const [formulaExpr, setFormulaExpr] = React.useState('')
  const [formulaOutputType, setFormulaOutputType] = React.useState('Text')
  const [formulaDependsOn, setFormulaDependsOn] = React.useState<string>('')
  // Rollup
  const [rollupAggregate, setRollupAggregate] = React.useState('Sum')
  const [rollupRelatedEntity, setRollupRelatedEntity] = React.useState('')
  const [rollupRelationshipPath, setRollupRelationshipPath] = React.useState('')
  const [rollupSourceField, setRollupSourceField] = React.useState('')

  const [manageOpen, setManageOpen] = React.useState(false)
  const [selectedEntity, setSelectedEntity] = React.useState<string | null>(null)
  const selectedMeta = React.useMemo(()=> (data||[]).find(e=>e.entityName===selectedEntity) as EntitySchema | undefined, [data, selectedEntity])
  const selectedIsCore = !!selectedMeta?.isCore
  const [showAddFieldPanel, setShowAddFieldPanel] = React.useState<boolean>(false)
  const [showAdvCreate, setShowAdvCreate] = React.useState<boolean>(false)
  const [showAdvManage, setShowAdvManage] = React.useState<boolean>(false)
  const { data: selectedFields } = useQuery({
    queryKey: ['entity-fields', tId, selectedEntity],
    queryFn: () => listFields(tId, selectedEntity!, token || undefined),
    enabled: !!selectedEntity
  })

  const [editRows, setEditRows] = React.useState<Record<string, { dataType: string; required: boolean; indexed: boolean }>>({})
  React.useEffect(()=>{
    const map: Record<string, { dataType: string; required: boolean; indexed: boolean }> = {}
    ;(selectedFields || []).forEach((f:any)=>{
      map[f.name] = { dataType: f.dataType, required: !!f.isRequired, indexed: !!f.isIndexed }
    })
    setEditRows(map)
  }, [selectedFields])

  // Advanced properties modal
  const [advOpen, setAdvOpen] = React.useState(false)
  const [advField, setAdvField] = React.useState<string | null>(null)
  const [advIsTenantOwned, setAdvIsTenantOwned] = React.useState<boolean>(false)
  function openAdvancedFor(name: string) {
    try {
      if (!selectedFields) return
      const f: any = (selectedFields || []).find((x: any) => x.name === name)
      if (!f) return
      setFieldName(name)
  setAdvFieldType(f?.dataType || 'Text')
      setFieldReq(!!f?.isRequired)
      setFieldIdx(!!f?.isIndexed)
      setFieldRegex(f?.validationExpression || '')
      setFieldDefaultValue(f?.defaultValue || '')
      setFieldMasking(f?.maskingPolicy || '')
      setFieldReadScope(f?.readScope || '')
      setFieldWriteScope(f?.writeScope || '')
      setFieldUnique(false)
      // Parse metaJson for deeper configs (defensive)
      let meta: any = null
      try { meta = f?.metaJson ? JSON.parse(f.metaJson) : null } catch (err) { console.warn('Failed parsing metaJson for field', name, err) }
      setAdvIsTenantOwned(!!meta?.tenantOwned)
      if (meta?.validation) {
        setFieldUnique(!!meta.validation.unique)
        if (typeof meta.validation.regex === 'string' && !f?.validationExpression) setFieldRegex(meta.validation.regex)
      }
      if (meta?.relationship) {
  setAdvFieldType(meta.relationship.kind || 'Lookup')
        setRelKind(meta.relationship.kind || 'Lookup')
        setRelTargetEntity(meta.relationship.targetEntity || '')
        setRelTargetIsCore(!!meta.relationship.targetIsCore)
        setRelDisplayField(meta.relationship.displayField || '')
        setRelOnDelete((meta.relationship.onDelete || 'Restrict') as OnDelete)
      }
      if (meta?.number) { setNumPrecision(meta.number.precision ?? ''); setNumScale(meta.number.scale ?? '') }
      if (meta?.text) { setTextMaxLength(meta.text.maxLength ?? ''); setTextMultiline(!!meta.text.multiline) }
      if (meta?.currency) { setCurrencyCode(meta.currency.currencyCode || ''); setCurrencyPrecision(meta.currency.precision ?? ''); setCurrencyScale(meta.currency.scale ?? '') }
      if (meta?.formula) {
  setAdvFieldType('Formula')
        setFormulaExpr(meta.formula.expression || '')
        setFormulaOutputType(meta.formula.outputType || 'Text')
        setFormulaDependsOn(Array.isArray(meta.formula.dependsOn) ? meta.formula.dependsOn.join(',') : '')
      }
      if (meta?.rollup) {
  setAdvFieldType('RollupSummary')
        setRollupAggregate(meta.rollup.aggregate || 'Sum')
        setRollupRelatedEntity(meta.rollup.relatedEntity || '')
        setRollupRelationshipPath(meta.rollup.relationshipPath || '')
        setRollupSourceField(meta.rollup.sourceField || '')
      }
  if (meta?.autoNumber) { setAdvFieldType('AutoNumber'); setAutoFmt(meta.autoNumber.format || '{0:0000001}') }
      if (meta?.picklist) {
  setAdvFieldType(meta.picklist.multiSelect ? 'MultiPicklist' : 'Picklist')
        setPicklistOptions((meta.picklist.options||[]).map((o:any)=>({value:o.value,label:o.label,active:o.active})))
        setPickMulti(!!meta.picklist.multiSelect)
        setPickRestrict(!!meta.picklist.restrictToOptions)
      }
      setAdvField(name)
      setAdvOpen(true)
    } catch (e) {
      alert('Failed to open advanced properties for field: ' + name)
      console.error('openAdvancedFor error', e)
    }
  }

  const createMut = useMutation({
    mutationFn: (payload: EntitySchema) => createEntity(tId, payload, token || undefined),
    onSuccess: () => {
      setShowForm(false)
      setDraft({ entityName: '', displayName: '', fields: [] })
      qc.invalidateQueries({ queryKey: ['entities', tId] })
    }
  })

  function resetFieldDraftState() {
    setFieldName('')
    setFieldLabel('')
  setAddFieldType('Text')
    setFieldReq(false)
    setFieldIdx(false)
    setFieldRegex('')
    setFieldDefaultValue(''); setFieldMasking(''); setFieldReadScope(''); setFieldWriteScope(''); setFieldUnique(false)
    setPicklistOptions([]); setPickMulti(false); setPickRestrict(true); setNewPickVal(''); setNewPickLabel('')
    setRelKind('Lookup'); setRelTargetEntity(''); setRelTargetIsCore(false); setRelDisplayField(''); setRelOnDelete('Restrict')
    setRelTemplate([]); setNewTplText(''); setNewTplField(''); setNewTplFormat('')
    setAutoFmt('{0:0000001}'); setAutoStart(1)
    setNumPrecision(''); setNumScale('');
    setTextMaxLength(''); setTextMultiline(false);
    setCurrencyCode(''); setCurrencyPrecision(''); setCurrencyScale('');
    setFormulaExpr(''); setFormulaOutputType('Text'); setFormulaDependsOn('');
    setRollupAggregate('Sum'); setRollupRelatedEntity(''); setRollupRelationshipPath(''); setRollupSourceField('');
  }

  function addFieldDraft() {
    if (!fieldName.trim()) return
    // Build config similarly to manage fields panel
    const cfg = buildConfigForType({
  kind: addFieldType,
      pick: { options: picklistOptions, multi: pickMulti, restrict: pickRestrict },
      rel: { kind: relKind, targetEntity: relTargetEntity, targetIsCore: relTargetIsCore, displayField: relDisplayField, onDelete: relOnDelete },
      auto: { format: autoFmt, startFrom: autoStart },
      number: { precision: numPrecision === '' ? undefined : numPrecision, scale: numScale === '' ? undefined : numScale },
      text: { maxLength: textMaxLength === '' ? undefined : textMaxLength, multiline: textMultiline },
      currency: { code: currencyCode || undefined, precision: currencyPrecision === '' ? undefined : currencyPrecision, scale: currencyScale === '' ? undefined : currencyScale },
      formula: { expression: formulaExpr, outputType: formulaOutputType, dependsOn: formulaDependsOn },
      rollup: { aggregate: rollupAggregate, relatedEntity: rollupRelatedEntity, relationshipPath: rollupRelationshipPath, sourceField: rollupSourceField || undefined },
      label: fieldLabel.trim() || undefined,
      displayTemplate: relTemplate.length ? relTemplate : undefined
    })
    // Basic validation for relationship fields
  if (isRelationshipKind(addFieldType)) {
      if (!relTargetEntity.trim()) {
        alert('Select a target entity for the relationship field.')
        return
      }
    }
    setDraft(d => ({ ...d, fields: [...(d.fields || []), {
      name: fieldName.trim(),
      label: fieldLabel.trim() || undefined,
  dataType: addFieldType,
      required: fieldReq,
      config: cfg,
      indexed: fieldIdx,
      regex: fieldRegex || undefined,
      defaultValue: fieldDefaultValue || undefined,
      maskingPolicy: fieldMasking || undefined,
      readScope: fieldReadScope || undefined,
      writeScope: fieldWriteScope || undefined,
      unique: fieldUnique || undefined
    }] }))
    resetFieldDraftState()
  }

  function removeField(i: number) {
    setDraft(d => ({ ...d, fields: (d.fields || []).filter((_, idx) => idx !== i) }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.entityName.trim()) return
    createMut.mutate({ ...draft, entityName: draft.entityName.trim() }, {
      onSuccess: async (res) => {
        // After entity creation, add any draft fields via API
        const createdName = draft.entityName.trim()
        for (const f of (draft.fields as any[]) || []) {
          try {
            await addField(tId, createdName, {
              name: f.name,
              dataType: mapUiTypeToServer(f.dataType),
              isRequired: !!f.required,
              isIndexed: !!f.indexed,
              maskingPolicy: f.maskingPolicy,
              readScope: f.readScope,
              writeScope: f.writeScope,
              defaultValue: f.defaultValue,
              validation: (f.regex || f.unique) ? { regex: f.regex, unique: f.unique } : undefined,
              config: f.config
            }, token || undefined).then(r => { if (r?.warnings?.length) alert('Warnings:\n' + r.warnings.join('\n')) })
          } catch (e) {
            console.warn('Failed adding field', f.name, e)
          }
        }
        qc.invalidateQueries({ queryKey: ['entities', tId] })
      }
    })
  }

  if (isLoading) return <p>Loading entities…</p>
  if (error) {
    const msg = (error as any)?.message || 'Unknown error'
    return (
      <div style={{color:'crimson'}}>
        <div style={{fontWeight:600}}>Failed to load entities</div>
        <div style={{fontSize:12, marginTop:4}}>{msg}</div>
        <div style={{fontSize:12, marginTop:8, color:'#334155'}}>
          Tips:
          <ul>
            <li>Ensure you are signed in (Metadata API requires Authorization).</li>
            <li>Start Metadata API at http://localhost:5005 or set VITE_METADATA_URL.</li>
            <li>Check the browser Network tab for /meta/api/metadata/entities errors.</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <h2>Entities</h2>
        <div style={{display:'flex', gap:8}}>
          <button type="button" onClick={async ()=>{
            try { await seedCoreEntities(tId, token || undefined); qc.invalidateQueries({ queryKey: ['entities', tId] }) }
            catch (e) { alert((e as any)?.message || 'Failed to seed core entities') }
          }}>Seed core entities</button>
          <button type="button" onClick={()=>setShowForm(true)}>Create entity</button>
        </div>
      </div>
  <p>Define entities and fields. Publishing creates immutable versions used by Runtime.</p>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <input placeholder="Search entities…" value={search}
               onChange={e=>{ setSearch(e.target.value); setPage(1); }}
               style={{maxWidth:260}}/>
      </div>
      <table style={{borderCollapse:'collapse', minWidth: 960}}>
        <thead>
          <tr>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Entity</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Display</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Type</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Created</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Updated</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: '6px 8px'}}>Fields</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((e: EntitySchema, i: number) => (
            <tr key={e.entityName} style={{cursor:'pointer', background: (i % 2 === 1) ? '#f8fafc' : 'transparent'}} onClick={()=>{ setSelectedEntity(e.entityName); setManageOpen(true); }}>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>{e.entityName}</td>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>{e.displayName ?? '—'}</td>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>
                <span style={{padding:'2px 6px', borderRadius:6, background: e.isCore ? '#eef2ff' : '#ecfeff', color: e.isCore ? '#3730a3' : '#155e75'}}>
                  {e.isCore ? 'Core' : 'Custom'}
                </span>
              </td>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>{fmtDate(e.createdOn)}</td>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>{fmtDate(e.updatedOn)}</td>
              <td style={{padding:'6px 8px', borderBottom:'1px solid #f1f5f9'}}>
                {e.fields?.slice(0,3).map((f: any) => f.name).join(', ') || '—'}
                {e.fields && e.fields.length > 3 ? ` (+${e.fields.length - 3} more)` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
  <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span style={{fontSize:12}}>Page {page} / {totalPages}</span>
  <button type="button" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
      </div>

      {showForm && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center'}}>
          <div style={{background:'white', borderRadius:12, padding:16, width:680, maxHeight:'80vh', overflow:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Create entity</h3>
              <button onClick={()=>setShowForm(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={submit} style={{display:'grid', gap:10, marginTop:12}}>
              <label>Entity name
                <input value={draft.entityName} onChange={e=>setDraft(d=>({...d, entityName: e.target.value}))} placeholder="Customer" required />
              </label>
              <label>Display name (optional)
                <input value={draft.displayName || ''} onChange={e=>setDraft(d=>({...d, displayName: e.target.value}))} placeholder="Customer" />
              </label>
              <div>
                <div style={{fontWeight:600, marginBottom:6}}>Fields</div>
                {(draft.fields||[]).length === 0 && <div style={{fontSize:12, color:'#64748b'}}>No fields yet.</div>}
                <ul>
                  {(draft.fields||[]).map((f: any, i) => (
                    <li key={i} style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                      <code style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:6}}>{f.name}:{f.dataType}{f.required?'*':''}</code>
                      <button type="button" onClick={()=>removeField(i)} style={{fontSize:12}}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                  <input value={fieldName} onChange={e=>setFieldName(e.target.value)} placeholder="Field name" />
                  <input value={fieldLabel} onChange={e=>setFieldLabel(e.target.value)} placeholder="Label (optional)" />
                  <select value={addFieldType} onChange={e=>setAddFieldType(e.target.value)}>
                    {(types&&types.length>0?types:[]).map((t: DataTypeDescriptor) => (
                      <option key={t.key} value={t.kind}>{t.label}</option>
                    ))}
                    {(!types || types.length===0) && <option value="Text">Text</option>}
                  </select>
                  <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                    <input type="checkbox" checked={fieldReq} onChange={e=>setFieldReq(e.target.checked)} /> required
                  </label>
                  <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                    <input type="checkbox" checked={fieldIdx} onChange={e=>setFieldIdx(e.target.checked)} /> indexed
                  </label>
                  <input value={fieldRegex} onChange={e=>setFieldRegex(e.target.value)} placeholder="regex (optional)" style={{minWidth:160}} />
                  <button type="button" onClick={addFieldDraft}>Add field</button>
                </div>
                {/* Advanced field properties (optional) */}
                <div style={{marginTop:6}}>
                  <button type="button" onClick={()=>setShowAdvCreate(s=>!s)} style={{fontSize:12}}>
                    {showAdvCreate ? 'Hide advanced' : 'Show advanced'}
                  </button>
                </div>
                {showAdvCreate && (
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
                  <input value={fieldDefaultValue} onChange={e=>setFieldDefaultValue(e.target.value)} placeholder="default value (optional)" />
                  <input value={fieldMasking} onChange={e=>setFieldMasking(e.target.value)} placeholder="masking policy (optional)" />
                  <input value={fieldReadScope} onChange={e=>setFieldReadScope(e.target.value)} placeholder="read scope (optional)" />
                  <input value={fieldWriteScope} onChange={e=>setFieldWriteScope(e.target.value)} placeholder="write scope (optional)" />
                  <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                    <input type="checkbox" checked={fieldUnique} onChange={e=>setFieldUnique(e.target.checked)} /> unique
                  </label>
                </div>
                )}
                {/* Type-specific config panels inside Create modal */}
                { (addFieldType === 'Picklist' || addFieldType === 'MultiPicklist') && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Picklist Options</div>
                    <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:6}}>
                      <input value={newPickVal} onChange={e=>setNewPickVal(e.target.value)} placeholder="value" />
                      <input value={newPickLabel} onChange={e=>setNewPickLabel(e.target.value)} placeholder="label (optional)" />
                      <button type="button" onClick={()=>{ if (!newPickVal.trim()) return; setPicklistOptions(opts=>[...opts, { value:newPickVal.trim(), label:newPickLabel||undefined, active:true }]); setNewPickVal(''); setNewPickLabel('') }}>Add option</button>
                    </div>
                    <ul>
                      {picklistOptions.map((o,i)=> (
                        <li key={i} style={{display:'flex', alignItems:'center', gap:8}}>
                          <code style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:6}}>{o.value}{o.label?` (${o.label})`:''}</code>
                          <button type="button" onClick={()=>setPicklistOptions(arr=>arr.filter((_,idx)=>idx!==i))} style={{fontSize:12}}>Remove</button>
                        </li>
                      ))}
                    </ul>
                    <div style={{display:'flex', gap:12}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={pickMulti || addFieldType==='MultiPicklist'} onChange={e=>setPickMulti(e.target.checked)} disabled={addFieldType==='MultiPicklist'} /> multi-select
                      </label>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={pickRestrict} onChange={e=>setPickRestrict(e.target.checked)} /> restrict to options
                      </label>
                    </div>
                  </div>
                )}
                { addFieldType === 'Number' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Number Settings</div>
                    <div style={{display:'flex', gap:12}}>
                      <label>Precision
                        <input type="number" value={numPrecision} onChange={e=>setNumPrecision(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="18" />
                      </label>
                      <label>Scale
                        <input type="number" value={numScale} onChange={e=>setNumScale(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="2" />
                      </label>
                    </div>
                  </div>
                )}
                { addFieldType === 'Text' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Text Settings</div>
                    <div style={{display:'flex', gap:12}}>
                      <label>Max Length
                        <input type="number" value={textMaxLength} onChange={e=>setTextMaxLength(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="256" />
                      </label>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={textMultiline} onChange={e=>setTextMultiline(e.target.checked)} /> multiline
                      </label>
                    </div>
                  </div>
                )}
                { addFieldType === 'Currency' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Currency Settings</div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 100px 100px', gap:12}}>
                      <label>Currency Code
                        <input value={currencyCode} onChange={e=>setCurrencyCode(e.target.value.toUpperCase())} placeholder="USD" />
                      </label>
                      <label>Precision
                        <input type="number" value={currencyPrecision} onChange={e=>setCurrencyPrecision(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="18" />
                      </label>
                      <label>Scale
                        <input type="number" value={currencyScale} onChange={e=>setCurrencyScale(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="2" />
                      </label>
                    </div>
                  </div>
                )}
                { addFieldType === 'Formula' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Formula Settings</div>
                    <label>Expression
                      <input value={formulaExpr} onChange={e=>setFormulaExpr(e.target.value)} placeholder="{fieldA} + {fieldB}" />
                    </label>
                    <label>Output Type
                      <select value={formulaOutputType} onChange={e=>setFormulaOutputType(e.target.value)}>
                        <option>Text</option><option>Number</option><option>Date</option><option>Currency</option>
                      </select>
                    </label>
                    <label>Depends On (comma separated)
                      <input value={formulaDependsOn} onChange={e=>setFormulaDependsOn(e.target.value)} placeholder="fieldA,fieldB" />
                    </label>
                  </div>
                )}
                { addFieldType === 'RollupSummary' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Roll-Up Summary</div>
                    <label>Aggregate
                      <select value={rollupAggregate} onChange={e=>setRollupAggregate(e.target.value)}>
                        <option>Sum</option><option>Min</option><option>Max</option><option>Count</option>
                      </select>
                    </label>
                    <label>Related Entity
                      <select value={rollupRelatedEntity} onChange={e=>setRollupRelatedEntity(e.target.value)}>
                        <option value="">—</option>
                        {(data||[]).map(ent => (<option key={ent.entityName} value={ent.entityName}>{ent.entityName}</option>))}
                      </select>
                    </label>
                    <label>Relationship Path
                      <input value={rollupRelationshipPath} onChange={e=>setRollupRelationshipPath(e.target.value)} placeholder="accounts.transactions" />
                    </label>
                    <label>Source Field (optional)
                      <input value={rollupSourceField} onChange={e=>setRollupSourceField(e.target.value)} placeholder="amount" />
                    </label>
                  </div>
                )}
                { isRelationshipKind(addFieldType) && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Relationship</div>
                    {(!relTargetEntity || !relDisplayField) && (
                      <div style={{fontSize:11, color:'#64748b', marginBottom:6}}>
                        Choose a target entity and display field. Build the display template below using Text and Field tokens.
                        Enable chaining to reference fields across relationships (e.g. <code>customer-&gt;address.city</code>).
                      </div>
                    )}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                      <label>Target entity
                        <select value={relTargetEntity} onChange={e=>setRelTargetEntity(e.target.value)}>
                          <option value="">—</option>
                          {(data||[]).map(ent => (
                            <option key={ent.entityName} value={ent.entityName}>{ent.entityName}</option>
                          ))}
                        </select>
                      </label>
                      <label>Display field
                        <select value={relDisplayField} onChange={e=>setRelDisplayField(e.target.value)}>
                          <option value="">—</option>
                          {targetFields.map((f:any)=> (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>On delete
                        <select value={relOnDelete} onChange={e=>setRelOnDelete(e.target.value as OnDelete)}>
                          <option value="Restrict">Restrict</option>
                          <option value="Cascade">Cascade</option>
                        </select>
                      </label>
                    </div>
                    <div style={{display:'flex', gap:12, marginTop:6}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={relTargetIsCore} onChange={e=>setRelTargetIsCore(e.target.checked)} /> target is core
                      </label>
                    </div>
                    <div style={{marginTop:10}}>
                      <div style={{fontWeight:600, marginBottom:4}}>Display template</div>
                      {relTemplate.length===0 && (
                        <div style={{fontSize:11, color:'#64748b', marginBottom:4}}>
                          Add Text tokens for static text and Field tokens for dynamic values. Use Format for dates/numbers (e.g. yyyy-MM-dd, 0.00).
                          Preview requires a recordId.
                        </div>
                      )}
                      <div style={{fontSize:12, color:'#64748b', marginBottom:6}}>Build how related records are shown. Text tokens and field tokens combine into a final display string.</div>
                      <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:6}}>
                        {relTemplate.map((t,i)=> (
                          <li key={i}
                              draggable
                              onDragStart={()=>{ dragIdxRef.current = i; }}
                              onDragOver={e=>{ e.preventDefault(); }}
                              onDrop={()=>{ const from = dragIdxRef.current; if(from==null) return; reorderRelTemplate(from, i); dragIdxRef.current = null; }}
                              style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, display:'flex', alignItems:'center', gap:6, cursor:'grab'}}>
                            <span style={{fontWeight:700, color:'#94a3b8'}}>⋮⋮</span>
                            <code onClick={()=>setSelectedTokenIdx(i)} style={{background: pathIssues[t.field||''] ? '#fee2e2':'#e2e8f0', padding:'2px 4px', borderRadius:4, cursor:'pointer', color: pathIssues[t.field||''] ? '#b91c1c':'#0f172a'}} title="Click to edit token">{t.kind==='Text' ? (t.value||'') : `{${t.field}${t.format?`:${t.format}`:''}}`}{t.locale||t.tz?`·${t.locale||''}${t.tz?`@${t.tz}`:''}`:''}</code>
                            {pathIssues[t.field||''] && <span style={{fontSize:10, color:'#b91c1c'}} title={pathIssues[t.field||'']}>!</span>}
                            <button type="button" style={{fontSize:11}} onClick={()=>setRelTemplate(arr=>arr.filter((_,idx)=>idx!==i))}>✕</button>
                          </li>
                        ))}
                        {relTemplate.length===0 && <li style={{fontSize:11, color:'#94a3b8'}}>No tokens</li>}
                      </ul>
                      <div style={{display:'flex', gap:12, marginTop:6, alignItems:'center', flexWrap:'wrap'}}>
                        <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                          <input type="checkbox" checked={includeRelated} onChange={e=>setIncludeRelated(e.target.checked)} /> enable relationship chaining
                        </label>
                        <label>Locale
                          <select value={locale} onChange={e=>setLocale(e.target.value)}>
                            <option value="default">default</option>
                            <option value="en-US">en-US</option>
                            <option value="en-GB">en-GB</option>
                            <option value="fr-FR">fr-FR</option>
                            <option value="de-DE">de-DE</option>
                            <option value="ja-JP">ja-JP</option>
                          </select>
                        </label>
                        <label>TZ
                          <select value={timeZone} onChange={e=>setTimeZone(e.target.value)}>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">America/New_York</option>
                            <option value="Europe/London">Europe/London</option>
                            <option value="Europe/Paris">Europe/Paris</option>
                            <option value="Asia/Tokyo">Asia/Tokyo</option>
                          </select>
                        </label>
                        <span style={{fontSize:11, color:'#64748b'}}>Use field path syntax: fieldName, nested.path, items[0].amount, or relationField-&gt;nested.path when chaining.</span>
                      </div>
                      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                        <input value={newTplText} onChange={e=>setNewTplText(e.target.value)} placeholder="Text token" style={{flex:'1 1 180px'}} />
                        <button type="button" onClick={()=>{ if(!newTplText.trim()) return; setRelTemplate(arr=>[...arr, { kind:'Text', value:newTplText.trim() }]); setNewTplText(''); }}>Add Text</button>
                        <input list={datalistId} value={newTplField} onChange={e=>setNewTplField(e.target.value)} placeholder="Field path or chain" style={{flex:'1 1 200px'}} />
                        <datalist id={datalistId}>
                          {suggestions.map(s=> <option key={s} value={s}>{s}</option>)}
                        </datalist>
                        <input value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} placeholder="Format (optional)" style={{flex:'1 1 140px'}} />
                        <select value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} style={{flex:'0 0 180px'}}>
                          <option value="">Format hints…</option>
                          <option value="yyyy-MM-dd">Date yyyy-MM-dd</option>
                          <option value="yyyy-MM-dd HH:mm">Date yyyy-MM-dd HH:mm</option>
                          <option value="MM/dd/yyyy">Date MM/dd/yyyy</option>
                          <option value="0.00">Number 0.00</option>
                          <option value="#,##0">Number #,##0</option>
                          <option value="currency">Currency (USD)</option>
                          <option value="percent">Percent (0.00%)</option>
                        </select>
                        <span title={formatHintsHelp} style={{fontSize:12, color:'#64748b'}}>ⓘ</span>
                        <select value={newTplLocale} onChange={e=>setNewTplLocale(e.target.value)} style={{flex:'0 0 130px'}}>
                          <option value=''>Token locale…</option>
                          <option value='en-US'>en-US</option>
                          <option value='en-GB'>en-GB</option>
                          <option value='fr-FR'>fr-FR</option>
                          <option value='de-DE'>de-DE</option>
                          <option value='ja-JP'>ja-JP</option>
                        </select>
                        <select value={newTplTz} onChange={e=>setNewTplTz(e.target.value)} style={{flex:'0 0 130px'}}>
                          <option value=''>Token TZ…</option>
                          <option value='UTC'>UTC</option>
                          <option value='America/New_York'>America/New_York</option>
                          <option value='Europe/London'>Europe/London</option>
                          <option value='Europe/Paris'>Europe/Paris</option>
                          <option value='Asia/Tokyo'>Asia/Tokyo</option>
                        </select>
                        <button type="button" onClick={()=>{ if(!newTplField) return; setRelTemplate(arr=>[...arr, { kind:'Field', field:newTplField, format:newTplFormat||undefined, locale:newTplLocale||undefined, tz:newTplTz||undefined }]); setNewTplField(''); setNewTplFormat(''); setNewTplLocale(''); setNewTplTz(''); }}>Add Field</button>
                        <input type="number" value={previewRecordId} onChange={e=>setPreviewRecordId(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="recordId" style={{width:90}} />
                        <button type="button" onClick={runPreview} disabled={isPreviewing}>{isPreviewing? 'Preview…':'Run Preview'}</button>
                      </div>
                      <div style={{marginTop:6, fontSize:12}}>
                        <span style={{fontWeight:600}}>Template:</span> {relTemplate.length? relTemplate.map(t=> t.kind==='Text'? t.value : `{${t.field}${t.format?`:${t.format}`:''}}`).join('') : '—'}
                      </div>
                      <div style={{marginTop:4, fontSize:12}}>
                        <span style={{fontWeight:600}}>Rendered:</span> {renderedPreview || (previewError? <span style={{color:'crimson'}}>{previewError}</span> : '—')}
                      </div>
                      {renderTokenInspector()}
                    </div>
                  </div>
                )}
                { addFieldType === 'AutoNumber' && (
                  <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                    <div style={{fontWeight:600, marginBottom:6}}>Auto Number</div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 200px', gap:8}}>
                      <label>Format
                        <input value={autoFmt} onChange={e=>setAutoFmt(e.target.value)} placeholder="{0:0000}" />
                      </label>
                      <label>Start from
                        <input type="number" value={autoStart} onChange={e=>setAutoStart(parseInt(e.target.value||'1',10))} />
                      </label>
                    </div>
                  </div>
                )}
                {typesError && <div style={{color:'crimson', fontSize:12, marginTop:4}}>Failed to load data types. Ensure Metadata API is running and you are signed in.</div>}
              </div>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <button type="submit" disabled={createMut.isPending}>{createMut.isPending ? 'Creating…' : 'Create entity'}</button>
                {createMut.isError && <span style={{color:'crimson', fontSize:12}}>Failed to create entity</span>}
                {createMut.isSuccess && <span style={{color:'#10b981', fontSize:12}}>Created.</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      {manageOpen && selectedEntity && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center'}}>
          <div style={{background:'white', borderRadius:12, padding:16, width:720, maxHeight:'80vh', overflow:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Entity details • {selectedEntity} {selectedIsCore && <span style={{fontSize:12, color:'#475569', marginLeft:8}}>(Core • custom fields only)</span>}</h3>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <button type="button" onClick={()=> setShowAddFieldPanel(s=>!s)}>{showAddFieldPanel ? 'Hide add field' : 'Add field'}</button>
                <button type="button" onClick={()=>{ setManageOpen(false); setSelectedEntity(null); }} aria-label="Close">✕</button>
              </div>
            </div>
            {/* Entity summary */}
            <div style={{marginTop:12, display:'grid', gap:8}}>
              <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12, background:'#f8fafc'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', columnGap:12, rowGap:6, fontSize:13}}>
                  <div><span style={{color:'#64748b'}}>Entity:</span> <strong>{selectedMeta?.entityName || selectedEntity}</strong></div>
                  <div><span style={{color:'#64748b'}}>Display name:</span> {selectedMeta?.displayName || '—'}</div>
                  <div><span style={{color:'#64748b'}}>Version:</span> {selectedMeta?.version ?? '—'}</div>
                  <div><span style={{color:'#64748b'}}>Active:</span> {selectedMeta?.isActive ? 'Yes' : 'No'}</div>
                  <div><span style={{color:'#64748b'}}>Created:</span> {fmtDate(selectedMeta?.createdOn)}</div>
                  <div><span style={{color:'#64748b'}}>Updated:</span> {fmtDate(selectedMeta?.updatedOn)}</div>
                  { (selectedMeta as any)?.description && (
                    <div style={{gridColumn:'1 / -1'}}><span style={{color:'#64748b'}}>Description:</span> {(selectedMeta as any).description}</div>
                  )}
                </div>
              </div>
              {showAddFieldPanel && (
              <>
              <div style={{fontWeight:600}}>Add field</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 160px 80px 90px 1fr auto', gap:8, alignItems:'center'}}>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <input value={fieldName} onChange={e=>setFieldName(e.target.value)} placeholder="fieldName" />
                  <input value={fieldLabel} onChange={e=>setFieldLabel(e.target.value)} placeholder="label" style={{fontSize:11}} />
                </div>
                <select value={addFieldType} onChange={e=>setAddFieldType(e.target.value)}>
                  {(types&&types.length>0?types:[]).map((t: DataTypeDescriptor) => (
                    <option key={t.key} value={t.kind}>{t.label}</option>
                  ))}
                  {(!types || types.length===0) && <option value="Text">Text</option>}
                </select>
                <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={fieldReq} onChange={e=>setFieldReq(e.target.checked)} /> req
                </label>
                <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={fieldIdx} onChange={e=>setFieldIdx(e.target.checked)} /> indexed
                </label>
                <input value={fieldRegex} onChange={e=>setFieldRegex(e.target.value)} placeholder="validation regex (optional)" />
                <button type="button" onClick={async ()=>{
                  if (!fieldName.trim()) return
                  try {
                      // Relationship pre-validation (avoid opaque 400 from API)
                      if (isRelationshipKind(addFieldType) && !relTargetEntity.trim()) {
                        alert('Select a target entity before adding a relationship field.')
                        return
                      }
                      await addField(tId, selectedEntity, {
                        name: fieldName.trim(),
                        dataType: mapUiTypeToServer(addFieldType),
                        isRequired: fieldReq,
                        isIndexed: fieldIdx,
                        maskingPolicy: fieldMasking || undefined,
                        readScope: fieldReadScope || undefined,
                        writeScope: fieldWriteScope || undefined,
                        defaultValue: fieldDefaultValue || undefined,
                        validation: (fieldRegex || fieldUnique) ? { regex: fieldRegex || undefined, unique: fieldUnique || undefined } : undefined,
                        config: {
                          ...buildConfigForType({
                          kind: addFieldType,
                          pick: { options: picklistOptions, multi: pickMulti, restrict: pickRestrict },
                          rel: { kind: relKind, targetEntity: relTargetEntity, targetIsCore: relTargetIsCore, displayField: relDisplayField, onDelete: relOnDelete },
                          auto: { format: autoFmt, startFrom: autoStart },
                          number: { precision: numPrecision === '' ? undefined : numPrecision, scale: numScale === '' ? undefined : numScale },
                          text: { maxLength: textMaxLength === '' ? undefined : textMaxLength, multiline: textMultiline },
                          currency: { code: currencyCode || undefined, precision: currencyPrecision === '' ? undefined : currencyPrecision, scale: currencyScale === '' ? undefined : currencyScale },
                          formula: { expression: formulaExpr, outputType: formulaOutputType, dependsOn: formulaDependsOn },
                          rollup: { aggregate: rollupAggregate, relatedEntity: rollupRelatedEntity, relationshipPath: rollupRelationshipPath, sourceField: rollupSourceField || undefined },
                          label: fieldLabel.trim() || undefined,
                          displayTemplate: relTemplate.length ? relTemplate : undefined
                          }),
                          ...(selectedIsCore ? { tenantOwned: true } : {})
                        }
                      }, token || undefined)
                      .then(r => { if (r?.warnings?.length) alert('Warnings:\n' + r.warnings.join('\n')) })
                      setFieldName(''); setFieldLabel(''); setFieldRegex(''); setFieldReq(false); setFieldIdx(false)
                      setFieldDefaultValue(''); setFieldMasking(''); setFieldReadScope(''); setFieldWriteScope(''); setFieldUnique(false)
                      setPicklistOptions([]); setPickMulti(false); setPickRestrict(true); setNewPickVal(''); setNewPickLabel('')
                      setRelKind('Lookup'); setRelTargetEntity(''); setRelTargetIsCore(false); setRelDisplayField(''); setRelOnDelete('Restrict')
                      setAutoFmt('{0:0000001}'); setAutoStart(1)
                      setNumPrecision(''); setNumScale(''); setTextMaxLength(''); setTextMultiline(false); setCurrencyCode(''); setCurrencyPrecision(''); setCurrencyScale('');
                      setFormulaExpr(''); setFormulaOutputType('Text'); setFormulaDependsOn(''); setRollupAggregate('Sum'); setRollupRelatedEntity(''); setRollupRelationshipPath(''); setRollupSourceField('');
                    qc.invalidateQueries({ queryKey: ['entities', tId] })
                    } catch (e:any) {
                      console.error('Add field error', e)
                      alert(e?.message || 'Failed to add field')
                  }
                }}>Add</button>
              </div>
              {/* Advanced props for manage panel */}
              <div style={{marginTop:8}}>
                <button type="button" onClick={()=>setShowAdvManage(s=>!s)} style={{fontSize:12}}>{showAdvManage ? 'Hide advanced' : 'Show advanced'}</button>
              </div>
              {showAdvManage && (
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <input value={fieldDefaultValue} onChange={e=>setFieldDefaultValue(e.target.value)} placeholder="default (optional)" />
                <input value={fieldMasking} onChange={e=>setFieldMasking(e.target.value)} placeholder="masking (optional)" />
                <input value={fieldReadScope} onChange={e=>setFieldReadScope(e.target.value)} placeholder="read scope" />
                <input value={fieldWriteScope} onChange={e=>setFieldWriteScope(e.target.value)} placeholder="write scope" />
                <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={fieldUnique} onChange={e=>setFieldUnique(e.target.checked)} /> unique
                </label>
              </div>
              )}
              {/* Type-specific config panels */}
              { (addFieldType === 'Picklist' || addFieldType === 'MultiPicklist') && (
                <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                  <div style={{fontWeight:600, marginBottom:6}}>Picklist Options</div>
                  <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:6}}>
                    <input value={newPickVal} onChange={e=>setNewPickVal(e.target.value)} placeholder="value" />
                    <input value={newPickLabel} onChange={e=>setNewPickLabel(e.target.value)} placeholder="label (optional)" />
                    <button type="button" onClick={()=>{ if (!newPickVal.trim()) return; setPicklistOptions(opts=>[...opts, { value:newPickVal.trim(), label:newPickLabel||undefined, active:true }]); setNewPickVal(''); setNewPickLabel('') }}>Add option</button>
                  </div>
                  <ul>
                    {picklistOptions.map((o,i)=> (
                      <li key={i} style={{display:'flex', alignItems:'center', gap:8}}>
                        <code style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:6}}>{o.value}{o.label?` (${o.label})`:''}</code>
                        <button type="button" onClick={()=>setPicklistOptions(arr=>arr.filter((_,idx)=>idx!==i))} style={{fontSize:12}}>Remove</button>
                      </li>
                    ))}
                  </ul>
                  <div style={{display:'flex', gap:12}}>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={pickMulti || addFieldType==='MultiPicklist'} onChange={e=>setPickMulti(e.target.checked)} disabled={addFieldType==='MultiPicklist'} /> multi-select
                    </label>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={pickRestrict} onChange={e=>setPickRestrict(e.target.checked)} /> restrict to options
                    </label>
                  </div>
                </div>
              )}

                { isRelationshipKind(addFieldType) && (
                <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                  <div style={{fontWeight:600, marginBottom:6}}>Relationship</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                    <label>Target entity
                      <select value={relTargetEntity} onChange={e=>setRelTargetEntity(e.target.value)}>
                        <option value="">—</option>
                        {(data||[]).map(ent => (
                          <option key={ent.entityName} value={ent.entityName}>{ent.entityName}</option>
                        ))}
                      </select>
                    </label>
                    <label>Display field
                      <select value={relDisplayField} onChange={e=>setRelDisplayField(e.target.value)}>
                        <option value=''>—</option>
                        {targetFields.map((f:any)=>(<option key={f.name} value={f.name}>{f.name}</option>))}
                      </select>
                    </label>
                    <label>On delete
                      <select value={relOnDelete} onChange={e=>setRelOnDelete(e.target.value as OnDelete)}>
                        <option value="Restrict">Restrict</option>
                        <option value="Cascade">Cascade</option>
                      </select>
                    </label>
                  </div>
                  <div style={{display:'flex', gap:12, marginTop:6}}>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={relTargetIsCore} onChange={e=>setRelTargetIsCore(e.target.checked)} /> target is core
                    </label>
                  </div>
                  <div style={{marginTop:10}}>
                    <div style={{fontWeight:600, marginBottom:4}}>Display template</div>
                    <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:6}}>
                      {relTemplate.map((t,i)=> (
                        <li key={i}
                            draggable
                            onDragStart={()=>{ dragIdxRef.current = i; }}
                            onDragOver={e=>{ e.preventDefault(); }}
                            onDrop={()=>{ const from = dragIdxRef.current; if(from==null) return; reorderRelTemplate(from, i); dragIdxRef.current = null; }}
                            style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, display:'flex', alignItems:'center', gap:6, cursor:'grab'}}>
                          <span style={{fontWeight:700, color:'#94a3b8'}}>⋮⋮</span>
                          <code onClick={()=>setSelectedTokenIdx(i)} style={{background: pathIssues[t.field||''] ? '#fee2e2':'#e2e8f0', padding:'2px 4px', borderRadius:4, cursor:'pointer', color: pathIssues[t.field||''] ? '#b91c1c':'#0f172a'}} title="Click to edit token">{t.kind==='Text' ? (t.value||'') : `{${t.field}${t.format?`:${t.format}`:''}}`}{t.locale||t.tz?`·${t.locale||''}${t.tz?`@${t.tz}`:''}`:''}</code>
                          {pathIssues[t.field||''] && <span style={{fontSize:10, color:'#b91c1c'}} title={pathIssues[t.field||'']}>!</span>}
                          <button type="button" style={{fontSize:11}} onClick={()=>setRelTemplate(arr=>arr.filter((_,idx)=>idx!==i))}>✕</button>
                        </li>
                      ))}
                      {relTemplate.length===0 && <li style={{fontSize:11, color:'#94a3b8'}}>No tokens</li>}
                    </ul>
                    <div style={{display:'flex', gap:12, marginTop:6, alignItems:'center', flexWrap:'wrap'}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={includeRelated} onChange={e=>setIncludeRelated(e.target.checked)} /> enable relationship chaining
                      </label>
                      <label>Locale
                        <select value={locale} onChange={e=>setLocale(e.target.value)}>
                          <option value="default">default</option>
                          <option value="en-US">en-US</option>
                          <option value="en-GB">en-GB</option>
                          <option value="fr-FR">fr-FR</option>
                          <option value="de-DE">de-DE</option>
                          <option value="ja-JP">ja-JP</option>
                        </select>
                      </label>
                      <label>TZ
                        <select value={timeZone} onChange={e=>setTimeZone(e.target.value)}>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                        </select>
                      </label>
                      <span style={{fontSize:11, color:'#64748b'}}>Use nested paths or relationField-&gt;nested.path (requires chaining).</span>
                    </div>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                      <input value={newTplText} onChange={e=>setNewTplText(e.target.value)} placeholder="Text token" style={{flex:'1 1 160px'}} />
                      <button type="button" onClick={()=>{ if(!newTplText.trim()) return; setRelTemplate(arr=>[...arr, { kind:'Text', value:newTplText.trim() }]); setNewTplText(''); }}>Add Text</button>
                      <input list={datalistId} value={newTplField} onChange={e=>setNewTplField(e.target.value)} placeholder="Field path or chain" style={{flex:'1 1 180px'}} />
                      <datalist id={datalistId}>
                        {suggestions.map(s=> <option key={s} value={s}>{s}</option>)}
                      </datalist>
                      <input value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} placeholder="Format" style={{flex:'1 1 120px'}} />
                      <select value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} style={{flex:'0 0 160px'}}>
                        <option value="">Format hints…</option>
                        <option value="yyyy-MM-dd">Date yyyy-MM-dd</option>
                        <option value="yyyy-MM-dd HH:mm">Date yyyy-MM-dd HH:mm</option>
                        <option value="MM/dd/yyyy">Date MM/dd/yyyy</option>
                        <option value="0.00">Number 0.00</option>
                        <option value="#,##0">Number #,##0</option>
                        <option value="currency">Currency (USD)</option>
                        <option value="percent">Percent (0.00%)</option>
                      </select>
                      <select value={newTplLocale} onChange={e=>setNewTplLocale(e.target.value)} style={{flex:'0 0 120px'}}>
                        <option value=''>Token locale…</option>
                        <option value='en-US'>en-US</option>
                        <option value='en-GB'>en-GB</option>
                        <option value='fr-FR'>fr-FR</option>
                        <option value='de-DE'>de-DE</option>
                        <option value='ja-JP'>ja-JP</option>
                      </select>
                      <select value={newTplTz} onChange={e=>setNewTplTz(e.target.value)} style={{flex:'0 0 120px'}}>
                        <option value=''>Token TZ…</option>
                        <option value='UTC'>UTC</option>
                        <option value='America/New_York'>America/New_York</option>
                        <option value='Europe/London'>Europe/London</option>
                        <option value='Europe/Paris'>Europe/Paris</option>
                        <option value='Asia/Tokyo'>Asia/Tokyo</option>
                      </select>
                      <span title={formatHintsHelp} style={{fontSize:12, color:'#64748b'}}>ⓘ</span>
                      <button type="button" onClick={()=>{ if(!newTplField) return; setRelTemplate(arr=>[...arr, { kind:'Field', field:newTplField, format:newTplFormat||undefined, locale:newTplLocale||undefined, tz:newTplTz||undefined }]); setNewTplField(''); setNewTplFormat(''); setNewTplLocale(''); setNewTplTz(''); }}>Add Field</button>
                      <input type="number" value={previewRecordId} onChange={e=>setPreviewRecordId(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="recordId" style={{width:90}} />
                      <button type="button" onClick={runPreview} disabled={isPreviewing}>{isPreviewing? 'Preview…':'Run Preview'}</button>
                    </div>
                    <div style={{marginTop:6, fontSize:12}}>
                      <span style={{fontWeight:600}}>Template:</span> {relTemplate.length? relTemplate.map(t=> t.kind==='Text'? t.value : `{${t.field}${t.format?`:${t.format}`:''}}`).join('') : '—'}
                    </div>
                    <div style={{marginTop:4, fontSize:12}}>
                      <span style={{fontWeight:600}}>Rendered:</span> {renderedPreview || (previewError? <span style={{color:'crimson'}}>{previewError}</span> : '—')}
                    </div>
                    {renderTokenInspector()}
                  </div>
                </div>
              )}

              { addFieldType === 'AutoNumber' && (
                <div style={{marginTop:8, borderTop:'1px dashed #e5e7eb', paddingTop:8}}>
                  <div style={{fontWeight:600, marginBottom:6}}>Auto Number</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 200px', gap:8}}>
                    <label>Format
                      <input value={autoFmt} onChange={e=>setAutoFmt(e.target.value)} placeholder="{0:0000}" />
                    </label>
                    <label>Start from
                      <input type="number" value={autoStart} onChange={e=>setAutoStart(parseInt(e.target.value||'1',10))} />
                    </label>
                  </div>
                </div>
              )}
              </>
              )}

              <div style={{marginTop:12}}>
                <div style={{fontWeight:600, marginBottom:6}}>Existing fields</div>
                <table style={{borderCollapse:'collapse', width:'100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'4px 6px'}}>Name</th>
                      <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'4px 6px'}}>Data Type</th>
                      <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'4px 6px'}}>Required</th>
                      <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'4px 6px'}}>Indexed</th>
                      <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'4px 6px'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedFields||[]).map((f:any, idx:number)=>{
                      const er = editRows[f.name] || { dataType: f.dataType, required: !!f.isRequired, indexed: !!f.isIndexed }
                      return (
                        <tr key={f.name} style={{background: (idx % 2 === 1) ? '#f8fafc' : 'transparent'}}>
                          <td style={{padding:'4px 6px', borderBottom:'1px solid #f1f5f9'}}>
                            <code style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:6}}>{f.name}</code>
                          </td>
                          <td style={{padding:'4px 6px', borderBottom:'1px solid #f1f5f9'}}>
                            <select value={er.dataType} disabled={selectedIsCore}
                                    onChange={e=>setEditRows(m=>({ ...m, [f.name]: { ...er, dataType: e.target.value } }))}>
                              {(types&&types.length>0?types:[]).map((t: DataTypeDescriptor) => (
                                <option key={t.key} value={t.kind}>{t.label}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{padding:'4px 6px', borderBottom:'1px solid #f1f5f9'}}>
                            <input type="checkbox" disabled={selectedIsCore}
                                   checked={er.required}
                                   onChange={e=>setEditRows(m=>({ ...m, [f.name]: { ...er, required: e.target.checked } }))} />
                          </td>
                          <td style={{padding:'4px 6px', borderBottom:'1px solid #f1f5f9'}}>
                            <input type="checkbox" disabled={selectedIsCore}
                                   checked={er.indexed}
                                   onChange={e=>setEditRows(m=>({ ...m, [f.name]: { ...er, indexed: e.target.checked } }))} />
                          </td>
                          <td style={{padding:'4px 6px', borderBottom:'1px solid #f1f5f9'}}>
                            <button type="button" disabled={selectedIsCore && !(f.metaJson && (()=>{ try { const m=JSON.parse(f.metaJson); return !!m.tenantOwned } catch { return false } })())} style={{marginRight:6}}
                                    onClick={async ()=>{
                                      try {
                                        await updateField(tId, selectedEntity!, f.name, {
                                          name: f.name,
                                          dataType: mapUiTypeToServer(er.dataType),
                                          isRequired: er.required,
                                          isIndexed: er.indexed
                                        }, token || undefined)
                                        qc.invalidateQueries({ queryKey: ['entities', tId] })
                                        qc.invalidateQueries({ queryKey: ['entity-fields', tId, selectedEntity] })
                                      } catch { alert('Failed to update field') }
                                    }}>Save</button>
                            <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); openAdvancedFor(f.name) }}>⚙️ Properties</button>
                          </td>
                        </tr>
                      )
                    })}
                    {(!selectedFields || selectedFields.length===0) && (
                      <tr><td colSpan={5} style={{color:'#64748b', padding:'4px 6px'}}>No fields.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {advOpen && advField && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'grid', placeItems:'center', zIndex:50}}>
          <div style={{background:'white', width:760, maxHeight:'85vh', overflow:'auto', borderRadius:12, padding:20, boxShadow:'0 10px 30px -6px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Advanced Field Properties • {advField} {selectedIsCore && !advIsTenantOwned && <span style={{fontSize:12, color:'#475569', marginLeft:8}}>(Core Field • view only)</span>}</h3>
              <button onClick={()=>{ setAdvOpen(false); setAdvField(null); }} aria-label="Close">✕</button>
            </div>
            <p style={{marginTop:4, fontSize:12, color:'#475569'}}>Configure validation, relationships, formulas, rollups, and display settings.</p>
            <div style={{display:'grid', gap:16, marginTop:12}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 160px 100px 100px', gap:12}}>
                <label>Name
                  <input value={fieldName} onChange={e=>setFieldName(e.target.value)} disabled readOnly />
                </label>
                <label>Type
                  <select value={advFieldType} onChange={e=>setAdvFieldType(e.target.value)} disabled={selectedIsCore && !advIsTenantOwned}>
                    {(types||[]).map((t:DataTypeDescriptor)=>(<option key={t.key} value={t.kind}>{t.label}</option>))}
                  </select>
                </label>
                <label style={{display:'flex', gap:6, alignItems:'center'}}>Required
                  <input type="checkbox" checked={fieldReq} onChange={e=>setFieldReq(e.target.checked)} disabled={selectedIsCore && !advIsTenantOwned} />
                </label>
                <label style={{display:'flex', gap:6, alignItems:'center'}}>Indexed
                  <input type="checkbox" checked={fieldIdx} onChange={e=>setFieldIdx(e.target.checked)} disabled={selectedIsCore && !advIsTenantOwned} />
                </label>
              </div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <input value={fieldRegex} onChange={e=>setFieldRegex(e.target.value)} placeholder="Regex (validation)" style={{flex:'1 1 220px'}} disabled={selectedIsCore && !advIsTenantOwned} />
                <input value={fieldDefaultValue} onChange={e=>setFieldDefaultValue(e.target.value)} placeholder="Default value" style={{flex:'1 1 160px'}} disabled={selectedIsCore && !advIsTenantOwned} />
                <input value={fieldMasking} onChange={e=>setFieldMasking(e.target.value)} placeholder="Masking policy" style={{flex:'1 1 160px'}} disabled={selectedIsCore && !advIsTenantOwned} />
                <input value={fieldReadScope} onChange={e=>setFieldReadScope(e.target.value)} placeholder="Read scope" style={{flex:'1 1 120px'}} disabled={selectedIsCore && !advIsTenantOwned} />
                <input value={fieldWriteScope} onChange={e=>setFieldWriteScope(e.target.value)} placeholder="Write scope" style={{flex:'1 1 120px'}} disabled={selectedIsCore && !advIsTenantOwned} />
                <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={fieldUnique} onChange={e=>setFieldUnique(e.target.checked)} disabled={selectedIsCore && !advIsTenantOwned} /> unique
                </label>
              </div>
              {(advFieldType==='Picklist' || advFieldType==='MultiPicklist') && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Picklist</div>
                  <div style={{display:'flex', gap:8, marginBottom:8}}>
                    <input value={newPickVal} onChange={e=>setNewPickVal(e.target.value)} placeholder="Option value" />
                    <input value={newPickLabel} onChange={e=>setNewPickLabel(e.target.value)} placeholder="Label" />
                    <button type="button" onClick={()=>{ if(!newPickVal.trim()) return; setPicklistOptions(o=>[...o,{value:newPickVal.trim(), label:newPickLabel||undefined, active:true}]); setNewPickVal(''); setNewPickLabel('') }}>Add</button>
                  </div>
                  <ul style={{margin:0, padding:0, listStyle:'none', display:'flex', flexWrap:'wrap', gap:6}}>
                    {picklistOptions.map((o,i)=>(
                      <li key={i} style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, display:'flex', alignItems:'center', gap:8}}>
                        <span>{o.value}{o.label?` (${o.label})`:''}</span>
                        <button style={{fontSize:11}} onClick={()=>setPicklistOptions(arr=>arr.filter((_,idx)=>idx!==i))}>✕</button>
                      </li>
                    ))}
                  </ul>
                  <div style={{display:'flex', gap:16, marginTop:8}}>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={pickMulti || advFieldType==='MultiPicklist'} onChange={e=>setPickMulti(e.target.checked)} disabled={advFieldType==='MultiPicklist'} /> multi-select
                    </label>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={pickRestrict} onChange={e=>setPickRestrict(e.target.checked)} /> restrict to options
                    </label>
                  </div>
                </div>
              )}
              { isRelationshipKind(advFieldType) && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Relationship</div>
                  {(!relTargetEntity || !relDisplayField) && (
                    <div style={{fontSize:11, color:'#64748b', marginBottom:6}}>
                      Select a target entity and display field. The display template lets you combine text and field tokens
                      (e.g. <code>{`{name}`}</code>, <code>{`{createdOn:yyyy-MM-dd}`}</code>) to render related records. Enable chaining to reference
                      fields across relationship hops (e.g. <code>customer-&gt;address.city</code>).
                    </div>
                  )}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
                    <label>Target
                      <select value={relTargetEntity} onChange={e=>setRelTargetEntity(e.target.value)}>
                        <option value=''>—</option>
                        {(data||[]).map(ent => (<option key={ent.entityName} value={ent.entityName}>{ent.entityName}</option>))}
                      </select>
                    </label>
                    <label>Display field
                      <select value={relDisplayField} onChange={e=>setRelDisplayField(e.target.value)}>
                        <option value=''>—</option>
                        {targetFields.map((f:any)=>(<option key={f.name} value={f.name}>{f.name}</option>))}
                      </select>
                    </label>
                    <label>On delete
                      <select value={relOnDelete} onChange={e=>setRelOnDelete(e.target.value as OnDelete)}>
                        <option value='Restrict'>Restrict</option>
                        <option value='Cascade'>Cascade</option>
                      </select>
                    </label>
                  </div>
                  <label style={{display:'inline-flex', alignItems:'center', gap:6, marginTop:8}}>
                    <input type="checkbox" checked={relTargetIsCore} onChange={e=>setRelTargetIsCore(e.target.checked)} /> target is core
                  </label>
                  <div style={{marginTop:10}}>
                    <div style={{fontWeight:600, marginBottom:4}}>Display template</div>
                    {relTemplate.length===0 && (
                      <div style={{fontSize:11, color:'#64748b', marginBottom:4}}>
                        Add Text tokens for static text and Field tokens for dynamic values. Drag to reorder. Use Format for date/number
                        shaping. Locale/TZ (in create modal) override defaults per token. Preview requires a recordId.
                      </div>
                    )}
                    <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:6}}>
                      {relTemplate.map((t,i)=> (
                        <li key={i}
                            draggable
                            onDragStart={()=>{ dragIdxRef.current = i; }}
                            onDragOver={e=>{ e.preventDefault(); }}
                            onDrop={()=>{ const from = dragIdxRef.current; if(from==null) return; reorderRelTemplate(from, i); dragIdxRef.current = null; }}
                            style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, display:'flex', alignItems:'center', gap:6, cursor:'grab'}}>
                          <span style={{fontWeight:700, color:'#94a3b8'}}>⋮⋮</span>
                          <code onClick={()=>setSelectedTokenIdx(i)} style={{background: pathIssues[t.field||''] ? '#fee2e2':'#e2e8f0', padding:'2px 4px', borderRadius:4, cursor:'pointer', color: pathIssues[t.field||''] ? '#b91c1c':'#0f172a'}} title="Click to edit token">{t.kind==='Text' ? (t.value||'') : `{${t.field}${t.format?`:${t.format}`:''}}`}{t.locale||t.tz?`·${t.locale||''}${t.tz?`@${t.tz}`:''}`:''}</code>
                          {pathIssues[t.field||''] && <span style={{fontSize:10, color:'#b91c1c'}} title={pathIssues[t.field||'']}>!</span>}
                          <button type="button" style={{fontSize:11}} onClick={()=>setRelTemplate(arr=>arr.filter((_,idx)=>idx!==i))}>✕</button>
                        </li>
                      ))}
                      {relTemplate.length===0 && <li style={{fontSize:11, color:'#94a3b8'}}>No tokens</li>}
                    </ul>
                    <div style={{display:'flex', gap:12, marginTop:6, alignItems:'center', flexWrap:'wrap'}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={includeRelated} onChange={e=>setIncludeRelated(e.target.checked)} /> enable relationship chaining
                      </label>
                      <label>Locale
                        <select value={locale} onChange={e=>setLocale(e.target.value)}>
                          <option value="default">default</option>
                          <option value="en-US">en-US</option>
                          <option value="en-GB">en-GB</option>
                          <option value="fr-FR">fr-FR</option>
                          <option value="de-DE">de-DE</option>
                          <option value="ja-JP">ja-JP</option>
                        </select>
                      </label>
                      <label>TZ
                        <select value={timeZone} onChange={e=>setTimeZone(e.target.value)}>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                        </select>
                      </label>
                      <span style={{fontSize:11, color:'#64748b'}}>Paths: nested.field or relationField-&gt;nested.field when chaining.</span>
                    </div>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                      <input value={newTplText} onChange={e=>setNewTplText(e.target.value)} placeholder="Text token" style={{flex:'1 1 160px'}} />
                      <button type="button" onClick={()=>{ if(!newTplText.trim()) return; setRelTemplate(arr=>[...arr, { kind:'Text', value:newTplText.trim() }]); setNewTplText(''); }}>Add Text</button>
                      <select value={newTplField} onChange={e=>setNewTplField(e.target.value)} style={{flex:'1 1 140px'}}>
                        <option value=''>Field token…</option>
                        {targetFields.map((f:any)=>(<option key={f.name} value={f.name}>{f.name}</option>))}
                      </select>
                      <input value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} placeholder="Format" style={{flex:'1 1 120px'}} />
                      <select value={newTplFormat} onChange={e=>setNewTplFormat(e.target.value)} style={{flex:'0 0 180px'}}>
                        <option value="">Format hints…</option>
                        <option value="yyyy-MM-dd">Date yyyy-MM-dd</option>
                        <option value="yyyy-MM-dd HH:mm">Date yyyy-MM-dd HH:mm</option>
                        <option value="MM/dd/yyyy">Date MM/dd/yyyy</option>
                        <option value="0.00">Number 0.00</option>
                        <option value="#,##0">Number #,##0</option>
                        <option value="currency">Currency (USD)</option>
                        <option value="percent">Percent (0.00%)</option>
                      </select>
                      <span title={formatHintsHelp} style={{fontSize:12, color:'#64748b'}}>ⓘ</span>
                      <button type="button" onClick={()=>{ if(!newTplField) return; setRelTemplate(arr=>[...arr, { kind:'Field', field:newTplField, format:newTplFormat||undefined }]); setNewTplField(''); setNewTplFormat(''); }}>Add Field</button>
                      <input type="number" value={previewRecordId} onChange={e=>setPreviewRecordId(e.target.value===''?'':parseInt(e.target.value,10))} placeholder="recordId" style={{width:90}} />
                      <button type="button" onClick={runPreview} disabled={isPreviewing}>{isPreviewing? 'Preview…':'Run Preview'}</button>
                    </div>
                    <div style={{marginTop:6, fontSize:12}}>
                      <span style={{fontWeight:600}}>Template:</span> {relTemplate.length? relTemplate.map(t=> t.kind==='Text'? t.value : `{${t.field}${t.format?`:${t.format}`:''}}`).join('') : '—'}
                    </div>
                    <div style={{marginTop:4, fontSize:12}}>
                      <span style={{fontWeight:600}}>Rendered:</span> {renderedPreview || (previewError? <span style={{color:'crimson'}}>{previewError}</span> : '—')}
                    </div>
                    {renderTokenInspector()}
                  </div>
                </div>
              )}
              {advFieldType==='AutoNumber' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Auto Number</div>
                  <label>Format
                    <input value={autoFmt} onChange={e=>setAutoFmt(e.target.value)} placeholder="CUST-{0:0000}" />
                  </label>
                  <label style={{marginTop:8}}>Start from
                    <input type='number' value={autoStart} onChange={e=>setAutoStart(parseInt(e.target.value||'1',10))} />
                  </label>
                </div>
              )}
              {advFieldType==='Number' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Number</div>
                  <div style={{display:'flex', gap:16}}>
                    <label>Precision
                      <input type='number' value={numPrecision} onChange={e=>setNumPrecision(e.target.value===''?'':parseInt(e.target.value,10))} />
                    </label>
                    <label>Scale
                      <input type='number' value={numScale} onChange={e=>setNumScale(e.target.value===''?'':parseInt(e.target.value,10))} />
                    </label>
                  </div>
                </div>
              )}
              {advFieldType==='Text' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Text</div>
                  <div style={{display:'flex', gap:16}}>
                    <label>Max Length
                      <input type='number' value={textMaxLength} onChange={e=>setTextMaxLength(e.target.value===''?'':parseInt(e.target.value,10))} />
                    </label>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                      <input type='checkbox' checked={textMultiline} onChange={e=>setTextMultiline(e.target.checked)} /> multiline
                    </label>
                  </div>
                </div>
              )}
              {advFieldType==='Currency' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Currency</div>
                  <div style={{display:'flex', gap:16}}>
                    <label>Code
                      <input value={currencyCode} onChange={e=>setCurrencyCode(e.target.value.toUpperCase())} placeholder='USD' />
                    </label>
                    <label>Precision
                      <input type='number' value={currencyPrecision} onChange={e=>setCurrencyPrecision(e.target.value===''?'':parseInt(e.target.value,10))} />
                    </label>
                    <label>Scale
                      <input type='number' value={currencyScale} onChange={e=>setCurrencyScale(e.target.value===''?'':parseInt(e.target.value,10))} />
                    </label>
                  </div>
                </div>
              )}
              {advFieldType==='Formula' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Formula</div>
                  <label>Expression
                    <input value={formulaExpr} onChange={e=>setFormulaExpr(e.target.value)} placeholder="{amount} * 1.08" />
                  </label>
                  <label style={{marginTop:8}}>Output Type
                    <select value={formulaOutputType} onChange={e=>setFormulaOutputType(e.target.value)}>
                      <option>Text</option><option>Number</option><option>Date</option><option>Currency</option>
                    </select>
                  </label>
                  <label style={{marginTop:8}}>Depends On (comma)
                    <input value={formulaDependsOn} onChange={e=>setFormulaDependsOn(e.target.value)} placeholder="amount,tax" />
                  </label>
                </div>
              )}
              {advFieldType==='RollupSummary' && (
                <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                  <div style={{fontWeight:600, marginBottom:8}}>Roll-Up Summary</div>
                  <label>Aggregate
                    <select value={rollupAggregate} onChange={e=>setRollupAggregate(e.target.value)}>
                      <option>Sum</option><option>Min</option><option>Max</option><option>Count</option>
                    </select>
                  </label>
                  <label style={{marginTop:8}}>Related Entity
                    <select value={rollupRelatedEntity} onChange={e=>setRollupRelatedEntity(e.target.value)}>
                      <option value=''>—</option>
                      {(data||[]).map(ent => (<option key={ent.entityName} value={ent.entityName}>{ent.entityName}</option>))}
                    </select>
                  </label>
                  <label style={{marginTop:8}}>Relationship Path
                    <input value={rollupRelationshipPath} onChange={e=>setRollupRelationshipPath(e.target.value)} placeholder='accounts.transactions' />
                  </label>
                  <label style={{marginTop:8}}>Source Field
                    <input value={rollupSourceField} onChange={e=>setRollupSourceField(e.target.value)} placeholder='amount' />
                  </label>
                </div>
              )}
              <div style={{display:'flex', gap:12, marginTop:4}}>
                <button onClick={async ()=>{
                  if (!selectedEntity || !advField) return
                  try {
                    const cfg = buildConfigForType({
                      kind: advFieldType,
                      pick: { options: picklistOptions, multi: pickMulti, restrict: pickRestrict },
                      rel: { kind: relKind, targetEntity: relTargetEntity, targetIsCore: relTargetIsCore, displayField: relDisplayField, onDelete: relOnDelete },
                      auto: { format: autoFmt, startFrom: autoStart },
                      number: { precision: numPrecision === '' ? undefined : numPrecision, scale: numScale === '' ? undefined : numScale },
                      text: { maxLength: textMaxLength === '' ? undefined : textMaxLength, multiline: textMultiline },
                      currency: { code: currencyCode || undefined, precision: currencyPrecision === '' ? undefined : currencyPrecision, scale: currencyScale === '' ? undefined : currencyScale },
                      formula: { expression: formulaExpr, outputType: formulaOutputType, dependsOn: formulaDependsOn },
                      rollup: { aggregate: rollupAggregate, relatedEntity: rollupRelatedEntity, relationshipPath: rollupRelationshipPath, sourceField: rollupSourceField || undefined },
                      label: fieldLabel.trim() || undefined,
                      displayTemplate: relTemplate.length ? relTemplate : undefined
                    })
                    await updateField(tId, selectedEntity, advField, {
                      name: advField,
                      dataType: mapUiTypeToServer(advFieldType),
                      isRequired: fieldReq,
                      isIndexed: fieldIdx,
                      maskingPolicy: fieldMasking || undefined,
                      readScope: fieldReadScope || undefined,
                      writeScope: fieldWriteScope || undefined,
                      defaultValue: fieldDefaultValue || undefined,
                      validation: (fieldRegex || fieldUnique) ? { regex: fieldRegex || undefined, unique: fieldUnique || undefined } : undefined,
                      config: cfg
                    }, token || undefined)
                    qc.invalidateQueries({ queryKey: ['entity-fields', tId, selectedEntity] })
                    qc.invalidateQueries({ queryKey: ['entities', tId] })
                    setAdvOpen(false); setAdvField(null)
                  } catch (e) {
                    alert('Failed to save advanced properties')
                  }
                }}>Save</button>
                <button type="button" onClick={()=>{ setAdvOpen(false); setAdvField(null) }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function mapUiTypeToServer(kind: string): string {
  // Normalize a variety of UI kinds/labels into server-supported FieldDataType
  if (typeof kind !== 'string') return 'Text'
  const raw = kind.trim()
  const lc = raw.toLowerCase()
  // Common primitives
  if (lc === 'string') return 'Text'
  if (lc === 'number') return 'Number'
  if (lc === 'boolean') return 'Checkbox'
  if (lc === 'date') return 'Date'
  // Relationship family normalization
  const isLookupish = lc.includes('lookup') || lc.includes('relationship') || lc.includes('relation')
  if (isLookupish) {
    const isExternal = lc.includes('external')
    const isHierarchy = lc.includes('hierarchy')
    const isMaster = lc.includes('master') && lc.includes('detail')
    if (isExternal) return 'ExternalLookup'
    if (isHierarchy) return 'Hierarchy'
    if (isMaster) return 'MasterDetail'
    return 'Lookup'
  }
  return raw
}

type BuildParams = {
  kind: string,
  pick: { options: PickOpt[], multi: boolean, restrict: boolean },
  rel: { kind: RelKind, targetEntity: string, targetIsCore: boolean, displayField?: string, onDelete: OnDelete },
  auto: { format: string, startFrom: number },
  number: { precision?: number, scale?: number },
  text: { maxLength?: number, multiline?: boolean },
  currency: { code?: string, precision?: number, scale?: number },
  formula: { expression: string, outputType: string, dependsOn: string },
  rollup: { aggregate: string, relatedEntity: string, relationshipPath: string, sourceField?: string }
  label?: string,
  displayTemplate?: Array<{ kind: 'Text' | 'Field'; value?: string; field?: string; format?: string }>
}

function buildConfigForType(params: BuildParams) {
  const { kind, pick, rel, auto, number, text, currency, formula, rollup, label, displayTemplate } = params
  // Canonicalize kind for downstream branching; tolerate non-string inputs
  const rawKind = typeof kind === 'string' ? kind.trim() : ''
  const lc = rawKind.toLowerCase()
  const isLookupish = lc.includes('lookup') || lc.includes('relationship') || lc.includes('relation') || lc.includes('hierarchy') || (lc.includes('master') && lc.includes('detail'))
  const canonicalRelKind: RelKind = lc.includes('external')
    ? 'ExternalLookup'
    : lc.includes('hierarchy')
    ? 'Hierarchy'
    : (lc.includes('master') && lc.includes('detail'))
    ? 'MasterDetail'
    : 'Lookup'

  if (rawKind === 'Picklist' || rawKind === 'MultiPicklist' || lc === 'picklist' || lc === 'multipicklist') {
    return {
      ...(label ? { label } : {}),
      picklist: {
        options: pick.options.map(o => ({ value: o.value, label: o.label, active: o.active ?? true })),
        multiSelect: (rawKind === 'MultiPicklist' || lc === 'multipicklist') ? true : !!pick.multi,
        restrictToOptions: !!pick.restrict
      }
    }
  }
  if (isLookupish || rawKind === 'Lookup' || rawKind === 'ExternalLookup' || rawKind === 'Hierarchy' || rawKind === 'MasterDetail') {
    return {
      ...(label ? { label } : {}),
      relationship: {
        kind: canonicalRelKind,
        targetEntity: rel.targetEntity,
        targetIsCore: !!rel.targetIsCore,
        targetKey: 'Identifier',
        displayField: rel.displayField || undefined,
        onDelete: rel.onDelete,
        displayTemplate: displayTemplate?.map(t => ({ kind: t.kind, value: t.value, field: t.field, format: t.format }))
      }
    }
  }
  if (rawKind === 'AutoNumber' || lc === 'autonumber') {
    return { ...(label ? { label } : {}), autoNumber: { format: auto.format, startFrom: auto.startFrom } }
  }
  if (rawKind === 'Number' || lc === 'number') {
    return { ...(label ? { label } : {}), number: { precision: number.precision, scale: number.scale } }
  }
  if (rawKind === 'Text' || lc === 'text' || lc === 'string') {
    return { ...(label ? { label } : {}), text: { maxLength: text.maxLength, multiline: text.multiline } }
  }
  if (rawKind === 'Currency' || lc === 'currency') {
    return { ...(label ? { label } : {}), currency: { currencyCode: currency.code, precision: currency.precision, scale: currency.scale } }
  }
  if (rawKind === 'Formula' || lc === 'formula') {
    const dependsOnArr = formula.dependsOn.split(',').map(s=>s.trim()).filter(Boolean)
    return { ...(label ? { label } : {}), formula: { expression: formula.expression, outputType: formula.outputType, dependsOn: dependsOnArr } }
  }
  if (rawKind === 'RollupSummary' || lc === 'rollupsummary' || lc === 'rollup') {
    return { ...(label ? { label } : {}), rollup: { aggregate: rollup.aggregate, relatedEntity: rollup.relatedEntity, relationshipPath: rollup.relationshipPath, sourceField: rollup.sourceField } }
  }
  return label ? { label } : undefined
}
