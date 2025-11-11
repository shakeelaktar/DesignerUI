const GATEWAY_BASE: string = (import.meta as any).env?.VITE_GATEWAY_BASE || ''
const RUNTIME_BASE: string = (import.meta as any).env?.VITE_RUNTIME_BASE 
  || ((import.meta as any).env?.VITE_GATEWAY_BASE ? `${(import.meta as any).env.VITE_GATEWAY_BASE}/runtime` : '/runtime')

export type AuditSummaryRow = {
  recordId: number
  actionType: string
  performedBy: string
  createdOn: string
  changed: number
  added: number
  removed: number
}

export type AuditSummaryResponse = {
  items: AuditSummaryRow[]
  total: number
  nextPageToken?: string
}

export async function fetchAuditSummary(params: {
  baseUrl?: string
  tenantId: string
  entityName: string
  limit?: number
  actionType?: string
  performedBy?: string
  nextPageToken?: string
  token?: string
}): Promise<AuditSummaryResponse> {
  const {
    baseUrl = GATEWAY_BASE,
    tenantId,
    entityName,
    limit = 10,
    actionType,
    performedBy,
    nextPageToken,
    token,
  } = params

  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  qs.set('view', 'summary')
  if (actionType) qs.set('actionType', actionType)
  if (performedBy) qs.set('performedBy', performedBy)
  if (nextPageToken) qs.set('nextPageToken', nextPageToken)

  // Default to ApiGateway dev-portal alias path
  const url = `${baseUrl}/devportal/audit/${encodeURIComponent(tenantId)}/${encodeURIComponent(entityName)}?${qs.toString()}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Audit fetch failed: ${res.status} ${text}`)
  }
  return res.json()
}

export type RuntimeRecord = {
  recordId: number
  createdOn: string
  updatedOn?: string | null
  fields: Record<string, any>
}

export type ListRecordsResponse = {
  records: RuntimeRecord[]
  total: number
}

export async function getRecordById(params: {
  tenantId: string
  entityName: string
  recordId: number
  token?: string
  userId?: string
}): Promise<RuntimeRecord | null> {
  const { tenantId, entityName, recordId, token, userId } = params
  const url = `${RUNTIME_BASE}/api/${encodeURIComponent(tenantId)}/entities/${encodeURIComponent(entityName)}/records/${recordId}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-Tenant-Id': tenantId,
      ...(userId ? { 'X-User-Id': userId } : {}),
    }
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(()=> '')
    throw new Error(`Get record failed: ${res.status} ${text}`)
  }
  const data = await res.json() as { RecordId: number; CreatedOn: string; UpdatedOn?: string | null; Fields: Record<string, any> }
  return { recordId: data.RecordId, createdOn: data.CreatedOn, updatedOn: data.UpdatedOn ?? null, fields: data.Fields || {} }
}

export async function listRecords(params: {
  tenantId: string
  entityName: string
  page?: number
  pageSize?: number
  q?: string
  sort?: string
  token?: string
  userId?: string
}): Promise<ListRecordsResponse> {
  const { tenantId, entityName, page = 1, pageSize = 20, q, sort, token, userId } = params
  const qs = new URLSearchParams()
  if (page) qs.set('page', String(page))
  if (pageSize) qs.set('pageSize', String(pageSize))
  if (q) qs.set('q', q)
  if (sort) qs.set('sort', sort)
  const url = `${RUNTIME_BASE}/api/${encodeURIComponent(tenantId)}/entities/${encodeURIComponent(entityName)}/records?${qs.toString()}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      // Runtime API requires tenant/user headers for context
      'X-Tenant-Id': tenantId,
      ...(userId ? { 'X-User-Id': userId } : {}),
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Runtime list failed: ${res.status} ${text}`)
  }
  const data = await res.json() as { Records: any[]; Total: number }
  const normalized: ListRecordsResponse = {
    total: data.Total,
    records: (data.Records || []).map(r => ({
      recordId: r.RecordId,
      createdOn: r.CreatedOn,
      updatedOn: r.UpdatedOn ?? null,
      fields: r.Fields || {}
    }))
  }
  return normalized
}

export async function createRecord(params: {
  tenantId: string
  entityName: string
  payload: Record<string, any>
  token?: string
  userId?: string
}): Promise<{ recordId: number }> {
  const { tenantId, entityName, payload, token, userId } = params
  const url = `${RUNTIME_BASE}/api/${encodeURIComponent(tenantId)}/entities/${encodeURIComponent(entityName)}/records`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-Tenant-Id': tenantId,
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const text = await res.text().catch(()=> '')
    throw new Error(`Create failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return { recordId: data.RecordId ?? data.recordId ?? 0 }
}

export async function lookupSearch(params: {
  tenantId: string
  entityName: string
  displayField: string
  q?: string
  limit?: number
  token?: string
}): Promise<Array<{ recordId: number; display: string }>> {
  const { tenantId, entityName, displayField, q, limit = 20, token } = params
  const qs = new URLSearchParams()
  qs.set('displayField', displayField)
  if (q) qs.set('q', q)
  if (limit) qs.set('limit', String(limit))
  // Use Metadata API base for now (could route via gateway if needed)
  const base = (import.meta as any).env.VITE_METADATA_URL || '/meta'
  const url = `${base}/tenants/${encodeURIComponent(tenantId)}/entities/${encodeURIComponent(entityName)}/lookup?${qs.toString()}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(()=> '')
    throw new Error(`Lookup search failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data.map((r:any)=> ({ recordId: r.recordId ?? r.RecordId, display: r.display ?? r.Display })) : []
}

export type DisplayToken = { kind: 'Text' | 'Field'; value?: string; field?: string; format?: string }

export async function previewDisplay(params: {
  tenantId: string
  entityName: string
  recordId: number
  tokens: DisplayToken[]
  token?: string
  userId?: string
}): Promise<string> {
  const { tenantId, entityName, recordId, tokens, token, userId } = params
  const url = `${RUNTIME_BASE}/api/${encodeURIComponent(tenantId)}/entities/${encodeURIComponent(entityName)}/preview/display`
  const body = {
    recordId,
    tokens: tokens.map(t => ({ kind: t.kind, value: t.value, field: t.field, format: t.format }))
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-Tenant-Id': tenantId,
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(()=> '')
    throw new Error(`Preview failed: ${res.status} ${text}`)
  }
  const data = await res.json().catch(()=>({})) as any
  return data.rendered || ''
}
