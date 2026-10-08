// The second run, after a restart: what was left is back.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near, projectTabs } = require('./helpers');

module.exports = (test) => {
  test('after a restart: profiles, sign-ins and tabs are back', async (ctx) => {
    assert.deepEqual([...ctx.shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.deepEqual([...ctx.shell.profiles.values()].map((p) => [p.avatar, p.description]), [['fox', 'seller in the test shop'], ['owl', '']]);
    for (const dir of ['Profile 3', 'Profile 4', 'Profile 5']) assert.ok(!fs.existsSync(pfile(dir)), `${dir} (deleted) removed`);
    assert.ok(fs.existsSync(pfile('Profile 1')), 'live profiles keep their folders');
    assert.ok(!fs.existsSync(path.join(userData, 'deleted-folders.json')));
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    const elon = ctx.shell.profiles.get('elon-buyer');
    assert.deepEqual(elon.tabs.map((t) => t.wc.getURL()), [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
    assert.equal(elon.signinMode, false);
  });
  test('after a restart: a closed profile is still closed, and opens signed in', async (ctx) => {
    assert.ok(ctx.shell.closed.has('dora') && !ctx.shell.profiles.has('dora'));
    await ctx.call('profile_open', { profile: 'dora' });
    assert.equal(await who(ctx, 'dora'), 'Signed in as dora');
    await ctx.call('profile_delete', { profile: 'dora' });
  });
  test("a packaged build (appDevTools off): no DevTools for Kulisa's own UI, a tab's still open", async ({ shell }) => {
    const press = (wc) => { wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F12' }); };
    press(shell.win.webContents);
    shell.win.webContents.openDevTools({ mode: 'detach' });
    await sleep(500);
    assert.equal(shell.win.webContents.isDevToolsOpened(), false);
    const tab = shell.profiles.get('sam-admin').get().wc;
    press(tab);
    await waitFor(() => tab.isDevToolsOpened());
    tab.closeDevTools();
  });
  test('after a restart: the Kulisa zoom and a site\'s page zoom are as they were left', async ({ shell }) => {
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    await waitFor(() => near(shell.win.webContents.getZoomFactor(), 1.25));
    const tab = shell.profiles.get('sam-admin').newTab(`${SITE}/app?after-restart`);
    await tab.ready;
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1), 3000);
    tab.wc.close();
  });
  test('after a restart: the fork waits in the bar with its tabs, loads when shown, still signed in; main again', async (ctx) => {
    const { shell, ui } = ctx;
    await waitFor(async () => (await ui(`[...document.querySelectorAll('#wslist .wstab')].map((t) => t.querySelector('.name').textContent).join()`)) === 'main,Feature-X');
    const fork = shell.current.workspaces.get(2);
    assert.equal(fork.loaded, false);
    // Left loaded in the background: its tabs saved as Kulisa quit, not again as they closed (none left at last).
    const forkDir = path.join(userData, 'projects', 'project', '2');
    const saved = fs.readdirSync(forkDir).filter((d) => d.startsWith('Profile '))
      .map((d) => JSON.parse(fs.readFileSync(path.join(forkDir, d, 'Kulisa Tabs.json'), 'utf8')));
    assert.ok(saved.some((urls) => urls.length), `its tabs kept: ${JSON.stringify(saved)}`);
    await ui(`document.querySelector('#wslist .wstab[data-ws="project/2"]').click()`);
    await waitFor(() => shell.ws === fork && fork.loaded && fork.pty);
    assert.equal(fork.folder, `${project}@feature-x`);
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    await ctx.call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await ui(`document.querySelector('#wslist .wstab[data-ws="project/1"]').click()`);
    await waitFor(() => shell.ws.n === 1);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });
  test('after a restart: the open projects are as they were left; one in the background loads when shown', async ({ shell, ui }) => {
    await waitFor(async () => JSON.stringify(await projectTabs(ui)) === '["project *","other"]');
    assert.equal(shell.open.get('other').ws.loaded, false);
  });
  test('after a restart: a window of its own comes back where it was, with its project shown', async ({ shell }) => {
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current?.id === 'third' && shell.windows[1].ws.loaded);
    const second = shell.windows[1];
    assert.deepEqual(second.tabs.map((p) => p.id), ['third']);
    const { width, height } = second.win.getNormalBounds();
    assert.deepEqual({ width, height }, { width: 1000, height: 700 });
    await waitFor(async () => JSON.stringify(await projectTabs((js) => second.win.webContents.executeJavaScript(js))) === '["third *"]');
  });
  test('after a restart: the grid is as it was left (preset "grid")', async ({ ui }) => {
    const box = (sel) => ui(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.x, width: r.width } : { x: -1, width: 0 }; })()`);
    // Once the grid is laid out: the test before may end while the fork's panes (the same profile ids) are still going.
    const columns = async () => {
      if (!(await ui(`document.querySelectorAll('.pane[data-profile="sam-admin"], .pane[data-profile="elon-buyer"]').length === 2`))) return false;
      const sam = await box('.pane[data-profile="sam-admin"] .content'), elon = await box('.pane[data-profile="elon-buyer"] .content');
      const term = await box('#term');
      return sam.width > 0 && sam.x < elon.x && term.x > elon.x + elon.width - 1;
    };
    await waitFor(columns, 3000);
  });
};
