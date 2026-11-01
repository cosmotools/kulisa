// Zoom (the Kulisa zoom and a site's page zoom: docs/window.md, Zoom), tabs on sign-in pages, closing and opening
// profiles, test users' sign-ins (docs/profiles.md).
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Locator } from '@playwright/test';
import { SITE, PORT, MAC, WIN, near, uiZoom, who, menu, item, choose, closeMenu, taskMenu, answer, manageProfiles, chooseProfile, closeSettings, openSidebar, closeSidebar, viewOn, invoke , typeIn } from './helpers.ts';
import { profileId, deleteProfile } from './tasks-helpers.ts';

// Files of the sites' Cache API in a profile's folder, wherever Chromium's layout puts them (`WebStorage/<bucket>/CacheStorage/`).
// Chromium changes the tree during a scan; Windows denies access to directories pending deletion.
const cacheStorageFiles = (dir: string) => {
  try { return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile() && f.parentPath.includes('CacheStorage')).length; }
  catch (e) { const { code } = e as NodeJS.ErrnoException; if (code === 'ENOENT' || (WIN && code === 'EPERM')) return NaN; throw e; }
};
// The tabs saved for a profile of the first task, by its id (a name may be made again here).
// Ctrl+ a key (⌘ on macOS) where the keyboard is put first: Kulisa's window, or a profile's tab (its active one).
const ctrl = (core: Core, where: string | null, key: string) => core((k, a) => {
  const wc = a.where === null ? k.shell.win.webContents : k.profile(a.where).get().wc;
  wc.focus(); k.press(wc, a.key, k.CMD);
}, { where, key });
// The Kulisa zoom set as a test starts from it (its keys and ☰'s row are the first test's).
async function zoomAt(core: Core, z: number) {
  await core((k, x) => k.shell.setUiZoom(x), z);
  await expect.poll(async () => near(await uiZoom(core), z)).toBe(true);
}

test('Kulisa zoom: Ctrl+= outside the pages scales the whole UI, pages follow, panes still fit; saved', async ({ core, ui, files }) => {
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  await zoomAt(core, 1);
  const samZoom = () => core((k) => k.profile('Sam.admin').get().wc.getZoomFactor());
  await expect(ui.locator('#zoomReset'), 'at 100% the top bar shows no zoom').toBeHidden();
  await ctrl(core, null, '=');
  await expect.poll(async () => near(await uiZoom(core), 1.1)).toBe(true);
  await expect.poll(async () => near(await samZoom(), 1.1)).toBe(true);
  await expect.poll(() => viewOn(core, ui, files, 'Sam.admin')).toBe(true);
  await expect(ui.locator('#zoomReset')).toHaveText('110%');
  await expect(ui.locator('#zoomReset')).toBeVisible();
  await ui.locator('#windowMenu').click();
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - /children: contain
      - group "Zoom"
      - menuitem "Theme"
      - menuitem "Tasks bar"
      - menuitem "Language"
  `);
  await expect(menu(ui).getByTestId('zoom-row')).toContainText('110%');
  await menu(ui).getByRole('menuitem', { name: 'Zoom in' }).click(); // − 110% + in the menu, as in Chrome
  await expect.poll(async () => near(await uiZoom(core), 1.25)).toBe(true);
  await expect(menu(ui).getByTestId('zoom-row')).toContainText('125%');
  await expect(menu(ui), 'the menu stays open for more clicks').toBeVisible();
  await closeMenu(ui);
  await expect.poll(() => viewOn(core, ui, files, 'Sam.admin')).toBe(true);
  await expect.poll(() => ui.evaluate(() => (window as any).__term.cols), { timeout: 3000 }).toBeLessThan(200); // the terminal refits
  await expect.poll(() => files.json('settings.json').uiZoom).toBe(1.25);
  // macOS: the window's buttons centered in the bar as it grows (made at 100%: a 44 pt bar), never below the height
  // the window was made with, where they would not take a click (docs/window.md, The title bar).
  if (MAC) {
    expect(await core((k) => k.shell.win.getWindowButtonPosition()), '125%: a 55 pt bar').toEqual({ x: 7, y: 21 });
    expect(await core((k) => { k.shell.setUiZoom(2); const at = k.shell.win.getWindowButtonPosition(); k.shell.setUiZoom(1.25); return at; }),
      '200%: at the bottom of the 44 pt it was made with').toEqual({ x: 7, y: 30 });
  }
  // At most 200% (docs/window.md, Zoom): the window's minimum grows with it, and at 300% passed a laptop's screen.
  await core((k) => k.shell.setUiZoom(2));
  await ctrl(core, null, '='); // taken and done as it is sent (shortcuts.ts)
  expect(await core((k) => [k.shell.win.webContents.getZoomFactor(), k.shell.uiZoom]), 'Ctrl+= at 200% leaves it there').toEqual([2, 2]);
  await core((k) => k.shell.setUiZoom(3));
  expect(await core((k) => k.shell.uiZoom), 'nor anything else takes it further').toBe(2);
  await zoomAt(core, 1);
});

test('the window\'s minimum follows the Kulisa zoom; a window at the minimum grows with it, and keeps its size back; New Project fits the smallest', async ({ core, ui, files }) => {
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  await zoomAt(core, 1.25);
  const size = await core((k) => k.shell.win.getSize());
  const sizes = () => core((k) => ({ size: k.shell.win.getSize(), min: k.shell.win.getMinimumSize() }));
  expect((await sizes()).min, '640×400 at 125%').toEqual([800, 500]);
  await core((k) => k.shell.win.setSize(800, 500));
  await expect.poll(async () => (await sizes()).size[0]).toBe(800);
  await ctrl(core, null, '=');
  await expect.poll(async () => near(await uiZoom(core), 1.5)).toBe(true);
  expect((await sizes()).min).toEqual([960, 600]);
  await expect.poll(async () => (await sizes()).size).toEqual([960, 600]);
  await ctrl(core, null, '-');
  await expect.poll(async () => near(await uiZoom(core), 1.25)).toBe(true);
  expect(await sizes(), 'not made smaller').toEqual({ min: [800, 500], size: [960, 600] });
  // The smallest window has 640×400 for the UI at any zoom: New Project keeps its buttons and Browse… in it, each kind.
  await core((k) => k.shell.win.setSize(800, 500));
  await expect.poll(() => ui.evaluate(() => innerHeight)).toBe(400);
  // New Project… at the sidebar's foot.
  await openSidebar(ui);
  await ui.getByRole('button', { name: 'New Project…' }).click();
  const np = ui.getByRole('dialog', { name: 'New Project' });
  await expect(np).toBeVisible();
  await expect(np.getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(1);
  for (const from of ['New Folder', 'Folders on Disk', 'Clone from URL']) {
    await np.getByRole('tab', { name: from }).click();
    await expect(np.getByRole('tab', { name: from })).toHaveAttribute('aria-selected', 'true');
    const d = await np.boundingBox(), height = await ui.evaluate(() => innerHeight);
    const inside = async (b: Locator) => {
      if (!(await b.count())) return null;
      const r = await b.boundingBox();
      return r.x + r.width <= d.x + d.width && r.y + r.height <= d.y + d.height && d.y + d.height <= height;
    };
    const fits = { create: await inside(np.getByRole('button', { name: 'Next' })), browse: await inside(np.getByRole('button', { name: 'Browse…' })) };
    expect(fits, from).toEqual({ create: true, browse: from === 'Folders on Disk' ? null : true });
  }
  await np.getByRole('button', { name: 'Close' }).click();
  await expect(np).toHaveCount(0);
  await closeSidebar(ui);
  await core((k, s) => k.shell.win.setSize(s[0], s[1]), size);
  await expect.poll(async () => (await sizes()).size[0] === size[0] && await viewOn(core, ui, files, 'Sam.admin')).toBe(true);
  await zoomAt(core, 1);
});

test('page zoom: Ctrl+= in a page zooms that site in that profile only, shows on the pane, is saved', async ({ core, ui, files }) => {
  const sam = await core(async (k, url) => { await k.ensureProfile('Elon.buyer', url); return (await k.ensureProfile('Sam.admin', url)).id; }, `${SITE}/app`);
  await zoomAt(core, 1.25);
  const zoom = () => core((k) => k.profile('Sam.admin').get().wc.getZoomFactor());
  await core((k, url) => k.profile('Sam.admin').get().wc.loadURL(url), `${SITE}/app?zoom`);
  await ctrl(core, 'Sam.admin', '=');
  await expect.poll(async () => near(await zoom(), 1.25 * 1.1)).toBe(true);
  // The same site in the same profile.
  const other = await core(async (k, url) => { const t = k.profile('Sam.admin').newTab(url); await t.ready; return t.id; }, `${SITE}/app?zoom2`);
  await expect.poll(async () => near(await core((k, id) => k.profile('Sam.admin').get(id).wc.getZoomFactor(), other), 1.25 * 1.1), { timeout: 3000 }).toBe(true);
  await core((k, id) => k.profile('Sam.admin').get(id).wc.close(), other);
  for (const z of await core((k) => k.profile('Elon.buyer').tabs.map((t) => t.wc.getZoomFactor()))) expect(near(z, 1.25), 'other profiles keep the Kulisa zoom').toBe(true);
  const shown = ui.locator(`[role="region"][data-profile="${sam}"]`).getByTitle(/^This site's zoom/);
  await expect(shown).toHaveText('110%');
  const saved = files.json(files.pfile('task.json')).stage.items.filter((i: { type: string }) => i.type === 'profile').find((p: { id: string }) => p.id === sam);
  expect(saved.zoom).toEqual({ [`127.0.0.1:${PORT}`]: 1.1 });
  await ctrl(core, 'Sam.admin', '0');
  await expect.poll(async () => near(await zoom(), 1.25)).toBe(true);
  await expect(shown).toBeHidden();
  await zoomAt(core, 1);
});

test('tabs on sign-in pages are saved as where the sign-in started', async ({ core, files }) => {
  // Elon with one tab, on a page of the site.
  const elon = await core(async (k, url) => {
    const p = await k.ensureProfile('Elon.buyer', url);
    for (const t of p.tabs.filter((x) => x.id !== p.active)) p.closeTab(t.id);
    return p.id;
  }, `${SITE}/errors`);
  const opened = await core(async (k, a) => {
    const p = k.profile('Elon.buyer'), back = encodeURIComponent(`${a.site}/app?n=9`);
    const viaHistory = p.newTab(`${a.site}/app?n=5`);
    await viaHistory.ready;
    await viaHistory.wc.loadURL(`http://localhost:${a.port}/app?login=1`); // localhost is a sign-in host in the tests
    const direct = p.newTab(`http://localhost:${a.port}/headers?redirect_uri=${back}`); // opened directly on sign-in
    await direct.ready;
    const none = p.newTab(`http://localhost:${a.port}/headers`); // nothing to come back to
    await none.ready;
    return [viaHistory.id, direct.id, none.id];
  }, { site: SITE, port: PORT });
  await expect.poll(() => files.savedTabs(elon)).toEqual([`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
  // The one in front, not the first, comes back in front (profiles.spec.ts, after a restart); the one on a sign-in page left behind.
  await core((k, id) => k.profile('Elon.buyer').activate(id), opened[0]);
  await expect.poll(() => files.json(files.pfile(path.join(elon, 'Kulisa Tabs.json'))).active).toBe(1);
  // Its sign-in pages closed: Elon out of the sign-in pause for the file's other tests.
  await core((k, ids) => { for (const id of ids) k.profile('Elon.buyer').closeTab(id); }, opened);
});

test('close a profile (its × or the agent) and open it again (👥 or the agent): signed in, same tabs; the agent removes it from the project only when the human confirms', async ({ core, ui, call, files }) => {
  await deleteProfile(core, ui, 'Cleo');
  const saved = (): { id: string; closed?: boolean }[] => files.json(files.pfile('task.json')).stage.items.filter((i: { type: string }) => i.type === 'profile');
  await call('profile_create', { name: 'Cleo' });
  const cleo = await profileId(core, 'Cleo');
  const header = ui.locator(`[data-panel="profile:${cleo}"]`);
  const { dir: cleoDir, cookies: cookiesFile, avatar } = await core((k) => { const p = k.profile('Cleo'); return { dir: p.dir, cookies: k.shell.sessionCookies.file(p), avatar: p.avatar }; });
  await call('browser_navigate', { profile: 'Cleo', url: `${SITE}/app/login?name=cleo` }); // a session cookie
  await call('browser_tab_new', { profile: 'Cleo', url: `${SITE}/app?second` });
  // Its tabs' pages kept to look at once they are gone.
  await core((k) => { k.stash.cleoTabs = k.profile('Cleo').tabs.map((t) => t.wc); });
  await expect(header.getByRole('button', { name: 'Close profile' })).toHaveCount(1);
  const cacheSize = () => core((k, d) => k.electron.session.fromPath(d).getCacheSize(), cleoDir);

  expect(await cacheSize(), 'pages were cached').toBeGreaterThan(0);
  // A site's Cache API (its service worker's copies of its bundles) was the largest part of a closed copy: 200 MB for Teams.
  await core((k) => k.stash.cleoTabs[1].executeJavaScript(`caches.open('bundles').then((c) => c.put('/bundle.js', new Response('x'.repeat(100000))))`));
  await expect.poll(() => cacheStorageFiles(cleoDir)).toBeGreaterThan(0);
  await header.getByRole('button', { name: 'Close profile' }).click();
  await expect.poll(() => core((k, id) => !k.shell.profiles.has(id) && k.stash.cleoTabs.every((wc: Electron.WebContents) => wc.isDestroyed()), cleo)).toBe(true);
  await expect.poll(cacheSize).toBe(0); // a closed profile keeps no cache
  await expect.poll(() => cacheStorageFiles(cleoDir)).toBe(0);
  await expect(header).toHaveCount(0);
  expect(saved().find((p) => p.id === cleo).closed).toBe(true);
  await expect.poll(() => files.savedTabs(cleo).length).toBe(2);
  const listed = JSON.parse((await call('profile_list', {})).text).find((p: { name: string }) => p.name === 'Cleo');
  expect(listed).toEqual({ name: 'Cleo', description: null, avatar, closed: true, tabs: 2 });
  await expect(call('browser_snapshot', { profile: 'Cleo' })).rejects.toThrow(/closed.*profile_open/);
  // The window: the same check.
  expect((await ui.evaluate((id) => (window as any).act('tab:new', { profile: id }), cleo)).error).toMatch(/Profile "Cleo" is closed/);

  // Open again from the task's tab's menu: a closed one says so.
  const cleoRow = () => item(ui, 'Cleo');
  await taskMenu(ui);
  await expect(cleoRow()).toContainText('closed · click to open');
  await choose(ui, 'Cleo');
  // Its tabs open, and the agent's connection comes, after it is in the task.
  await expect.poll(() => core((k, id) => { const p = k.shell.profiles.get(id); return p?.tabs.length === 2 && !!p.context; }, cleo)).toBe(true);
  expect(await core((k, id) => k.shell.profiles.get(id).tabs.map((t) => t.url), cleo)).toEqual([`${SITE}/app`, `${SITE}/app?second`]);
  expect(await who(call, 'Cleo')).toBe('Signed in as cleo');
  await expect(header).toHaveCount(1);

  // The agent closes it; the task's tab's menu lists it as closed and opens it.
  await call('profile_close', { profile: 'Cleo' });
  expect(await core((k, id) => !k.shell.profiles.has(id) && k.shell.closed.has(id), cleo)).toBe(true);
  const rows = await taskMenu(ui), names = await core((k) => [...k.shell.profiles.values()].map((p) => p.name));
  // Under Profiles, before the first line: the open ones and Cleo; then Manage Profiles….
  await expect(rows).toMatchAriaSnapshot(`
    - menu:
      - /children: contain
      - text: Profiles
      ${[...names, 'Cleo'].map((n) => `- menuitem ${JSON.stringify(n)}`).join('\n      ')}
      - menuitem "Manage Profiles…"
  `);
  await expect(cleoRow()).toContainText('closed · click to open');
  await choose(ui, 'Cleo');
  await expect.poll(() => core((k, id) => k.shell.profiles.has(id), cleo)).toBe(true);
  // Closed right as it opens: it opens, then closes; nothing breaks.
  await call('profile_close', { profile: 'Cleo' });
  expect(await core((k, id) => Promise.all([k.shell.task.openProfile(id), k.shell.task.closeProfile(id)]), cleo)).toEqual([{ id: cleo }, { id: cleo }]);
  expect(await core((k, id) => k.shell.closed.has(id) && !k.shell.profiles.has(id), cleo)).toBe(true);
  expect(await core((k, id) => k.shell.closed.get(id).tabs.urls, cleo), 'its tabs kept').toEqual([`${SITE}/app`, `${SITE}/app?second`]);
  await call('profile_open', { profile: 'Cleo' });
  // And the agent closes and opens it.
  await call('profile_close', { profile: 'Cleo' });
  await call('profile_open', { profile: 'Cleo' });
  expect(await who(call, 'Cleo')).toBe('Signed in as cleo');
  // Its saved session cookies unreadable (another keyring key): the log says so (after a restart the profile would
  // come back signed out; within one run Electron's session keeps them, so it is still signed in here).
  await call('profile_close', { profile: 'Cleo' });
  fs.writeFileSync(cookiesFile, 'not what safeStorage wrote');
  await call('profile_open', { profile: 'Cleo' });
  expect(await who(call, 'Cleo')).toBe('Signed in as cleo');
  expect(files.log()).toMatch(/\[session-cookies\] .*: the saved session cookies cannot be read \(saved with another keyring key\?\): not put back/);

  // The agent removes it from the project: the human is asked; no keeps it, yes removes it (closed ones too); the
  // profile stays in Settings → Profiles.
  const refused = expect(call('profile_delete', { profile: 'Cleo' })).rejects.toThrow(/said no/);
  const asked = await answer(ui, false);
  await refused;
  expect(asked.message).toBe(`The agent asks to remove the profile Cleo from ${await core((k) => k.shell.current.name)}.`);
  expect(await core((k, id) => k.shell.profiles.has(id), cleo)).toBe(true);
  await call('profile_close', { profile: 'Cleo' });
  const removed = call('profile_delete', { profile: 'Cleo' });
  await answer(ui);
  await removed;
  expect(await core((k, id) => !k.shell.profiles.has(id) && !k.shell.closed.has(id), cleo)).toBe(true);
  expect(saved().some((p) => p.id === cleo)).toBe(false);
  expect(files.json('deleted-folders.json')).toContain(cleoDir);
  expect(await core((k, id) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(id)), cleo), 'kept, in no project').toEqual([]);
  // Deleted for good, as Settings does: the file's next runs make a Cleo again.
  const deleted = invoke(ui, 'profiles:delete', { profile: cleo });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, id) => !k.shell.profileStore.get(id), cleo)).toBe(true);
});

test('a profile with a tab on a site that never answers opens anyway, and the agent can use it', async ({ core, ui, call }) => {
  await deleteProfile(core, ui, 'Hung');
  await call('profile_create', { name: 'Hung' });
  const hung = await profileId(core, 'Hung');
  // Closed with its tab on the site, as closing it there leaves it (opening it there waits for the page, about 5 s).
  await core(async (k, a) => { await k.shell.task.closeProfile(a.id); k.shell.task.closed.get(a.id).tabs = { urls: [a.url], active: 0 }; }, { id: hung, url: `${SITE}/hang` });
  const took = await core(async (k, id) => { const started = Date.now(); await k.shell.task.openProfile(id); return Date.now() - started; }, hung);
  expect(took < 10000, `opened in ${took} ms`).toBe(true);
  expect(await core((k) => k.profile('Hung').get().pendingUrl), 'on its saved tab, still loading').toBe(`${SITE}/hang`);
  const t = await call('browser_tab_new', { profile: 'Hung', url: `${SITE}/app` });
  expect(t.text).toMatch(/app/);
  await deleteProfile(core, ui, 'Hung');
});

test('a tab on a site that refuses to connect (its dev server not started, as in a new task) opens at once, and so does its profile', async ({ core, ui, call, files }) => {
  await deleteProfile(core, ui, 'Down');
  await call('profile_create', { name: 'Down' });
  const down = await profileId(core, 'Down');
  // At once: what Chromium takes to be told the connection is refused, about 2 s on Windows (a bare Electron's page too).
  const soon = WIN ? 3500 : 2000;
  const started = Date.now();
  await call('browser_tab_new', { profile: 'Down', url: 'http://127.0.0.1:4419/app' }); // nothing listens there
  expect(Date.now() - started < soon, `tab opened in ${Date.now() - started} ms`).toBe(true);
  await core((k, id) => k.shell.task.closeProfile(id), down);
  await expect.poll(() => files.savedTabs(down).some((u) => u.includes(':4419/'))).toBe(true);
  const took = await core(async (k, id) => { const at = Date.now(); await k.shell.task.openProfile(id); return Date.now() - at; }, down);
  expect(took < soon, `profile opened in ${took} ms`).toBe(true);
  await deleteProfile(core, ui, 'Down');
});

test('closing the last tab of a profile leaves an empty tab, not a pane without a page (the window and the agent)', async ({ core, ui, call }) => {
  await deleteProfile(core, ui, 'Solo');
  await call('profile_create', { name: 'Solo' });
  const solo = await profileId(core, 'Solo');
  const tabs = ui.locator(`[role="region"][data-profile="${solo}"] [role="tab"]`);
  for (const by of ['window', 'agent'] as const) {
    const only = await core((k) => k.profile('Solo').tabs[0].id);
    await call('browser_navigate', { profile: 'Solo', url: `${SITE}/app` });
    await expect(tabs.getByTitle('Close tab')).toHaveCount(1);
    if (by === 'window') await tabs.getByTitle('Close tab').click();
    else await call('browser_tab_close', { profile: 'Solo', tab: await core((k) => k.profile('Solo').active) });
    await expect.poll(() => core((k, was) => { const p = k.profile('Solo'); return p.tabs.length === 1 && p.tabs[0].id !== was && p.active === p.tabs[0].id; }, only)).toBe(true);
    expect(await core((k) => k.profile('Solo').get().view.getVisible()), 'its page is shown').toBe(true);
    await expect(tabs).toHaveCount(1);
  }
  const removed = ui.evaluate((id) => (window as any).act('profile:delete', { profile: id }), solo);
  await answer(ui);
  await removed;
  await expect.poll(() => core((k, id) => k.shell.profiles.has(id), solo)).toBe(false);
  await deleteProfile(core, ui, 'Solo');
});

test("test users' sign-ins: the agent saves a pair and signs in with it on a local page, never seeing the password; refused elsewhere; the human sets one in the editor", async ({ core, ui, sui, call, files }) => {
  await deleteProfile(core, ui, 'Tess');
  await call('profile_create', { name: 'Tess' });
  const tess = await profileId(core, 'Tess');
  await core((k) => {
    const g = k.stash;
    g.actions = [];
    g.watch = (a: { caption: string }) => { g.actions.push(a.caption); };
  });
  await core((k) => k.shell.bus.on('agent-action', k.stash.watch));
  try {
    expect((await call('profile_set_login', { profile: 'Tess', login: 'tester', password: 'secret-tester' })).text).toMatch(/kept encrypted/);
    const listed = JSON.parse((await call('profile_list', {})).text).find((p: { name: string }) => p.name === 'Tess');
    expect([listed.testLogin, listed.testPassword]).toEqual(['tester', true]);
    expect(fs.readFileSync(path.join(files.userData, 'profiles.json'), 'utf8'), 'never in the clear').not.toContain('secret-tester');
    await call('browser_navigate', { profile: 'Tess', url: `${SITE}/app/signin` });
    await call('browser_type_login', { profile: 'Tess', locator: "locator('#user')", field: 'login' });
    expect((await call('browser_type_login', { profile: 'Tess', locator: "locator('#pass')", field: 'password', submit: true })).text).toMatch(/^Typed Tess's password/);
    expect(await who(call, 'Tess')).toBe('Signed in as tester');
    const actions = await core((k) => k.stash.actions as string[]);
    expect(!actions.some((c) => /secret/.test(c || '')) && actions.includes('type ••••••'), 'the pane shows dots, not the password').toBe(true);
  } finally { await core((k) => k.shell.bus.off('agent-action', k.stash.watch)); }
  // Not a local page: refused, nothing typed.
  await call('browser_navigate', { profile: 'Tess', url: 'data:text/html,<input id="x">' });
  await expect(call('browser_type_login', { profile: 'Tess', locator: "locator('#x')", field: 'password' })).rejects.toThrow(/not the app under test on this computer/);
  // The human: Settings → Profiles' login fields; the password saved encrypted, never shown back.
  const s = await manageProfiles(ui, sui);
  await chooseProfile(s, files, 'Tess');
  // a password field is no textbox
  const login = s.getByRole('textbox', { name: 'Test login' }), password = s.getByLabel('Test password');
  await expect(login).toHaveValue('tester');
  await expect(password).toHaveAttribute('placeholder', 'Kept (type to change it)');
  await typeIn(s, password, 'secret-tess', true);
  await expect(password).toHaveValue('');
  await typeIn(s, login, 'tess', true);
  await expect.poll(() => core((k, id) => k.shell.profileStore.get(id).login?.user, tess)).toBe('tess');
  await closeSettings(core, ui, sui);
  await call('browser_navigate', { profile: 'Tess', url: `${SITE}/app/signin` });
  await call('browser_type_login', { profile: 'Tess', locator: "locator('#user')", field: 'login' });
  await call('browser_type_login', { profile: 'Tess', locator: "locator('#pass')", field: 'password', submit: true });
  expect(await who(call, 'Tess'), "the human's pair").toBe('Signed in as tess');
  // The log (window.md, The log): the agent's tool and the human's field are there, their passwords not.
  const logged = files.log();
  expect(logged, 'the tool call, its password left out').toMatch(/\[mcp\] profile_set_login \S+\/[a-z0-9]{6} \{"profile":"Tess","login":"tester","password":"…"\}/);
  expect(logged, "the human's field, the same").toMatch(new RegExp(`\\[ipc\\] profiles:login wc=\\d+ \\{"profile":"${tess}","user":"tester","password":"…"\\}`));
  expect(logged, 'no password in the log').not.toMatch(/secret-tes/);
  // Nothing of a profile's page: an address that fails to load leaves no line with it (electron-log's events are named
  // one by one: log.ts); what the agent types into a page is left out; an address is logged without its query.
  await call('browser_type', { profile: 'Tess', locator: "locator('body')", text: 'typed-by-agent' }).catch(() => {});
  // The failure and its log are under test, not the runner's DNS resolver or its response time.
  await core(async (k) => {
    const page = await k.profile('Tess').page();
    await page.route('http://nowhere.invalid/**', (route) => route.abort('namenotresolved'), { times: 1 });
  });
  await call('browser_navigate', { profile: 'Tess', url: 'http://nowhere.invalid/x?code=abc' }).catch(() => {});
  // But that it would not load, the address bare (the page says so after the tool has answered; Electron's own warning
  // of it, with the address in full, comes just before).
  await expect.poll(() => files.log()).toMatch(new RegExp(`\\[warn\\] \\[profile\\] ${tess} page failed to load http://nowhere\\.invalid/x\\?…: ERR_NAME_NOT_RESOLVED \\(-105\\)`));
  const later = files.log();
  expect(later).toMatch(/\[mcp\] browser_type \S+\/[a-z0-9]{6} \{"profile":"Tess","locator":"locator\('body'\)","text":"…"\}/);
  expect(later).toMatch(/\[mcp\] browser_navigate \S+\/[a-z0-9]{6} \{"profile":"Tess","url":"http:\/\/nowhere\.invalid\/x\?…"\}/);
  expect(later, "nothing of the page's address or the typed text").not.toMatch(/typed-by-agent|code=abc|did-fail|certificate-error/);
  const removed = call('profile_delete', { profile: 'Tess' });
  await answer(ui);
  await removed;
  const deleted = invoke(ui, 'profiles:delete', { profile: tess });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, id) => !k.shell.profileStore.get(id), tess)).toBe(true);
});

test('after a restart: the Kulisa zoom and a site\'s page zoom are as they were left', async ({ core, files, restart }) => {
  test.setTimeout(60000); // a restart
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  await zoomAt(core, 1.25);
  const sam = await core((k) => k.profile('Sam.admin').id);
  const siteZoom = () => files.json(files.pfile('task.json')).stage.items.filter((i: { type: string }) => i.type === 'profile').find((p: { id: string }) => p.id === sam).zoom?.[`127.0.0.1:${PORT}`];
  const zoom = () => core((k) => k.profile('Sam.admin').get().wc.getZoomFactor());
  await ctrl(core, 'Sam.admin', '0'); // the site at the Kulisa zoom, then zoomed
  await expect.poll(async () => near(await zoom(), 1.25)).toBe(true);
  await ctrl(core, 'Sam.admin', '=');
  await expect.poll(siteZoom).toBe(1.1);
  await expect.poll(() => files.json('settings.json').uiZoom).toBe(1.25);
  await restart();
  await expect.poll(async () => near(await uiZoom(core), 1.25)).toBe(true);
  await expect.poll(() => core((k) => [...k.shell.profiles.values()].some((p) => p.name === 'Sam.admin' && !!p.get()))).toBe(true);
  const tab = await core(async (k, url) => { const t = k.profile('Sam.admin').newTab(url); await t.ready; return t.id; }, `${SITE}/app?after-restart`);
  await expect.poll(async () => near(await core((k, id) => k.profile('Sam.admin').get(id).wc.getZoomFactor(), tab), 1.25 * 1.1), { timeout: 3000 }).toBe(true);
  await core((k, id) => k.profile('Sam.admin').get(id).wc.close(), tab);
});
