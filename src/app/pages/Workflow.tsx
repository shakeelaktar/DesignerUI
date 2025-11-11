import React, { useMemo, useState } from 'react'

type NodeType = 'start' | 'task' | 'decision' | 'end'
type NodeModel = {
  id: string
  type: NodeType
  label: string
}

const typeColor: Record<NodeType, string> = {
  start: '#16a34a',
  task: '#2563eb',
  decision: '#d97706',
  end: '#dc2626',
}

export default function Workflow() {
  const [nodes, setNodes] = useState<NodeModel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId])

  const addNode = (type: NodeType) => {
    const id = `${type}-${Date.now().toString(36)}`
    const label = type[0].toUpperCase() + type.slice(1)
    setNodes(prev => [...prev, { id, type, label }])
    setSelectedId(id)
  }

  const updateLabel = (id: string, label: string) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, label } : n)))
  }

  return (
    <div style={{display:'grid', gridTemplateColumns:'260px 1fr 320px', gap:12, minHeight:'70vh'}}>
      <aside style={{borderRight:'1px solid #e5e7eb', paddingRight:12}}>
        <h3 style={{marginTop:0}}>Palette</h3>
        <div style={{display:'grid', gap:8}}>
          <button onClick={() => addNode('start')} style={{background:'#ecfdf5', border:'1px solid #bbf7d0', color:'#065f46', padding:'6px 10px', borderRadius:6}}>+ Start</button>
          <button onClick={() => addNode('task')} style={{background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1e40af', padding:'6px 10px', borderRadius:6}}>+ Task</button>
          <button onClick={() => addNode('decision')} style={{background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', padding:'6px 10px', borderRadius:6}}>+ Decision</button>
          <button onClick={() => addNode('end')} style={{background:'#fef2f2', border:'1px solid #fecaca', color:'#991b1b', padding:'6px 10px', borderRadius:6}}>+ End</button>
        </div>
      </aside>
      <section>
        <h2 style={{marginTop:0}}>Canvas</h2>
        <div style={{position:'relative', border:'1px solid #e5e7eb', borderRadius:8, height:'60vh', padding:12, overflow:'auto', background:'#fafafa'}}>
          {nodes.length === 0 && (
            <div style={{color:'#6b7280', fontSize:14}}>Add nodes from the palette to start designing.</div>
          )}
          <div style={{display:'grid', gap:12}}>
            {nodes.map((n, idx) => (
              <div
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                style={{
                  border:'1px solid #e5e7eb',
                  borderRadius:8,
                  background:'#fff',
                  boxShadow: selectedId === n.id ? '0 0 0 2px #93c5fd' : '0 1px 2px rgba(0,0,0,0.04)',
                  padding:'10px 12px',
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  cursor:'pointer',
                }}
              >
                <span style={{display:'inline-block', width:10, height:10, borderRadius:999, background:typeColor[n.type]}} />
                <strong style={{minWidth:80, textTransform:'capitalize'}}>{n.type}</strong>
                <span style={{color:'#64748b'}}>•</span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <aside style={{borderLeft:'1px solid #e5e7eb', paddingLeft:12}}>
        <h3 style={{marginTop:0}}>Properties</h3>
        {!selected && <div style={{color:'#6b7280', fontSize:14}}>Select a node to edit its properties.</div>}
        {selected && (
          <div style={{display:'grid', gap:10}}>
            <div style={{fontSize:12, color:'#64748b'}}>ID</div>
            <div style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize:12, background:'#f8fafc', border:'1px solid #e5e7eb', padding:'6px 8px', borderRadius:6}}>{selected.id}</div>
            <label style={{display:'grid', gap:4}}>Type
              <input value={selected.type} readOnly style={{background:'#f8fafc', border:'1px solid #e5e7eb', padding:'6px 8px', borderRadius:6}} />
            </label>
            <label style={{display:'grid', gap:4}}>Label
              <input
                value={selected.label}
                onChange={e => updateLabel(selected.id, e.target.value)}
                placeholder="Friendly name"
                style={{border:'1px solid #94a3b8', padding:'6px 8px', borderRadius:6}}
              />
            </label>
          </div>
        )}
      </aside>
    </div>
  )
}
