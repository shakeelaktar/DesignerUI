import { runInIframeFallback } from '../iframe-sandbox';

describe('iframe fallback isolation', () => {
  it('rejects window usage', async () => {
    const res = await runInIframeFallback("ui.toast(window);", { ui: {}, workflow: {}, repo: {} }, 1000);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Forbidden global usage/);
  });

  it('masked fields cannot be set', async () => {
    const script = "ui.setField('ssn', '123');";
    const ui = {
      setField: (n: string, v: any) => { if (n === 'ssn') throw new Error('Field is masked'); }
    };
    const res = await runInIframeFallback(script, { ui, workflow: {}, repo: {} }, 1000);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Field is masked/);
  });
});
