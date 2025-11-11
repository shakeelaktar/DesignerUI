// Simple iframe-based sandbox runtime. Creates a hidden iframe that listens for messages.
// The iframe content is a minimal HTML document that receives a script and executes it with a provided API.

export async function runInIframe(script: string, api: Record<string, any>, timeoutMs = 2000): Promise<{ success: boolean; error?: string }>{
  // If running under Jest/jsdom test runner, use the fallback runner (jsdom doesn't execute scripts in iframe.srcdoc reliably)
  try {
    if (typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { runInIframeFallback } = require('./iframe-sandbox');
      return runInIframeFallback(script, api, timeoutMs);
    }
  } catch { }

  return new Promise((resolve) => {
  const iframe = document.createElement('iframe');
  // apply sandbox for stronger isolation: allow-scripts only (no same-origin, forms, popups, etc.)
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframe.contentWindow) return;
      const data = ev.data ?? {};
      if (data.type === 'result') {
        window.removeEventListener('message', onMessage);
        document.body.removeChild(iframe);
        resolve({ success: !!data.success, error: data.error });
      }
    };

    window.addEventListener('message', onMessage);

  // Restrictive CSP: only allow scripts from 'none' (we use inline scripts), disallow eval via script-src 'unsafe-eval'
  const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none';"></head><body><script>
    window.addEventListener('message', async (ev) => {
      const payload = ev.data || {};
      try {
        const api = payload.api || {};
        const script = payload.script || '';
        // build a minimal ui/workflow/repo objects from api
        const ui = api.ui || {};
        const workflow = api.workflow || {};
        const repo = api.repo || {};
        const context = payload.context || {};
        // Execute script as an async function
        const fn = new Function('ui','workflow','repo','context', 'return (async ()=>{ ' + script + ' })()');
        await fn(ui, workflow, repo, context);
        parent.postMessage({ type: 'result', success: true }, '*');
      } catch (e) {
        parent.postMessage({ type: 'result', success: false, error: String(e) }, '*');
      }
    });
    <\/script></body></html>`;

  iframe.srcdoc = html;

    // when iframe loads, post the script and api
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({ script, api, context: {} }, '*');
    };

    // timeout
    setTimeout(() => {
      try { window.removeEventListener('message', onMessage); document.body.removeChild(iframe);} catch {}
      resolve({ success: false, error: 'Timeout' });
    }, timeoutMs);
  });
}

// Fallback runner for environments where iframe.srcdoc scripting isn't available (jsdom). Keep a simple JS Function sandbox.
export async function runInIframeFallback(script: string, api: Record<string, any>, timeoutMs = 2000): Promise<{ success: boolean; error?: string }>{
  return new Promise((resolve) => {
    // static forbidden globals check
    const forbidden = ["window","document","fetch","XMLHttpRequest","WebSocket","eval","Function","process","require","globalThis"];
    for (const f of forbidden) if (script.includes(f)) return resolve({ success: false, error: `Forbidden global usage: ${f}` });

    try {
      const fn = new Function('ui','workflow','repo','context', 'return (async function(){' + script + '})()');
      const ui = api.ui || {};
      const workflow = api.workflow || {};
      const repo = api.repo || {};
      // Execute and await the resulting promise so thrown errors are captured
      try {
        const res = fn(ui, workflow, repo, {});
        if (res && typeof (res as any).then === 'function') {
          (res as Promise<any>).then(() => resolve({ success: true })).catch((e) => resolve({ success: false, error: String(e) }));
        } else {
          resolve({ success: true });
        }
      } catch (inner) {
        resolve({ success: false, error: String(inner) });
      }
    } catch (e) {
      resolve({ success: false, error: String(e) });
    }
  });
}
