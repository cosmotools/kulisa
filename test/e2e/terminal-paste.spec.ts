// Image paste through the OS's Paste action and the terminal's menu (docs/window.md, The terminal).
import { test, expect } from './fixtures.ts';
import { choose, focusWindow, rightClick, termKeys } from './helpers.ts';

for (const menu of [false, true]) {
  test(`clipboard image: ${menu ? 'the terminal menu' : "the OS's Paste action"} sends the agent's image shortcut once`, async ({ core, ui }) => {
    await core(async (k) => {
      const t = k.shell.task.promptTarget();
      await t.pty.typed;
      Object.assign(t.agent, { imagePaste: '\x16' });
      k.stash.input = [];
      k.stash.write = t.pty.write;
      // Observe the pty boundary: the fixture's cat treats Ctrl+V as quoting the next key.
      t.pty.write = (data) => { k.stash.input.push(data); };
      const png = k.electron.nativeImage.createFromBitmap(Buffer.alloc(16, 255), { width: 2, height: 2 }).toPNG();
      await k.electron.clipboard.write([new k.electron.ClipboardItem({
        'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }),
        'text/plain': new Blob(['image fallback text'], { type: 'text/plain' }),
      })]);
    });
    try {
      await focusWindow(core, ui);
      await termKeys(ui).focus();
      if (menu) {
        await rightClick(ui, '[data-testid="terminal"] .xterm-screen');
        await choose(ui, 'Paste');
      } else {
        // macOS runs the Edit menu's role outside page key events; paste() is that role's action.
        await core((k) => k.shell.win.webContents.paste());
      }
      await expect.poll(() => core((k) => k.stash.input)).toEqual(['\x16']);
    } finally {
      await core((k) => { k.shell.pty.write = k.stash.write; });
    }
  });
}
