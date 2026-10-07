// Zoom, tabs on sign-in pages, closing profiles.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');

module.exports = (test) => {
  test('Kulisa zoom: Ctrl+= outside the pages scales the whole UI, pages follow, panes still fit; saved', async ({ shell, ui }) => {
    const win = shell.win.webContents;
    const sam = shell.profiles.get('sam-admin').get().wc;
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), true, 'at 100% the top bar shows no zoom');
    ctrl(win, '=');
    await waitFor(() => near(win.getZoomFactor(), 1.1));
    await waitFor(() => near(sam.getZoomFactor(), 1.1));
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.getElementById('zoomReset').textContent`), '110%');
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), false);
    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(0, 4), ['zoom', 'theme', '-', '# Arrange panels']);
    assert.equal(await ui(`document.querySelector('#menu .zoomrow output').textContent`), '110%');
    await ui(`document.querySelector('#menu .zoomrow .in').click()`); // − 110% + in the menu, as in Chrome
    await waitFor(() => near(win.getZoomFactor(), 1.25));
    await waitFor(async () => (await ui(`document.querySelector('#menu .zoomrow output').textContent`)) === '125%');
    assert.equal(await menuOpen(ui), true, 'the menu stays open for more clicks');
    await ui(`document.getElementById('menu').hidePopover()`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await waitFor(async () => (await ui(`({ cols: window.__term.cols })`)).cols < 200, 3000); // the terminal refits
    await waitFor(() => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).uiZoom === 1.25);
  });
  test('page zoom: Ctrl+= in a page zooms that site in that profile only, shows on the pane, is saved', async ({ shell, ui }) => {
    const sam = shell.profiles.get('sam-admin');
    const tab = sam.get();
    await tab.wc.loadURL(`${SITE}/app?zoom`);
    ctrl(tab.wc, '=');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
    const other = sam.newTab(`${SITE}/app?zoom2`);
    await other.ready;
    await waitFor(() => near(other.wc.getZoomFactor(), 1.25 * 1.1), 3000); // the same site in the same profile
    other.wc.close();
    for (const t of shell.profiles.get('elon-buyer').tabs) assert.ok(near(t.wc.getZoomFactor(), 1.25), 'other profiles keep the Kulisa zoom');
    await waitFor(async () => (await ui(`document.querySelector('.pane[data-profile="sam-admin"] .zoom').textContent`)) === '110%');
    const saved = JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).find((p) => p.id === 'sam-admin');
    assert.deepEqual(saved.zoom, { '127.0.0.1:4417': 1.1 });
    ctrl(tab.wc, '0');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25));
    await waitFor(() => ui(`document.querySelector('.pane[data-profile="sam-admin"] .zoom').hidden`));
    ctrl(tab.wc, '='); // left zoomed for the restart phase
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
  });

  // Last in phase 1: it leaves Elon on sign-in pages (paused).
  test('tabs on sign-in pages are saved as where the sign-in started', async ({ shell }) => {
    const elon = shell.profiles.get('elon-buyer');
    const back = encodeURIComponent(`${SITE}/app?n=9`);
    const viaHistory = elon.newTab(`${SITE}/app?n=5`);
    await viaHistory.ready;
    await viaHistory.wc.loadURL('http://localhost:4417/app?login=1'); // localhost is a sign-in host in this test
    await elon.newTab(`http://localhost:4417/headers?redirect_uri=${back}`).ready; // opened directly on sign-in
    await elon.newTab('http://localhost:4417/headers').ready; // nothing to come back to
    await sleep(300);
    const saved = savedTabs('elon-buyer');
    assert.deepEqual(saved, [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
  });
  test('close a profile (its × or the agent) and open it again (the editor or the agent): signed in, same tabs; the agent deletes only what the human confirms', async (ctx) => {
    const { shell, ui, call } = ctx;
    const saved = (f) => JSON.parse(fs.readFileSync(pfile(f), 'utf8'));
    await call('profile_create', { name: 'Cleo' });
    const header = `.ptab[data-panel="${panel(shell, 'cleo')}"]`, cleoDir = shell.profiles.get('cleo').dir;
    await call('browser_navigate', { profile: 'cleo', url: `${SITE}/app/login?name=cleo` }); // a session cookie
    await call('browser_tab_new', { profile: 'cleo', url: `${SITE}/app?second` });
    const tabs = shell.profiles.get('cleo').tabs.map((t) => t.wc);
    await waitFor(() => ui(`!!document.querySelector('${header} .close')`));

    await ui(`document.querySelector('${header} .close').click()`);
    await waitFor(() => !shell.profiles.has('cleo') && tabs.every((wc) => wc.isDestroyed()));
    await waitFor(() => ui(`!document.querySelector('${header}')`));
    assert.equal(saved('profiles.json').find((p) => p.id === 'cleo').closed, true);
    await waitFor(() => savedTabs('cleo').length === 2);
    const listed = JSON.parse((await call('browser_profiles', {})).text).find((p) => p.id === 'cleo');
    assert.deepEqual(listed, { id: 'cleo', name: 'Cleo', closed: true, tabs: 2 });
    await assert.rejects(call('browser_snapshot', { profile: 'cleo' }), /closed.*profile_open/);
    assert.match((await ui(`kulisa.invoke('tab:new', { profile: 'cleo' })`)).error, /Profile "cleo" is closed/); // the window: the same check

    // Open again in the editor.
    await manageProfiles(ui);
    const row = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'cleo')`;
    await waitFor(() => ui(`!!${row}`));
    assert.equal(await ui(`${row}.querySelector('.ntabs').textContent`), 'closed · 2 tabs');
    await ui(`${row}.querySelector('.open').click()`);
    await waitFor(() => shell.profiles.has('cleo'));
    await waitFor(() => ui(`${row}.querySelector('.open').hidden`));
    await ui(`document.getElementById('closeProfiles').click()`);
    assert.deepEqual(shell.profiles.get('cleo').tabs.map((t) => t.url), [`${SITE}/app`, `${SITE}/app?second`]);
    assert.equal(await who(ctx, 'cleo'), 'Signed in as cleo');
    await waitFor(() => ui(`!!document.querySelector('${header}')`));

    // The agent closes it; Profiles ▾ lists it as closed and opens it.
    await call('profile_close', { profile: 'cleo' });
    assert.ok(!shell.profiles.has('cleo') && shell.closed.has('cleo'));
    await ui(`document.getElementById('openProfiles').click()`);
    assert.deepEqual(await menuRows(ui), ['Sam.admin', 'Elon.buyer', 'Cleo', '-', 'Manage Profiles…']);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#menu .item small')].map((e) => e.textContent).slice(2, 3)`), ['closed · click to open']);
    await choose(ui, 'Cleo');
    await waitFor(() => shell.profiles.has('cleo'));
    // Closed right as it opens: it opens, then closes; nothing breaks.
    await call('profile_close', { profile: 'cleo' });
    const [opened, closed] = await Promise.all([shell.ws.openProfile('cleo'), shell.ws.closeProfile('cleo')]);
    assert.deepEqual([opened, closed], [{ id: 'cleo' }, { id: 'cleo' }]);
    assert.ok(shell.closed.has('cleo') && !shell.profiles.has('cleo'));
    assert.deepEqual(shell.closed.get('cleo').urls, [`${SITE}/app`, `${SITE}/app?second`], 'its tabs kept');
    await call('profile_open', { profile: 'cleo' });
    // And the agent closes and opens it.
    await call('profile_close', { profile: 'cleo' });
    await call('profile_open', { profile: 'cleo' });
    assert.equal(await who(ctx, 'cleo'), 'Signed in as cleo');

    // The agent deletes: the human is asked; no keeps it, yes deletes it (closed ones too).
    ctx.answer = false;
    await assert.rejects(call('profile_delete', { profile: 'cleo' }), /said no/);
    assert.equal(ctx.asked.pop().message, 'The agent asks to delete the profile Cleo.');
    assert.ok(shell.profiles.has('cleo'));
    await call('profile_close', { profile: 'cleo' });
    ctx.answer = true;
    await call('profile_delete', { profile: 'cleo' });
    ctx.asked.length = 0;
    assert.ok(!shell.profiles.has('cleo') && !shell.closed.has('cleo'));
    assert.ok(!saved('profiles.json').some((p) => p.id === 'cleo'));
    assert.ok(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-folders.json'), 'utf8')).includes(cleoDir));

    // Left closed for the restart phase.
    await call('profile_create', { name: 'Dora' });
    await call('browser_navigate', { profile: 'dora', url: `${SITE}/app/login?name=dora` });
    await call('profile_close', { profile: 'dora' });
  });
  test('a profile with a tab on a site that never answers opens anyway, and the agent can use it', async ({ shell, call }) => {
    await call('profile_create', { name: 'Hung' });
    await call('browser_tab_new', { profile: 'hung', url: `${SITE}/hang` }); // returns after 5 s without a page
    await shell.ws.closeProfile('hung');
    await waitFor(() => savedTabs('hung').some((u) => u.endsWith('/hang')));
    const started = Date.now();
    await shell.ws.openProfile('hung');
    assert.ok(Date.now() - started < 10000, `opened in ${Date.now() - started} ms`);
    const t = await call('browser_tab_new', { profile: 'hung', url: `${SITE}/app` });
    assert.match(t.text, /app/);
    await shell.ws.deleteProfile('hung');
  });
};
