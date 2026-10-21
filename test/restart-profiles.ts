// After a restart, what agent.ts, profiles.ts and zoom-and-closing.ts left: profiles, sign-ins, tabs, zoom.
import fs from 'fs';
import path from 'path';
import { assert, userData, pfile, folderOf, SITE, sleep, waitFor, who } from './helpers.ts';
import type { Test } from './run.ts';

export default (test: Test) => {
  test('after a restart: profiles, sign-ins and tabs are back, the one in front in front', async (ctx) => {
    assert.deepEqual([...ctx.shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.deepEqual([...ctx.shell.profiles.values()].map((p) => [p.avatar, p.description]), [['fox', 'seller in the test shop'], ['owl', '']]);
    // The deleted ones' copies and masters removed; the live ones keep their folders.
    const live = ctx.shell.profileStore.all().map((p) => p.folder), dirs = (d: string) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    assert.deepEqual([dirs(pfile('')).filter((f) => !live.includes(f)), dirs(path.join(userData, 'profiles')).filter((f) => !live.includes(f))], [[], []]);
    assert.ok(fs.existsSync(pfile(folderOf('sam-admin'))));
    assert.ok(!fs.existsSync(path.join(userData, 'deleted-folders.json')));
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    const elon = ctx.shell.profiles.get('elon-buyer');
    assert.deepEqual(elon.tabs.map((t) => t.wc.getURL()), [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
    assert.equal(elon.active, elon.tabs[1].id, 'the tab in front as it was left');
    assert.equal(elon.signinMode, false);
  });
  test('after a restart: a closed profile is still closed, and opens signed in', async (ctx) => {
    assert.ok(ctx.shell.closed.has('dora') && !ctx.shell.profiles.has('dora'));
    await ctx.call('profile_open', { profile: 'dora' });
    assert.equal(await who(ctx, 'dora'), 'Signed in as dora');
    await ctx.call('profile_delete', { profile: 'dora' });
  });
  test("a packaged build (appDevTools off): no DevTools for Kulisa's own UI, a tab's still open", async ({ shell }) => {
    const press = (wc: Electron.WebContents) => { wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F12' }); };
    press(shell.win.webContents);
    shell.win.webContents.openDevTools({ mode: 'detach' });
    await sleep(500); // nothing to wait for: that they do not open
    assert.equal(shell.win.webContents.isDevToolsOpened(), false);
    const tab = shell.profiles.get('sam-admin').get().wc;
    press(tab);
    await waitFor(() => tab.isDevToolsOpened());
    tab.closeDevTools();
  });
  test('after a restart: the Kulisa zoom and a site\'s page zoom are as they were left', async ({ shell }) => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    await waitFor(() => near(shell.win.webContents.getZoomFactor(), 1.25));
    const tab = shell.profiles.get('sam-admin').newTab(`${SITE}/app?after-restart`);
    await tab.ready;
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1), 3000);
    tab.wc.close();
  });
};
