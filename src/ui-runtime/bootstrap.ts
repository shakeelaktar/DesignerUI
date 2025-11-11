import { runInIframeFallback } from './iframe-sandbox';

if (typeof window !== 'undefined') {
  (window as any).__runInIframeFallback = (script: string, api: any) => runInIframeFallback(script, api);
}
