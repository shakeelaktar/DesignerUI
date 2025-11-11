import React, { useEffect, useState } from 'react';
import { createSdk, runScriptInIframe } from './sdk';

export type FormRendererProps = {
  tenantId: string;
  scriptBody?: string; // inline script (already transpiled JS) for demo/testing
  scriptId?: string; // optional persisted script id to fetch
};

export default function FormRenderer({ tenantId, scriptBody, scriptId }: FormRendererProps) {
  const [email, setEmail] = useState('');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      let body = scriptBody;
        if (!body && scriptId) {
        try {
            const res = await fetch(`/admin/tenant-scripts/${scriptId}?tenantId=${tenantId}`);
          if (res.ok) {
            const json = await res.json();
            body = json.script || json.Script || json.ScriptBody || json.scriptBody;
          }
        } catch {
          // ignore
        }
      }
      if (!body || cancelled) return;
      const sdk = createSdk({ maskFields: ['ssn'] });
      const masked = new Set(['ssn']);
      const uiImpl = {
        toast: (m: any) => console.log('toast', m),
        getField: (n: any) => n === 'email' ? email : undefined,
        setField: (n: any, v: any) => { if (masked.has(n)) throw new Error('Field is masked'); if (n === 'email') setEmail(String(v)); }
      };
      runScriptInIframe(`(async function(){ ${body} })()`, { ui: uiImpl, workflow: sdk.workflow, repo: sdk.repo }).then(r => {
        if (!r.success) console.warn('script failed', r.error);
      });
    }
    run();
    return () => { cancelled = true; };
  }, [scriptBody, tenantId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let body = scriptBody;
      if (!body && scriptId) {
      try {
          const res = await fetch(`/admin/tenant-scripts/${scriptId}?tenantId=${tenantId}`);
        if (res.ok) {
          const json = await res.json();
          body = json.script || json.Script || json.ScriptBody || json.scriptBody;
        }
      } catch {}
    }
    if (!body) return;
    const sdk = createSdk({ maskFields: ['ssn'] });
    const masked = new Set(['ssn']);
    const uiImpl = {
      toast: (m: any) => console.log('toast', m),
      getField: (n: any) => n === 'email' ? email : undefined,
      setField: (n: any, v: any) => { if (masked.has(n)) throw new Error('Field is masked'); if (n === 'email') setEmail(String(v)); }
    };
    const res = await runScriptInIframe(`(async function(){ ${body} })()`, { ui: uiImpl, workflow: sdk.workflow, repo: sdk.repo });
    if (!res.success) {
      console.warn('before submit script failed', res.error);
    }
    if ((sdk.ui as any).isSubmitBlocked && (sdk.ui as any).isSubmitBlocked()) {
      setBlocked(true);
      return;
    }
    // proceed with submit
    alert('submitted: ' + email);
  };

  return (
    <form onSubmit={onSubmit} style={{maxWidth:400}}>
      <label>Email <input value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div style={{marginTop:12}}>
        <button type="submit">Submit</button>
      </div>
      {blocked && <div style={{color:'red'}}>Submission blocked by script</div>}
    </form>
  );
}
