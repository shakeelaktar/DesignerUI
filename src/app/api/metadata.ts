export type EntitySchema = {
  entityId?: string
  entityName: string
  displayName?: string
  version?: number
  isActive?: boolean
  createdOn?: string
  updatedOn?: string | null
  createdBy?: string | null
  updatedBy?: string | null
  isCore?: boolean
  fields?: Array<{ name: string; dataType: string; required?: boolean; indexed?: boolean }>
}

// Form designer DTOs
export type FormField = {
  fieldName: string
  label: string
  controlType: string
  required?: boolean
  dataType?: string
  config?: Record<string, any>
}

export type FormDefinition = {
  id: string
  tenantId: string
  name: string
  displayName: string
  version: number
  isActive: boolean
  fields: FormField[]
  meta?: Record<string, any>
}

const designerBase = (import.meta as any).env.VITE_DESIGNER_URL || '/designer'

const baseUrl = (import.meta as any).env.VITE_METADATA_URL || '/meta'

export type DataTypeDescriptor = {
  key: string
  label: string
  category: string
  kind: string
  nativeType: string
  isComputed?: boolean
  isRelationship?: boolean
  isCollection?: boolean
  defaultFormat?: string | null
}

// List (Grid) designer DTOs
export type ListColumn = { title: string; expression: string; format?: string | null; width?: number | null }
export type ListSort = { expression: string; direction: 'Asc' | 'Desc' }
export type ListFilter = { expression: string; operator: string; value?: string | null }
export type ListViewDefinition = {
  listViewId?: string
  tenantId: string
  code: string
  name: string
  entityName: string
  columns: ListColumn[]
  sorts: ListSort[]
  filters: ListFilter[]
  pageSize: number
  version: number
  isPublished: boolean
  createdOn?: string
}

export async function listEntities(tenantId: string, token?: string): Promise<EntitySchema[]> {
  const primaryUrl = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/entities`
  const fallbackUrl = baseUrl !== '/meta' ? `/meta/api/${encodeURIComponent(tenantId)}/metadata/entities` : null

  async function attempt(url: string): Promise<any[]> {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
    if (!res.ok) {
      let details = ''
      try { details = await res.text() } catch {}
      throw new Error(`Failed to list entities: HTTP ${res.status}${details ? ` - ${details}` : ''}`)
    }
    return await res.json()
  }

  let data: any[] = []
  try {
    data = await attempt(primaryUrl)
  } catch (e: any) {
    // Network-level failure: fetch() throws (e.g., DNS/connection). Retry with proxy fallback if available.
    if (fallbackUrl && (e?.message === 'Failed to fetch' || /TypeError/i.test(String(e)))) {
      try {
        data = await attempt(fallbackUrl)
      } catch (e2) {
        throw e2
      }
    } else {
      throw e
    }
  }
  // Normalize API -> UI shape: server returns `label`; UI expects `displayName`
  return (Array.isArray(data) ? data : []).map((e: any) => ({
    entityId: e.entityId,
    entityName: e.entityName,
    displayName: e.displayName ?? e.label ?? undefined,
    version: e.version,
    isActive: e.isActive,
    createdOn: e.createdOn,
    updatedOn: e.updatedOn ?? null,
    createdBy: e.createdBy ?? null,
    updatedBy: e.updatedBy ?? null,
    isCore: !!e.isCore,
    fields: (e.fields || []).map((f: any) => ({ name: f.name, dataType: f.dataType, required: f.isRequired, indexed: f.isIndexed }))
  }))
}

export async function seedCoreEntities(tenantId: string, token?: string): Promise<{ ok: boolean }> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/seed/core`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Accept':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{}) }
  })
  if (!res.ok) {
    const txt = await res.text().catch(()=> '')
    throw new Error(`Failed to seed core entities: HTTP ${res.status}${txt?` - ${txt}`:''}`)
  }
  return { ok: true }
}

export async function createEntity(tenantId: string, payload: EntitySchema, token?: string): Promise<{ ok: boolean; entity?: EntitySchema }> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/entities`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    // Server expects: EntityName (min 2), Label (required), Version (>=1), IsActive
    body: JSON.stringify({
      EntityName: payload.entityName,
      Label: payload.displayName || payload.entityName,
      Version: 1,
      IsActive: true,
    })
  })
  if (!res.ok) {
    let details = ''
    try {
      details = await res.text()
    } catch {}
    throw new Error(`Failed to create entity: HTTP ${res.status}${details ? ` - ${details}` : ''}`)
  }
  const data = await res.json()
  // Normalize response as well for displayName
  const mapped = { ...data, displayName: data.displayName ?? data.label ?? undefined }
  return { ok: true, entity: mapped }
}

export async function listDataTypes(token?: string): Promise<DataTypeDescriptor[]> {
  const url = `${baseUrl}/api/metadata/datatypes`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

export type AddFieldPayload = {
  name: string
  dataType: string
  isRequired?: boolean
  isIndexed?: boolean
  maskingPolicy?: string | null
  readScope?: string | null
  writeScope?: string | null
  validationExpression?: string | null
  defaultValue?: string | null
  config?: any
  validation?: {
    required?: boolean
    unique?: boolean
    regex?: string
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
  } | null
}

export async function addField(tenantId: string, entityName: string, payload: AddFieldPayload, token?: string): Promise<{ ok: boolean; warnings?: string[] }> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/entities/${encodeURIComponent(entityName)}/fields`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      Name: payload.name,
      DataType: payload.dataType,
      IsRequired: payload.isRequired ?? false,
      IsIndexed: payload.isIndexed ?? false,
      MaskingPolicy: payload.maskingPolicy ?? null,
      ReadScope: payload.readScope ?? null,
      WriteScope: payload.writeScope ?? null,
      ValidationExpression: payload.validationExpression ?? null,
      DefaultValue: payload.defaultValue ?? null,
      MetaJson: payload.config ? JSON.stringify(payload.config) : null,
      Config: payload.config ?? null,
      Validation: payload.validation ?? null,
    })
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch {}
    // Surface richer error context to UI callers for diagnostics
    throw new Error(`Add field failed: HTTP ${res.status}${body ? ` - ${body}` : ''}`)
  }
  try {
    const data = await res.json()
    if (data && data.warnings && Array.isArray(data.warnings)) {
      return { ok: true, warnings: data.warnings }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

export async function updateField(tenantId: string, entityName: string, fieldName: string, payload: AddFieldPayload, token?: string): Promise<{ ok: boolean }>{
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/entities/${encodeURIComponent(entityName)}/fields/${encodeURIComponent(fieldName)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      Name: payload.name,
      DataType: payload.dataType,
      IsRequired: payload.isRequired ?? false,
      IsIndexed: payload.isIndexed ?? false,
      MaskingPolicy: payload.maskingPolicy ?? null,
      ReadScope: payload.readScope ?? null,
      WriteScope: payload.writeScope ?? null,
      ValidationExpression: payload.validationExpression ?? null,
      DefaultValue: payload.defaultValue ?? null,
      MetaJson: payload.config ? JSON.stringify(payload.config) : null,
      Config: payload.config ?? null,
      Validation: payload.validation ?? null,
    })
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { ok: true }
}

export type FieldInfo = {
  name: string
  dataType: string
  isRequired?: boolean
  isIndexed?: boolean
  maskingPolicy?: string | null
  readScope?: string | null
  writeScope?: string | null
  validationExpression?: string | null
  defaultValue?: string | null
  metaJson?: string | null
}

export async function listFields(tenantId: string, entityName: string, token?: string): Promise<FieldInfo[]> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/entities/${encodeURIComponent(entityName)}/fields`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to list fields: ${res.status} ${text}`)
  }
  return await res.json()
}

// Forms API (Designer)
export async function listForms(tenantId: string, token?: string): Promise<FormDefinition[]> {
  const url = `${designerBase}/api/forms?tenantId=${encodeURIComponent(tenantId)}`
  const res = await fetch(url, { headers: { 'Accept':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{}) } })
  if (!res.ok) {
    const body = await res.text().catch(()=> '')
    throw new Error(`Failed to list forms: HTTP ${res.status}${body?` - ${body}`:''}`)
  }
  return await res.json()
}

// Lists API (Metadata Designer)
export async function listLists(tenantId: string, token?: string): Promise<ListViewDefinition[]> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/lists`
  const res = await fetch(url, { headers: { 'Accept':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{}) } })
  if (!res.ok) {
    const body = await res.text().catch(()=> '')
    throw new Error(`Failed to list lists: HTTP ${res.status}${body?` - ${body}`:''}`)
  }
  return await res.json()
}

export async function upsertList(payload: {
  tenantId: string
  code: string
  name: string
  entityName: string
  columns: ListColumn[]
  sorts: ListSort[]
  filters: ListFilter[]
  pageSize: number
  version?: number
  isPublished?: boolean
}, token?: string): Promise<ListViewDefinition> {
  const url = `${baseUrl}/api/${encodeURIComponent(payload.tenantId)}/metadata/lists`
  const body = {
    TenantId: payload.tenantId,
    Code: payload.code,
    Name: payload.name,
    EntityName: payload.entityName,
    Columns: payload.columns.map(c => ({ Title: c.title, Expression: c.expression, Format: c.format ?? null, Width: c.width ?? null })),
    Sorts: payload.sorts.map(s => ({ Expression: s.expression, Direction: s.direction })),
    Filters: payload.filters.map(f => ({ Expression: f.expression, Operator: f.operator, Value: f.value ?? null })),
    PageSize: payload.pageSize,
    Version: payload.version ?? 1,
    IsPublished: payload.isPublished ?? false
  }
  const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Accept':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{}) }, body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text().catch(()=> '')
    throw new Error(`Failed to save list: HTTP ${res.status}${txt?` - ${txt}`:''}`)
  }
  return await res.json()
}

export async function deleteList(tenantId: string, code: string, token?: string): Promise<boolean> {
  const url = `${baseUrl}/api/${encodeURIComponent(tenantId)}/metadata/lists/${encodeURIComponent(code)}`
  const res = await fetch(url, { method:'DELETE', headers:{ ...(token?{'Authorization':`Bearer ${token}`}:{}) } })
  return res.ok
}

export async function upsertForm(payload: { tenantId: string; name: string; displayName: string; fields: FormField[] }, token?: string): Promise<FormDefinition> {
  const url = `${designerBase}/api/forms`
  // Server expects PascalCase PublishFormRequest: TenantId, Name, DisplayName, Fields
  const body = {
    TenantId: payload.tenantId,
    Name: payload.name,
    DisplayName: payload.displayName,
    Fields: (payload.fields || []).map(f => ({
      FieldName: f.fieldName,
      Label: f.label,
      ControlType: f.controlType,
      Required: !!f.required,
      DataType: f.dataType || null,
      Config: f.config || null
    }))
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Accept':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{}) },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text().catch(()=> '')
    throw new Error(`Failed to save form: HTTP ${res.status}${txt?` - ${txt}`:''}`)
  }
  return await res.json()
}

export async function deleteForm(id: string, token?: string): Promise<boolean> {
  const url = `${designerBase}/api/forms/${encodeURIComponent(id)}`
  const res = await fetch(url, { method: 'DELETE', headers: { ...(token?{'Authorization':`Bearer ${token}`}:{}) } })
  return res.ok
}
