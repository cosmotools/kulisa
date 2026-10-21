// Zoom, tabs on sign-in pages, closing profiles.
import { session } from 'electron';
import fs from 'fs';
import path from 'path';
import { assert, userData, pfile, savedTabs, savedActive, panel, SITE, waitFor, who, menuRows, choose, manageProfiles, closeSettings, chooseProfile, setProfileField, menuOpen, taskMenu, viewOn, ctrl, near, closeMenu, plusMenu, closeBoard, PORT, MAC, sleep, idOf } from './helpers.ts';
import type { Test } from './run.ts';
import { SESSION_COOKIES_FILE } from '../src/main/store.ts';

// Files of the sites' Cache API in a profile's folder, wherever Chromium's layout puts them (`WebStorage/<bucket>/CacheStorage/`).
// A folder Chromium removes while it is read is not counted yet (NaN): asked again.
const cacheStorageFiles = (dir: string) => {
  try { return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile() && f.parentPath.includes('CacheStorage')).length; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return NaN; throw e; }
};

export default (test: Test) => {
  test('Kulisa zoom: Ctrl+= outside the pages scales the whole UI, pages follow, panes still fit; saved', async ({ shell, ui }) => {
    const win = shell.win.webContents;
    const sam = shell.profiles.get(idOf('Sam.admin')).get().wc;
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), true, 'at 100% the top bar shows no zoom');
    ctrl(win, '=');
    await waitFor(() => near(win.getZoomFactor(), 1.1));
    await waitFor(() => near(sam.getZoomFactor(), 1.1));
    await waitFor(() => viewOn(shell, ui, 'Sam.admin'));
    assert.equal(await ui(`document.getElementById('zoomReset').textContent`), '110%');
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), false);
    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(0, 6), ['zoom', 'theme', 'bar', 'Language', '-', '# Arrange panels']);
    assert.equal(await ui(`document.querySelector('.menu[data-state="open"] .zoomrow output').textContent`), '110%');
    await ui(`document.querySelector('.menu[data-state="open"] .zoomrow .in').click()`); // − 110% + in the menu, as in Chrome
    await waitFor(() => near(win.getZoomFactor(), 1.25));
    await waitFor(async () => (await ui(`document.querySelector('.menu[data-state="open"] .zoomrow output').textContent`)) === '125%');
    assert.equal(await menuOpen(ui), true, 'the menu stays open for more clicks');
    await closeMenu(ui);
    await waitFor(() => viewOn(shell, ui, 'Sam.admin'));
    await waitFor(async () => (await ui(`({ cols: window.__term.cols })`)).cols < 200, 3000); // the terminal refits
    await waitFor(() => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).uiZoom === 1.25);
    // macOS: the window's buttons centered in the bar as it grows (made at 100%: a 44 pt bar), never below the height
    // the window was made with, where they would not take a click (docs/window.md, The title bar).
    if (MAC) {
      assert.deepEqual(shell.win.getWindowButtonPosition(), { x: 7, y: 21 }, '125%: a 55 pt bar');
      shell.setUiZoom(2);
      assert.deepEqual(shell.win.getWindowButtonPosition(), { x: 7, y: 30 }, '200%: at the bottom of the 44 pt it was made with');
      shell.setUiZoom(1.25);
    }
    // At most 200% (docs/window.md, Zoom): the window's minimum grows with it, and at 300% passed a laptop's screen.
    shell.setUiZoom(2);
    ctrl(win, '=');
    await sleep(300); // nothing to wait for: that it stays
    assert.ok(near(win.getZoomFactor(), 2) && shell.uiZoom === 2, 'Ctrl+= at 200% leaves it there');
    shell.setUiZoom(3);
    assert.equal(shell.uiZoom, 2, 'nor anything else takes it further');
    shell.setUiZoom(1.25);
    await waitFor(() => near(win.getZoomFactor(), 1.25));
  });
  test('the window\'s minimum follows the Kulisa zoom; a window at the minimum grows with it, and keeps its size back; New Project fits the smallest', async ({ shell, ui }) => {
    const win = shell.win, size = win.getSize();
    assert.deepEqual(win.getMinimumSize(), [800, 500], '640×400 at 125%');
    win.setSize(800, 500);
    await waitFor(() => win.getSize()[0] === 800);
    ctrl(win.webContents, '=');
    await waitFor(() => near(win.webContents.getZoomFactor(), 1.5));
    assert.deepEqual(win.getMinimumSize(), [960, 600]);
    await waitFor(() => win.getSize()[0] === 960 && win.getSize()[1] === 600);
    ctrl(win.webContents, '-');
    await waitFor(() => near(win.webContents.getZoomFactor(), 1.25));
    assert.deepEqual(win.getMinimumSize(), [800, 500]);
    assert.deepEqual(win.getSize(), [960, 600], 'not made smaller');
    // The smallest window has 640×400 for the UI at any zoom: New Project keeps its buttons and Browse… in it, each kind.
    win.setSize(800, 500);
    await waitFor(async () => (await ui(`innerHeight`)) === 400);
    await plusMenu(ui);
    await ui(`document.getElementById('boardnewproject').click()`);
    await waitFor(() => ui(`document.getElementById('newproject')?.dataset.state === 'open' && !!document.getElementById('npname')`));
    for (const from of ['new', 'folder', 'clone']) {
      await ui(`document.querySelector('#npfrom [data-value="${from}"]').click()`);
      await waitFor(() => ui(`document.querySelector('#npfrom [data-value="${from}"]').ariaSelected === 'true'`));
      const fits = await ui(`(() => { const d = document.getElementById('newproject').getBoundingClientRect(), inside = (id) => { const e = document.getElementById(id);
        if (!e) return null; const r = e.getBoundingClientRect(); return r.right <= d.right && r.bottom <= d.bottom && d.bottom <= innerHeight; };
        return { create: inside('npcreate'), browse: inside('npbrowse') }; })()`);
      assert.deepEqual(fits, { create: true, browse: from === 'folder' ? null : true }, from);
    }
    await ui(`document.querySelector('#newproject .x').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('newproject')?.dataset.state === 'open'`)));
    await closeBoard(ui);
    win.setSize(size[0], size[1]);
    await waitFor(() => win.getSize()[0] === size[0] && viewOn(shell, ui, 'Sam.admin'));
  });
  test('page zoom: Ctrl+= in a page zooms that site in that profile only, shows on the pane, is saved', async ({ shell, ui }) => {
    const sam = shell.profiles.get(idOf('Sam.admin'));
    const tab = sam.get();
    await tab.wc.loadURL(`${SITE}/app?zoom`);
    ctrl(tab.wc, '=');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
    const other = sam.newTab(`${SITE}/app?zoom2`);
    await other.ready;
    await waitFor(() => near(other.wc.getZoomFactor(), 1.25 * 1.1), 3000); // the same site in the same profile
    other.wc.close();
    for (const t of shell.profiles.get(idOf('Elon.buyer')).tabs) assert.ok(near(t.wc.getZoomFactor(), 1.25), 'other profiles keep the Kulisa zoom');
    await waitFor(async () => (await ui(`document.querySelector('.pane[data-profile="${idOf('Sam.admin')}"] .zoom').textContent`)) === '110%');
    const saved = JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).find((p: { id: string }) => p.id === idOf('Sam.admin'));
    assert.deepEqual(saved.zoom, { [`127.0.0.1:${PORT}`]: 1.1 });
    ctrl(tab.wc, '0');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25));
    await waitFor(() => ui(`document.querySelector('.pane[data-profile="${idOf('Sam.admin')}"] .zoom').hidden`));
    ctrl(tab.wc, '='); // left zoomed for the restart phase
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
  });

  // Last in phase 1: it leaves Elon on sign-in pages (paused).
  test('tabs on sign-in pages are saved as where the sign-in started', async ({ shell }) => {
    const elon = shell.profiles.get(idOf('Elon.buyer'));
    const back = encodeURIComponent(`${SITE}/app?n=9`);
    const viaHistory = elon.newTab(`${SITE}/app?n=5`);
    await viaHistory.ready;
    await viaHistory.wc.loadURL(`http://localhost:${PORT}/app?login=1`); // localhost is a sign-in host in this test
    await elon.newTab(`http://localhost:${PORT}/headers?redirect_uri=${back}`).ready; // opened directly on sign-in
    await elon.newTab(`http://localhost:${PORT}/headers`).ready; // nothing to come back to
    const expected = [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`];
    await waitFor(() => JSON.stringify(savedTabs('Elon.buyer')) === JSON.stringify(expected)).catch(() => {});
    assert.deepEqual(savedTabs('Elon.buyer'), expected);
    // The one in front, not the first, comes back in front (restart-profiles.ts); the one on a sign-in page left behind.
    elon.activate(viaHistory.id);
    await waitFor(() => savedActive('Elon.buyer') === 1);
  });
  test('close a profile (its × or the agent) and open it again (👥 or the agent): signed in, same tabs; the agent removes it from the project only when the human confirms', async (ctx) => {
    const { shell, ui, call } = ctx;
    const saved = (f: string): { id: string; closed?: boolean }[] => JSON.parse(fs.readFileSync(pfile(f), 'utf8'));
    await call('profile_create', { name: 'Cleo' });
    const header = `.ptab[data-panel="${panel('Cleo')}"]`, cleoDir = shell.profiles.get(idOf('Cleo')).dir;
    await call('browser_navigate', { profile: 'Cleo', url: `${SITE}/app/login?name=cleo` }); // a session cookie
    await call('browser_tab_new', { profile: 'Cleo', url: `${SITE}/app?second` });
    const tabs = shell.profiles.get(idOf('Cleo')).tabs.map((t) => t.wc);
    await waitFor(() => ui(`!!document.querySelector('${header} .close')`));

    assert.ok(await session.fromPath(cleoDir).getCacheSize() > 0, 'pages were cached');
    // A site's Cache API (its service worker's copies of its bundles) was the largest part of a closed copy: 200 MB for Teams.
    await tabs[1].executeJavaScript(`caches.open('bundles').then((c) => c.put('/bundle.js', new Response('x'.repeat(100000))))`);
    await waitFor(() => cacheStorageFiles(cleoDir) > 0);
    await ui(`document.querySelector('${header} .close').click()`);
    await waitFor(() => !shell.profiles.has(idOf('Cleo')) && tabs.every((wc) => wc.isDestroyed()));
    await waitFor(async () => (await session.fromPath(cleoDir).getCacheSize()) === 0); // a closed profile keeps no cache
    await waitFor(() => cacheStorageFiles(cleoDir) === 0);
    await waitFor(() => ui(`!document.querySelector('${header}')`));
    assert.equal(saved('profiles.json').find((p) => p.id === idOf('Cleo')).closed, true);
    await waitFor(() => savedTabs('Cleo').length === 2);
    const listed = JSON.parse((await call('profile_list', {})).text).find((p: { name: string }) => p.name === 'Cleo');
    assert.deepEqual(listed, { name: 'Cleo', description: null, avatar: 'frog', closed: true, tabs: 2 });
    await assert.rejects(call('browser_snapshot', { profile: 'Cleo' }), /closed.*profile_open/);
    assert.match((await ui(`act('tab:new', { profile: '${idOf('Cleo')}' })`)).error, /Profile "Cleo" is closed/); // the window: the same check

    // Open again from the task's tab's menu: a closed one says so.
    await taskMenu(ui);
    assert.equal(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item')].find((b) => b.querySelector('.label').textContent === 'Cleo').querySelector('small').textContent`),
      'closed · click to open');
    await choose(ui, 'Cleo');
    // Its tabs open, and the agent's connection comes, after it is in the task.
    await waitFor(() => shell.profiles.get(idOf('Cleo'))?.tabs.length === 2 && shell.profiles.get(idOf('Cleo')).context);
    assert.deepEqual(shell.profiles.get(idOf('Cleo')).tabs.map((t) => t.url), [`${SITE}/app`, `${SITE}/app?second`]);
    assert.equal(await who(ctx, 'Cleo'), 'Signed in as cleo');
    await waitFor(() => ui(`!!document.querySelector('${header}')`));

    // The agent closes it; the task's tab's menu lists it as closed and opens it.
    await call('profile_close', { profile: 'Cleo' });
    assert.ok(!shell.profiles.has(idOf('Cleo')) && shell.closed.has(idOf('Cleo')));
    assert.deepEqual((await taskMenu(ui)).slice(0, 6), ['# Profiles', 'Sam.admin', 'Elon.buyer', 'Cleo', '-', 'Manage Profiles…']);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item small')].map((e) => e.textContent).slice(2, 3)`), ['closed · click to open']);
    await choose(ui, 'Cleo');
    await waitFor(() => shell.profiles.has(idOf('Cleo')));
    // Closed right as it opens: it opens, then closes; nothing breaks.
    await call('profile_close', { profile: 'Cleo' });
    const [opened, closed] = await Promise.all([shell.task.openProfile(idOf('Cleo')), shell.task.closeProfile(idOf('Cleo'))]);
    assert.deepEqual([opened, closed], [{ id: idOf('Cleo') }, { id: idOf('Cleo') }]);
    assert.ok(shell.closed.has(idOf('Cleo')) && !shell.profiles.has(idOf('Cleo')));
    assert.deepEqual(shell.closed.get(idOf('Cleo')).tabs.urls, [`${SITE}/app`, `${SITE}/app?second`], 'its tabs kept');
    await call('profile_open', { profile: 'Cleo' });
    // And the agent closes and opens it.
    await call('profile_close', { profile: 'Cleo' });
    await call('profile_open', { profile: 'Cleo' });
    assert.equal(await who(ctx, 'Cleo'), 'Signed in as cleo');
    // Its saved session cookies unreadable (another keyring key): the log says so (after a restart the profile would
    // come back signed out; within one run Electron's session keeps them, so it is still signed in here).
    await call('profile_close', { profile: 'Cleo' });
    fs.writeFileSync(path.join(cleoDir, SESSION_COOKIES_FILE), 'not what safeStorage wrote');
    await call('profile_open', { profile: 'Cleo' });
    assert.equal(await who(ctx, 'Cleo'), 'Signed in as cleo');
    assert.match(fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8'), /\[session-cookies\] .*: the saved session cookies cannot be read \(saved with another keyring key\?\): not put back/);

    // The agent removes it from the project: the human is asked; no keeps it, yes removes it (closed ones too); the
    // profile stays in Settings → Profiles.
    ctx.answer = false;
    await assert.rejects(call('profile_delete', { profile: 'Cleo' }), /said no/);
    assert.equal(ctx.asked.pop().message, `The agent asks to remove the profile Cleo from ${shell.current.name}.`);
    assert.ok(shell.profiles.has(idOf('Cleo')));
    await call('profile_close', { profile: 'Cleo' });
    ctx.answer = true;
    await call('profile_delete', { profile: 'Cleo' });
    ctx.asked.length = 0;
    assert.ok(!shell.profiles.has(idOf('Cleo')) && !shell.closed.has(idOf('Cleo')));
    assert.ok(!saved('profiles.json').some((p) => p.id === idOf('Cleo')));
    assert.ok(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-folders.json'), 'utf8')).includes(cleoDir));
    assert.deepEqual(shell.profileStore.projectsOf(shell.profileStore.get(idOf('Cleo'))), [], 'kept, in no project');

    // Left closed for the restart phase.
    await call('profile_create', { name: 'Dora' });
    await call('browser_navigate', { profile: 'Dora', url: `${SITE}/app/login?name=dora` });
    await call('profile_close', { profile: 'Dora' });
  });
  test('a profile with a tab on a site that never answers opens anyway, and the agent can use it', async ({ shell, call }) => {
    await call('profile_create', { name: 'Hung' });
    await call('browser_tab_new', { profile: 'Hung', url: `${SITE}/hang` }); // returns after 5 s without a page
    await shell.task.closeProfile(idOf('Hung'));
    await waitFor(() => savedTabs('Hung').some((u) => u.endsWith('/hang')));
    const started = Date.now();
    await shell.task.openProfile(idOf('Hung'));
    assert.ok(Date.now() - started < 10000, `opened in ${Date.now() - started} ms`);
    const t = await call('browser_tab_new', { profile: 'Hung', url: `${SITE}/app` });
    assert.match(t.text, /app/);
    await shell.task.deleteProfile(idOf('Hung'));
  });
  test('a tab on a site that refuses to connect (its dev server not started, as in a new task) opens at once, and so does its profile', async ({ shell, call }) => {
    await call('profile_create', { name: 'Down' });
    let started = Date.now();
    await call('browser_tab_new', { profile: 'Down', url: 'http://127.0.0.1:4419/app' }); // nothing listens there
    assert.ok(Date.now() - started < 2000, `tab opened in ${Date.now() - started} ms`);
    await shell.task.closeProfile(idOf('Down'));
    await waitFor(() => savedTabs('Down').some((u) => u.includes(':4419/')));
    started = Date.now();
    await shell.task.openProfile(idOf('Down'));
    assert.ok(Date.now() - started < 2000, `profile opened in ${Date.now() - started} ms`);
    await shell.task.deleteProfile(idOf('Down'));
  });
  test('closing the last tab of a profile leaves an empty tab, not a pane without a page (the window and the agent)', async (ctx) => {
    const { shell, call, ui } = ctx;
    await call('profile_create', { name: 'Solo' });
    const solo = shell.profiles.get(idOf('Solo'));
    for (const close of [
      () => ui(`document.querySelector('.pane[data-profile="${idOf('Solo')}"] .tabs .tab .x').click()`),
      () => call('browser_tab_close', { profile: 'Solo', tab: solo.active })]) {
      const [only] = solo.tabs;
      await call('browser_navigate', { profile: 'Solo', url: `${SITE}/app` });
      await waitFor(() => ui(`!!document.querySelector('.pane[data-profile="${idOf('Solo')}"] .tabs .tab .x')`));
      await close();
      await waitFor(() => solo.tabs.length === 1 && solo.tabs[0] !== only && solo.active === solo.tabs[0].id);
      assert.equal(solo.get().view.getVisible(), true, 'its page is shown');
      await waitFor(async () => (await ui(`document.querySelectorAll('.pane[data-profile="${idOf('Solo')}"] .tabs .tab').length`)) === 1);
    }
    await ui(`act('profile:delete', { profile: '${idOf('Solo')}' })`);
    await waitFor(() => !shell.profiles.has(idOf('Solo')));
    ctx.asked.length = 0; // its question, answered
  });

  test("test users' sign-ins: the agent saves a pair and signs in with it on a local page, never seeing the password; refused elsewhere; the human sets one in the editor", async (ctx) => {
    const { shell, sui, call } = ctx;
    await call('profile_create', { name: 'Tess' });
    const actions: string[] = [];
    const watch = (a: { caption: string }) => { actions.push(a.caption); };
    shell.bus.on('agent-action', watch);
    try {
      assert.match((await call('profile_set_login', { profile: 'Tess', login: 'tester', password: 'secret-tester' })).text, /kept encrypted/);
      const listed = JSON.parse((await call('profile_list', {})).text).find((p: { name: string }) => p.name === 'Tess');
      assert.deepEqual([listed.testLogin, listed.testPassword], ['tester', true]);
      assert.ok(!fs.readFileSync(path.join(userData, 'profiles.json'), 'utf8').includes('secret-tester'), 'never in the clear');
      await call('browser_navigate', { profile: 'Tess', url: `${SITE}/app/signin` });
      await call('browser_type_login', { profile: 'Tess', locator: "locator('#user')", field: 'login' });
      assert.match((await call('browser_type_login', { profile: 'Tess', locator: "locator('#pass')", field: 'password', submit: true })).text, /^Typed Tess's password/);
      assert.equal(await who(ctx, 'Tess'), 'Signed in as tester');
      assert.ok(!actions.some((c) => /secret/.test(c || '')) && actions.includes('type ••••••'), 'the pane shows dots, not the password');
    } finally { shell.bus.off('agent-action', watch); }
    // Not a local page: refused, nothing typed.
    await call('browser_navigate', { profile: 'Tess', url: 'data:text/html,<input id="x">' });
    await assert.rejects(call('browser_type_login', { profile: 'Tess', locator: "locator('#x')", field: 'password' }), /not the app under test on this computer/);
    // The human: Settings → Profiles' login fields; the password saved encrypted, never shown back.
    await manageProfiles(ctx);
    await chooseProfile(sui, 'Tess');
    await waitFor(() => sui(`document.getElementById('profilelogin').value === 'tester'`));
    assert.equal(await sui(`document.getElementById('profilepassword').placeholder`), 'Kept (type to change it)');
    await setProfileField(sui, 'profilepassword', 'secret-tess');
    await waitFor(() => sui(`document.getElementById('profilepassword').value === ''`));
    await setProfileField(sui, 'profilelogin', 'tess');
    await waitFor(() => shell.profileStore.get(idOf('Tess')).login?.user === 'tess');
    await closeSettings(ctx);
    await call('browser_navigate', { profile: 'Tess', url: `${SITE}/app/signin` });
    await call('browser_type_login', { profile: 'Tess', locator: "locator('#user')", field: 'login' });
    await call('browser_type_login', { profile: 'Tess', locator: "locator('#pass')", field: 'password', submit: true });
    assert.equal(await who(ctx, 'Tess'), 'Signed in as tess', "the human's pair");
    // The log (window.md, The log): the agent's tool and the human's field are there, their passwords not.
    const logged = fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8');
    assert.match(logged, /\[mcp\] profile_set_login \S+\/1 \{"profile":"Tess","login":"tester","password":"…"\}/, 'the tool call, its password left out');
    assert.ok(logged.includes(`profiles:login`) && new RegExp(`\\[ipc\\] profiles:login wc=\\d+ \\{"profile":"${idOf('Tess')}","user":"tester","password":"…"\\}`).test(logged), "the human's field, the same");
    assert.ok(!/secret-tes/.test(logged), 'no password in the log');
    // Nothing of a profile's page: an address that fails to load leaves no line with it (electron-log's events are named
    // one by one: log.ts); what the agent types into a page is left out; an address is logged without its query.
    await call('browser_type', { profile: 'Tess', locator: "locator('body')", text: 'typed-by-agent' }).catch(() => {});
    await call('browser_navigate', { profile: 'Tess', url: 'http://nowhere.invalid/x?code=abc' }).catch(() => {});
    // But that it would not load, the address bare (the page says so after the tool has answered; Electron's own warning
    // of it, with the address in full, comes just before).
    await waitFor(() => new RegExp(`\\[warn\\] \\[profile\\] ${idOf('Tess')} page failed to load http://nowhere\\.invalid/x\\?…: ERR_NAME_NOT_RESOLVED \\(-105\\)`).test(fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8')));
    const later = fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8');
    assert.match(later, /\[mcp\] browser_type \S+\/1 \{"profile":"Tess","locator":"locator\('body'\)","text":"…"\}/);
    assert.match(later, /\[mcp\] browser_navigate \S+\/1 \{"profile":"Tess","url":"http:\/\/nowhere\.invalid\/x\?…"\}/);
    assert.ok(!/typed-by-agent|code=abc|did-fail|certificate-error/.test(later), "nothing of the page's address or the typed text");
    ctx.answer = true;
    await call('profile_delete', { profile: 'Tess' });
    ctx.asked.length = 0;
  });
};
