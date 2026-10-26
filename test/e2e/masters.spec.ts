// A task's profiles and their masters: Sign In to Master…, About this profile…, real accounts' sign-ins kept in step
// across the tasks and the master (docs/profiles.md, "One store, a master and copies", "Sign-ins kept in step").
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { SITE, PORT, logged, who, choose, rightClick, focusWindow, closeSettings, chooseProfile, navRow, invoke, answer } from './helpers.ts';
import { begin, newTask } from './tasks-helpers.ts';

// The one master window open, once its page is there.
const oneMaster = (core: Core) => expect.poll(() => core((k) => k.shell.masters.size === 1 && !!k.shell.masters.values().next().value.profile.get())).toBe(true);
// It closed as the human closes it (the OS's ×), gone.
async function closeMaster(core: Core) {
  await core((k) => { k.shell.masters.values().next().value.win.close(); });
  await expect.poll(() => core((k) => k.shell.masters.size)).toBe(0);
}

test("Sign In to Master… opens its master in a window of its own, nothing automated on it; a task's copy made before keeps its own sign-in to a local app", async ({ core, ui, call, files }) => {
  const { sam } = await begin(core, ui, files);
  await rightClick(ui, ui.locator(`[data-panel="profile:${sam}"]`).getByTestId('profile-name'));
  await choose(ui, 'Sign In to Master…');
  await oneMaster(core);
  const m = await core(async (k) => {
    const m = k.shell.masters.values().next().value;
    return { dir: m.profile.dir, proxied: [...k.shell.proxy.profiles.keys()].some((x) => x.startsWith('master/')), noNode: await k.noNode(m.win.webContents) };
  });
  expect(m.dir).toBe(path.join(files.userData, 'profiles', sam));
  expect(m.proxied, 'no CDP proxy for it: nothing automated reaches it').toBe(false);
  expect(m.noNode, "its page sandboxed, as the window's").toBe(true);
  // The human signs in there, by hand (here: its bar's address).
  const bar = ui.context().pages().find((p) => p.url().includes('master.html') && !p.isClosed()) ?? await ui.context().waitForEvent('page', (p) => p.url().includes('master.html'));
  await bar.waitForLoadState();
  await invoke(bar, 'master:go', `${SITE}/app/login?name=master&kept`);
  await expect.poll(() => core((k) => k.shell.masters.values().next().value.profile.get().wc.getURL())).toMatch(/\/app$/);
  await expect(bar.locator('#address')).toHaveValue(/\/app$/, { timeout: 3000 });
  await closeMaster(core);
  expect(JSON.parse(fs.readFileSync(path.join(m.dir, 'Kulisa Tabs.json'), 'utf8')), 'its tabs kept').toEqual({ urls: [`${SITE}/app`], active: 0 });
  // A local app's sign-ins are each task's own (profiles.md, "Sign-ins kept in step"): this task's copy, made before, keeps its.
  expect(await who(call, 'Sam.admin')).toBe('Signed in as sam');
});

test("About this profile… opens Settings' window at it (one, not modal: the task's window takes input and comes in front of it, its pages on screen); its Sign In… opens the same master window, once", async ({ core, ui, sui, files }) => {
  const { sam, elon } = await begin(core, ui, files);
  await rightClick(ui, ui.locator(`[data-panel="profile:${sam}"]`).getByTestId('profile-name'));
  await choose(ui, 'About this profile…');
  const s = await sui();
  const name = s.getByRole('textbox', { name: 'Name', exact: true });
  await expect(navRow(s, `f:${sam}`)).toHaveAttribute('aria-current', 'page');
  await expect(name).toHaveValue('Sam.admin');
  await expect(navRow(s, `f:${sam}`), "the nav's narrow column cuts a name: the whole in its tooltip").toHaveAttribute('title', 'Sam.admin');
  // A window of its own, not a child of the task's (on macOS a child stays above its parent), which goes on taking input
  // and comes in front of it, Settings left as it is; the task's pages stay on screen.
  const win = await core((k) => { const w = k.shell.settings.win; return { id: w.id, title: w.getTitle(), parent: w.getParentWindow(), enabled: k.shell.win.isEnabled(), fullScreenable: w.isFullScreenable() }; });
  expect([win.title, win.parent, win.enabled]).toEqual(['Settings — Kulisa', null, true]);
  // Never full screen: macOS made it a full-screen window of its own when opened from one (settings-window.ts).
  expect(win.fullScreenable).toBe(false);
  // In front once its page is filled (settings:ready); the human turns back to the task's window only after: one
  // coming in front later takes the keyboard from it and closes its menu (Windows).
  await expect.poll(() => core((k) => k.shell.settings.win.isVisible() && k.shell.settings.win.isFocused()), 'Settings in front').toBe(true);
  await focusWindow(core, ui);
  expect(await core((k, id) => k.shell.settings?.win.id === id && !k.shell.settings.win.isFocused(), win.id), 'Settings stays open behind it').toBe(true);
  expect(await core((k, id) => k.shell.task.profiles.get(id).get().view.getVisible(), sam), 'pages on screen').toBe(true);
  // Asked again, from another profile's menu: the same window, at that page.
  await rightClick(ui, ui.locator(`[data-panel="profile:${elon}"]`).getByTestId('profile-name'));
  await choose(ui, 'About this profile…');
  await expect(name).toHaveValue('Elon.buyer');
  expect(await core((k) => k.shell.settings.win.id)).toBe(win.id);
  await chooseProfile(s, files, 'Sam.admin');
  const asks = () => logged(core, /\[ipc\] profiles:master /), before = await asks();
  await s.getByRole('button', { name: 'Sign In…' }).click();
  await oneMaster(core);
  // Again, Settings brought in front of the master's window first, as the human's click there does: a page behind
  // another window gets no mouse under Xvfb.
  await core((k) => k.focus(k.shell.settings.win));
  await s.getByRole('button', { name: 'Sign In…' }).click();
  await expect.poll(asks, 'asked twice').toBe(before + 2);
  await oneMaster(core);
  expect(await core((k) => k.shell.masters.values().next().value.profile.dir)).toBe(path.join(files.userData, 'profiles', sam));
  await closeMaster(core);
  await closeSettings(core, ui, sui);
  expect(await core((k, id) => !k.electron.BrowserWindow.fromId(id), win.id), 'its window gone, with its process').toBe(true);
});

// About 5 s: its tab waits for a site that never answers, by design (profiles.ts).
test("a master's window closed while its page still loads (a slow sign-in) goes cleanly, Sign In… answering without an error", async ({ core, ui, files }) => {
  const { sam } = await begin(core, ui, files);
  const tabs = path.join(files.userData, 'profiles', sam, 'Kulisa Tabs.json'), before = fs.existsSync(tabs) ? fs.readFileSync(tabs, 'utf8') : null;
  fs.writeFileSync(tabs, JSON.stringify({ urls: [`${SITE}/hang`], active: 0 }));
  try {
    const answered = invoke(ui, 'profiles:master', { profile: sam });
    await oneMaster(core);
    await closeMaster(core);
    // It laid out its page in the window closed meanwhile: "Object has been destroyed".
    expect(await answered).toEqual({ id: sam });
  } finally {
    if (before === null) fs.rmSync(tabs, { force: true }); else fs.writeFileSync(tabs, before);
  }
});

test("a real account's sign-in kept in step: signed in to a site (not local) in one task, it is in the others and the master; signed out, out everywhere; a local app's stays each task's", async ({ core, ui, call, files }) => {
  const { sam } = await begin(core, ui, files);
  const first = await core((k) => k.shell.task.key), shop = `http://shop.example:${PORT}`;
  // A second task of the project, Sam open in it (a copy of its master), shown. The project has no git: it works in
  // the project's folder too, after a question (answered yes).
  const second = await newTask(core, ui, null, files.pid('project'));
  await core(async (k, a) => {
    const t = k.shell.task;
    if (t.closed.has(a.sam)) await t.openProfile(a.sam);
    await k.ensureProfile('Sam.admin', `${a.site}/app`);
  }, { sam, site: SITE });
  const inFirst = { task: first };
  const shopCookie = (task: string) => core(async (k, a) => (await k.shell.taskByKey(a.task).profiles.get(a.sam).session.cookies.get({ domain: 'shop.example' })).map((c) => c.value), { task, sam });
  await call('browser_navigate', { profile: 'Sam.admin', url: `${shop}/app/login?name=real` });
  expect(await who(call, 'Sam.admin')).toBe('Signed in as real');
  await expect.poll(() => shopCookie(first)).toContain('real');
  await call('browser_navigate', { profile: 'Sam.admin', url: `${shop}/app` }, inFirst);
  expect(await who(call, 'Sam.admin', inFirst), 'in the other task too').toBe('Signed in as real');
  expect(await core(async (k, id) => (await k.electron.session.fromPath(k.shell.profileStore.masterDir(id)).cookies.get({ domain: 'shop.example' })).map((c) => c.value), sam), 'and in its master').toContain('real');
  // Signed out in the first task: out in this one too.
  await call('browser_navigate', { profile: 'Sam.admin', url: `${shop}/app/logout` }, inFirst);
  await expect.poll(() => shopCookie(second)).toEqual([]);
  await call('browser_navigate', { profile: 'Sam.admin', url: `${shop}/app` });
  expect(await who(call, 'Sam.admin')).toBe('Signed out');
  // A local app (127.0.0.1): each task's own sign-in.
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app/login?name=second` });
  expect(await who(call, 'Sam.admin')).toBe('Signed in as second');
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app` }, inFirst);
  expect(await who(call, 'Sam.admin', inFirst)).toBe('Signed in as sam');
  // The second task goes: the file's other tests begin from the first alone.
  const deleted = invoke(ui, 'task:delete', second);
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, a) => !k.shell.taskByKey(a.second) && k.shell.task?.key === a.first && k.settled(), { first, second })).toBe(true);
});
