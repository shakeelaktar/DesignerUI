import { runInIframe } from '../iframe-sandbox';

describe('iframe sandbox', () => {
  it('executes simple script and returns success', async () => {
    // simple script without globals
    const script = `const a = 1;`;
    const res = await runInIframe(script, {} as any, 2000);
    expect(res.success).toBe(true);
  });
});
