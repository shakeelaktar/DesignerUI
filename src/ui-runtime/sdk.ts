// SDK exposed to tenant UI scripts. Methods are intentionally small and validate inputs.

export type UIContext = { formId: string; tenantId: string; recordId?: string };

export function createSdk(options: { maskFields?: string[]; submitBlocked?: boolean }) {
  let submitBlocked = !!options.submitBlocked;
  const maskSet = new Set(options.maskFields ?? []);

  const ui = {
    getField: (name: string) => {
      if (!name) throw new Error('field name required');
      // In runtime this will be filled with runtime-provided accessors.
      return (window as any).__ui_runtime_get?.(name);
    },
    setField: (name: string, value: any) => {
      if (!name) throw new Error('field name required');
      if (maskSet.has(name)) throw new Error('Field is masked');
      return (window as any).__ui_runtime_set?.(name, value);
    },
    show: (selector: string) => {
      return (window as any).__ui_runtime_show?.(selector);
    },
    hide: (selector: string) => {
      return (window as any).__ui_runtime_hide?.(selector);
    },
    toast: (msg: string) => {
      return (window as any).__ui_runtime_toast?.(msg);
    },
    blockSubmit: (b: boolean) => {
      submitBlocked = !!b;
      return submitBlocked;
    },
    isSubmitBlocked: () => submitBlocked,
  };

  const workflow = {
    start: (name: string, payload?: any) => {
      return (window as any).__ui_runtime_workflow_start?.(name, payload);
    }
  };

  const repo = {
    call: (name: string, payload?: any) => {
      if (!name) throw new Error('repo call name required');
      return (window as any).__ui_runtime_repo_call?.(name, payload);
    }
  };

  return { ui, workflow, repo };
}

import { runInIframeFallback } from './iframe-sandbox';

export async function runScriptInIframe(script: string, sdkApi: { ui:any, workflow:any, repo:any }){
  if (typeof window === 'undefined') throw new Error('No window');
  try {
    if ((window as any).__runInIframe) {
      return await (window as any).__runInIframe(script, sdkApi);
    }
    if ((window as any).runInIframe) {
      return await (window as any).runInIframe(script, sdkApi);
    }
  } catch { /* fallthrough to fallback */ }
  // fallback to in-process function for test environments
  if ((window as any).__runInIframeFallback) {
    return await (window as any).__runInIframeFallback(script, sdkApi);
  }
  if ((window as any).runInIframeFallback) {
    return await (window as any).runInIframeFallback(script, sdkApi);
  }
  // Last-resort: use the imported fallback runner (works in jsdom/tests)
  return await runInIframeFallback(script, sdkApi);
}
