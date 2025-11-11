import { runInSandbox } from '../sandbox';
import { createSdk } from '../sdk';

// Basic isolation tests
describe('sandbox', () => {
  it('should forbid window access', async () => {
    const code = `ui.toast(window ? 'bad' : 'ok');`;
    const sdk = createSdk({});
    const result = await runInSandbox(code, { ui: sdk.ui, workflow: sdk.workflow, repo: sdk.repo, context: { event: 'FormLoad' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Forbidden global usage/);
  });

  it('should run a safe script', async () => {
    const code = `ui.toast('hello');`;
    let toastCalled = false;
    (globalThis as any).__ui_runtime_toast = (m: any) => { toastCalled = true; };
    const sdk = createSdk({});
    const result = await runInSandbox(code, { ui: sdk.ui, workflow: sdk.workflow, repo: sdk.repo, context: { event: 'FormLoad' } });
    expect(result.success).toBe(true);
    expect(toastCalled).toBe(true);
  });

  it('masked fields cannot be set', async () => {
    const code = `ui.setField('ssn', '123-45-6789');`;
    const sdk = createSdk({ maskFields: ['ssn'] });
    const result = await runInSandbox(code, { ui: sdk.ui, workflow: sdk.workflow, repo: sdk.repo, context: { event: 'FieldChange' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Field is masked/);
  });
});
