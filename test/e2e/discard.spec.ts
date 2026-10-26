// Tabs no one looks at lose their process and come back when looked at or used (profiles.ts: discard, load; discard.ts:
// the rule and the sweep; docs/profiles.md, "Tabs unloaded").
import http from 'http';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { SITE, viewOn } from './helpers.ts';

// A tab of Sam's set as the sweep would find it after the time: off screen since long, its profile's last command long
// ago (the sweep's clock is minutes). The sweep then: how many tabs it unloads.
const age = (core: Core, tab: string) => core((k, id) => {
  const sam = k.profile('Sam'), long = Date.now() - 10 * 60_000;
  sam.tabs.find((t) => t.id === id).offScreenSince = long; sam.busyAt = long;
}, tab);
const sweep = (core: Core) => core((k) => k.shell.discard.sweep());
const tab = (core: Core, id: string) => core((k, i) => {
  const t = k.profile('Sam').tabs.find((x) => x.id === i);
  return t && { discarded: !!t.discarded, destroyed: t.wc.isDestroyed(), url: t.wc.isDestroyed() ? t.url : t.wc.getURL(), title: t.title, loading: t.wc.isDestroyed() ? false : t.wc.isLoading() };
}, id);
// A new tab of Sam's, loaded: its id.
const newTab = (core: Core, url: string, activate = true) => core(async (k, a) => {
  const t = k.profile('Sam').newTab(a.url, { activate: a.activate });
  await t.ready;
  return t.id;
}, { url, activate });
const idle = (core: Core) => expect.poll(() => core((k) => !k.shell.task.agentTerminals().some((t) => t.state === 'working' || t.state === 'waiting'))).toBe(true);

test('a tab no one looks at loses its process after the time; the strip and the saved tabs keep it; the agent and the human get it back where it was', async ({ core, ui, call, files }) => {
  const sam = await core(async (k, url) => (await k.ensureProfile('Sam', url)).id, `${SITE}/app`);
  const first = await core((k) => k.profile('Sam').tabs[0].id);
  const board = await newTab(core, `${SITE}/board`), form = await newTab(core, `${SITE}/form`); // form in front, on screen
  await expect.poll(() => core((k, id) => { const t = k.profile('Sam').tabs.find((x) => x.id === id); return t.title === 'board' && !t.loading && !t.pendingUrl; }, board)).toBe(true); // a page still loading is kept
  await idle(core);
  const strip = ui.locator(`.pane[data-profile="${sam}"] .tabs .tab .title`);
  const n = await core((k) => k.webContents());
  // The sweep dates what is off screen; nothing goes before the time.
  expect(await sweep(core)).toBe(0);
  expect(await core((k, a) => { const ts = k.profile('Sam').tabs; return [!!ts.find((t) => t.id === a.board).offScreenSince, !!ts.find((t) => t.id === a.form).offScreenSince]; }, { board, form }),
    'the inactive tab is dated, the active one not').toEqual([true, false]);
  // After the time, the inactive tab alone, its process gone.
  await age(core, board);
  expect(await sweep(core)).toBe(1);
  await expect.poll(() => tab(core, board)).toMatchObject({ discarded: true, destroyed: true, url: `${SITE}/board`, title: 'board' });
  expect(await core((k) => k.webContents()), 'its process is gone').toBe(n - 1);
  expect((await tab(core, form)).discarded || (await tab(core, first)).discarded, 'the active tab stays; the others were dated only now').toBe(false);
  await expect(strip).toContainText(['board']); // the strip shows it as before
  await expect.poll(() => files.savedTabs('Sam')).toContain(`${SITE}/board`); // saved with the others, to come back after a restart
  // The agent: the tab listed as any, and a tool on it loads it first.
  const listed = JSON.parse((await call('profile_list')).text).find((p: { name: string }) => p.name === 'Sam').tabs;
  expect(listed.find((t: { id: string }) => t.id === board)).toEqual({ id: board, title: 'board', url: `${SITE}/board` });
  expect((await call('browser_snapshot', { profile: 'Sam', tab: board })).text).toMatch(/Title: board/);
  expect(await tab(core, board), 'loaded again at its address').toMatchObject({ discarded: false, destroyed: false, url: `${SITE}/board` });
  expect(await core((k) => k.profile('Sam').active), 'the active tab is still the one the human had').toBe(form);
  // The human: a click on its tab in the strip brings it back on screen.
  await age(core, board);
  expect(await sweep(core)).toBe(1);
  await expect.poll(async () => (await tab(core, board)).discarded).toBe(true);
  await ui.locator(`.pane[data-profile="${sam}"] .tabs .tab[data-tab="${board}"]`).click();
  await expect.poll(() => core((k) => k.profile('Sam').active)).toBe(board);
  await expect.poll(() => tab(core, board)).toMatchObject({ discarded: false, destroyed: false, url: `${SITE}/board`, loading: false });
  await expect.poll(() => viewOn(core, ui, files, 'Sam')).toBe(true);
  // Closed while discarded (the agent's or the human's ×): gone from the strip, nothing to close.
  await core((k, id) => k.profile('Sam').activate(id), form);
  await age(core, board);
  expect(await sweep(core)).toBe(1);
  await expect.poll(async () => (await tab(core, board)).discarded).toBe(true);
  await call('browser_tab_close', { profile: 'Sam', tab: board });
  expect(await tab(core, board)).toBeUndefined();
  await expect(strip.filter({ hasText: /^board$/ })).toHaveCount(0);
});

test('not while an agent of the task works or waits, nor while automation drives the profile, nor a page holding its unload', async ({ core, call }) => {
  await core(async (k, url) => { await k.ensureProfile('Sam', url); }, `${SITE}/app`);
  const hooks = await core((k) => k.hooksOf());
  const post = (event: string) => new Promise((r) => http.request(`${hooks}/${event}`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end('{}'));
  const busy = (at: 'now' | 'long ago') => core((k, a) => { k.profile('Sam').busyAt = a === 'now' ? Date.now() : Date.now() - 10 * 60_000; }, at);
  const back = await newTab(core, `${SITE}/app?idle`, false);
  await expect.poll(async () => (await tab(core, back)).loading).toBe(false); // a page still loading is kept
  await post('prompt');
  await age(core, back);
  expect(await sweep(core), 'the agent works: its tabs may be in use any moment').toBe(0);
  await post('waiting');
  expect(await sweep(core), 'waiting for the human: it goes on in them after').toBe(0);
  await post('stop');
  await idle(core);
  await busy('now');
  expect(await sweep(core), 'a command through the proxy a moment ago: an agent without hooks, or a script').toBe(0);
  await busy('long ago');
  expect(await sweep(core)).toBe(1);
  await expect.poll(async () => (await tab(core, back)).discarded).toBe(true);
  await core((k, id) => k.profile('Sam').closeTab(id), back);
  // A page with unsaved changes says so (beforeunload, once the human has acted in it): it stays, as in Chrome.
  const draft = await newTab(core, `${SITE}/draft`);
  await expect.poll(async () => (await tab(core, draft)).loading).toBe(false);
  await call('browser_click', { profile: 'Sam', tab: draft, locator: "getByRole('button', { name: 'Draft' })" });
  await core((k) => { const sam = k.profile('Sam'); sam.activate(sam.tabs[0].id); });
  await age(core, draft);
  expect(await sweep(core), 'tried').toBe(1);
  await expect.poll(() => core((k, id) => k.profile('Sam').tabs.find((t) => t.id === id).discarding === undefined, draft)).toBe(true);
  expect(await tab(core, draft), 'kept: the page held its unload').toMatchObject({ discarded: false, destroyed: false });
  // Closing it for good: the test's own, as Chrome asks the human.
  await core((k, id) => {
    const sam = k.profile('Sam'), t = sam.tabs.find((x) => x.id === id);
    t.wc.removeAllListeners('will-prevent-unload');
    t.wc.on('will-prevent-unload', (e) => e.preventDefault());
    sam.closeTab(id);
  }, draft);
  await expect.poll(() => tab(core, draft)).toBeUndefined();
});
