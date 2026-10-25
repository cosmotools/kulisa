// What the e2e test files share (docs/testing.md, End to end on Playwright Test).
// The test site: the run's own (global-setup.ts).
export const SITE = process.env.KULISA_TEST_SITE;
export const MAC = process.platform === 'darwin';
// What Windows does its own way: the terminal copies and pastes with Ctrl+C / V.
export const WIN = process.platform === 'win32';

// What the terminal in the window shows ('' while none is shown yet), as the screen reads: lines wrapped at its width
// joined again, and each line's trailing spaces dropped (ConPTY pads a line repainted after a resize).
export const termText = (ui: import('@playwright/test').Page) => ui.evaluate(() => {
  const b = (window as any).__term?.buffer.active;
  if (!b) return '';
  return Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l: any, i) => (i && !l.isWrapped ? '\n' : '') + l.translateToString(true)).join('')
    .split('\n').map((l) => l.replace(/ +$/, '')).join('\n');
});
