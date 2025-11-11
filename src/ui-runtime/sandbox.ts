// Lightweight sandbox for tenant UI scripts.
// Runs tenant script code in a restricted Function scope with limited globals and a simple timeout.

export type SandboxResult = { success: boolean; error?: string };

const FORBIDDEN_GLOBALS = ["window", "document", "fetch", "XMLHttpRequest", "WebSocket", "eval", "Function", "process", "require", "globalThis"];

export function runInSandbox(code: string, sandboxApi: Record<string, any>, timeoutMs = 2000): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const keys = Object.keys(sandboxApi);
    const values = keys.map(k => sandboxApi[k]);

    // Create restricted code wrapper
    const wrapped = `"use strict";\nreturn (async function(ui, workflow, repo, context){\n  try {\n    ${code}\n  } catch(e) {\n    throw e;\n  }\n});`;

    // Disallow forbidden globals by scanning code (best-effort static check)
    for (const g of FORBIDDEN_GLOBALS) {
      if (code.includes(g)) {
        resolve({ success: false, error: `Forbidden global usage: ${g}` });
        return;
      }
    }

    let fn: Function;
    try {
      // The Function constructor is used to create a lexical scope for code execution.
      // We do not expose other globals; the wrapper returns an async function(ui, workflow, repo, context)
      fn = new Function(...keys, wrapped);
    } catch (ex) {
      resolve({ success: false, error: `Compilation error: ${String(ex)}` });
      return;
    }

    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve({ success: false, error: 'Timeout' });
      }
    }, timeoutMs);

    (async () => {
      try {
        const inner = fn(...values);
        const executor = inner as (ui: any, workflow: any, repo: any, context: any) => Promise<any>;
        await executor(sandboxApi.ui, sandboxApi.workflow, sandboxApi.repo, sandboxApi.context);
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve({ success: true });
        }
      } catch (ex) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve({ success: false, error: String(ex) });
        }
      }
    })();
  });
}
