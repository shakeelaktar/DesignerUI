import React, { useState } from 'react'
import { runInSandbox } from './ui-runtime/sandbox'
import { createSdk } from './ui-runtime/sdk'
import { runScriptInIframe } from './ui-runtime/sdk'
import FormRenderer from './ui-runtime/FormRenderer'

// In Codespaces, Vite proxies '/api' -> TriggerService (5002)
const TRIGGER_URL = import.meta.env.VITE_TRIGGER_URL || '/api'

export default function App() {
  const [email, setEmail] = useState('lead@example.com')
  const [source, setSource] = useState('Webinar Signup')
  const [name, setName] = useState('Aisha')

  async function run() {
    const payload = {
      entity: 'Lead',
      recordId: 'lead-123',
      data: {
        Lead: { Email: email, Source: source, Name: name }
      }
    }
    const res = await fetch(`${TRIGGER_URL}/triggers/ui/Lead.SendWelcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const text = await res.text()
    alert('Triggered! ' + text)
  }

  async function runFormScript() {
    // demo: fetch script for tenant-001 Customer_Form_v1 (scriptId must be known).
    const scriptId = prompt('Enter ScriptId (GUID) for Customer_Form_v1') || '';
    if (!scriptId) return;
    const res = await fetch(`/admin/tenant-scripts/${scriptId}?tenantId=tenant-001`);
    if (!res.ok) { alert('Script not found'); return; }
    const payload = await res.json();
    const script = payload.script ?? payload.Script ?? payload.ScriptBody ?? payload.scriptBody;
    const sdk = createSdk({ maskFields: ['ssn'] });
    // provide runtime implementations used by SDK (these are shallow dummies for demo)
    const uiImpl = {
      toast: (m: any) => alert(String(m)),
      getField: (n: any) => { if (n === 'email') return email; return null; },
      setField: (n: any, v: any) => { if (n === 'email') setEmail(String(v)); }
    };
    // run in iframe (preferred) with sdk-backed api surface
    const result = await runScriptInIframe(`(async function(){ ${script} })()`, { ui: uiImpl, workflow: sdk.workflow, repo: sdk.repo });
    if (!result.success) alert('Script failed: ' + result.error);
  }

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', padding: 24}}>
      <h2>XStudio Workflow Designer (Demo)</h2>
      <p>Click the button to fire a <b>UI Action Trigger</b> for a new Lead. Orchestrator will evaluate conditions and run actions.</p>

      <div style={{display:'grid', gap:12, maxWidth:480}}>
        <label>Email <input value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Source <input value={source} onChange={e=>setSource(e.target.value)} /></label>
        <label>Name <input value={name} onChange={e=>setName(e.target.value)} /></label>
      </div>

      <button style={{marginTop:16, padding:'8px 16px'}} onClick={run}>Run UI Action</button>
  <button style={{marginLeft:8, marginTop:16, padding:'8px 16px'}} onClick={runFormScript}>Run Form Script (demo)</button>

    <hr />
    <h3>Form Renderer Demo</h3>
  <FormRenderer tenantId="tenant-001" scriptId="090f4f6a-6134-496c-a4b6-12502097c852" />

      <hr style={{margin:'24px 0'}}/>
      <details>
        <summary>What happens?</summary>
        <ol>
          <li>UI calls <code>TriggerService</code> (<code>/triggers/ui/Lead.SendWelcome</code>).</li>
          <li><code>TriggerService</code> forwards <i>WorkflowRequested</i> to <code>Orchestrator</code>.</li>
          <li><code>Orchestrator</code> pulls workflows from <code>DesignerApi</code>, evaluates conditions.</li>
          <li>If matched, <code>ActionRuntime</code> executes nodes (SendEmail, UpdateRecord) and logs to console.</li>
        </ol>
      </details>
    </div>
  )
}
