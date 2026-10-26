// Projects (docs/tasks.md, Projects; docs/window.md, Settings): Project Settings… and Settings' window, Delete Project…,
// New Project's ways to take the code, and what the projects' tabs and windows are after a restart.
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { data } from './data.ts';
import { menuRows, choose, closeMenu, rightClick, projectTabs, projectTab, showProject, plusMenu, focusWindow, closeSettings, settingsClosed, sleep, viewOn } from './helpers.ts';
import { SAM, ELON, git, begin, invoke, act, typeIn, asked, notLoading, projectMenu, plusOpen, newTask, taskTabs, otherPage, installFakeAgent, pageOf, newProfileHere, onRow } from './project-helpers.ts';
import { createWorktree } from '../../src/main/worktrees.ts';
import { removeTree } from '../../src/main/remove.ts';

type Files = ReturnType<typeof data>;

const gone = (...dirs: string[]) => { for (const d of dirs) if (fs.existsSync(d)) removeTree(d); };
// A project opened from its folder (Open Folder…, project:open), its first task shown once its agent started.
async function openFolder(core: Core, ui: Page, folder: string) {
  fs.mkdirSync(folder, { recursive: true });
  await invoke(ui, 'project:open', { folder });
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded && !!k.shell.pty && !k.shell.windows[0].switching, folder)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await notLoading(ui);
}
// A project the window has no task of shown again as the human does it (its tab), once it is.
async function backTo(core: Core, ui: Page, files: Files, folder: string) {
  await showProject(ui, files, folder);
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded && !k.shell.windows[0].switching, files.pid(folder))).toBe(true);
  await notLoading(ui);
}
// The tasks' window's page that shows sel, of those the Kulisa of page has.
async function pageWith(page: Page, sel: string) {
  let found: Page;
  await expect.poll(async () => {
    for (const p of page.context().pages()) if (!p.isClosed() && p.url().includes('/index.html') && await p.locator(sel).count()) { found = p; return true; }
    return false;
  }).toBe(true);
  return found;
}
// A project deleted as Settings does (its data and tasks' copies; Delete Project… is tested below), its folder too.
async function forget(core: Core, ui: Page, files: Files, folder: string, dir = path.join(files.root, folder)) {
  const id = await core((k, f) => k.shell.store.projects().find((p) => p.folders.some((x) => path.basename(x).toLowerCase() === f))?.id, folder).catch((): undefined => undefined);
  if (id) await invoke(ui, 'project:delete', { id });
  await core((k) => { k.asked.length = 0; });
  gone(dir);
}

test("projects: the projects' manager (Project Settings…) changes its name and agents, the default one + runs, none the default: a new task starts nothing, the island's buttons instead; a folder with a favicon gets it as its icon, and its hue as its color", async ({ core, ui, sui, call, files }) => {
  test.slow(); // three tasks started, Settings opened six times
  installFakeAgent(files);
  await begin(core, ui, files);
  const site = path.join(files.root, 'site');
  fs.mkdirSync(path.join(site, 'public'), { recursive: true });
  fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="red"/></svg>');
  await openFolder(core, ui, site);
  const id = files.pid('site'), tab = `#projectTabs [data-project="${id}"] .name`;
  await expect(projectTab(ui, files, 'site').locator('.favicon')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  // Its color: its favicon's hue (red: 29°; a few degrees off where its edges blend) in the lightness and chroma of
  // Kulisa's own colors; the window's and its island's. What projects.json keeps (the next free color) is for a
  // project with none.
  const shown = (hue: number | string) => ui.evaluate(([hue, sel]) => {
    const c = document.documentElement.style.getPropertyValue('--project'), h = /^oklch\(0\.61 0\.12 (\d+)\)$/.exec(c)?.[1];
    return document.querySelector<HTMLElement>(sel).style.getPropertyValue('--color') === c && (typeof hue === 'number' ? Math.abs(Number(h) - hue) <= 4 : c === hue);
  }, [hue, `#projectTabs .tasktab[data-project="${id}"]`] as const);
  await expect.poll(() => shown(29)).toBe(true);
  // Its settings: its favicon in the list, the folder shown and not changed.
  await projectMenu(ui, 'Project Settings…', tab);
  let s = await sui();
  await pageOf(s, 'site');
  // The manager lists every project, this one chosen.
  await expect(s.locator(`#pjlist [data-project="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(s.locator(`#pjlist [data-project="${id}"] .picon`)).toHaveClass(/\bfavicon\b/);
  await expect(s.locator('#npfolders [data-folder] small'), 'its folder, as its code').toHaveText(site);
  await expect(s.locator('#nplocationrow')).toHaveCount(0);
  // A page: its top (New Task, ⋯), each part saved as it changes; the dialog stays open.
  expect(await s.evaluate(() => [...document.querySelectorAll('#pjconfig .titled, #pjconfig .field > label')].map((h) => h.textContent).join(', ')))
    .toBe('Name:, Folders, Agents, Profiles, Local addresses:');
  const entryOf = () => core((k, i) => k.shell.store.projects().find((p) => p.id === i), id);
  // Its favicon changed: read again as its settings open. Mostly blue with a red dot: the hue of the most (264°).
  const favicon = (svg: string) => fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${svg}</svg>`);
  const reopen = async () => {
    await closeSettings(core, ui, sui);
    await projectMenu(ui, 'Project Settings…', tab);
    s = await sui();
    await pageOf(s, 'site');
  };
  favicon('<rect width="16" height="16" fill="#00f"/><circle cx="8" cy="8" r="2" fill="red"/>');
  await reopen();
  await expect.poll(() => shown(264)).toBe(true);
  // A black mark (GitHub's, an SVG in currentColor) has no hue: the color it was given.
  favicon('<path d="M2 2h12v12H2z" fill="#000"/>');
  await reopen();
  const given = (await entryOf()).color;
  await expect.poll(() => shown(given)).toBe(true);
  await typeIn(s, '#nplocal', 'abc.ngrok.app *.Shop.dev', true);
  await expect.poll(async () => (await entryOf()).local?.length).toBe(2);
  // The name typed and the window closed with the OS's ×: kept (its page saves it, then closes it).
  await s.locator('#pjname').fill('Site-2');
  expect((await entryOf()).name, 'not yet: on Enter or leaving it').toBe('site');
  await core((k) => k.shell.settings.win.close());
  await settingsClosed(core, ui);
  await expect.poll(async () => (await entryOf()).name).toBe('Site-2');
  const entry = await entryOf();
  expect([entry.name, entry.folders]).toEqual(['Site-2', [site]]);
  // Said in the log once, though the page saves every field at each change (store.ts, updateProject).
  const renames = fs.readFileSync(path.join(files.userData, 'logs', 'kulisa.log'), 'utf8').match(new RegExp(`\\[project\\] ${id} renamed: .*`, 'g'));
  expect(renames).toEqual([`[project] ${id} renamed: Site-2`]);
  expect(entry.local, "its own local addresses, where test users' pairs may be typed (local.ts)").toEqual(['abc.ngrok.app', 'shop.dev']);
  await expect.poll(async () => (await projectTabs(ui, files)).includes('site *') && await core((k) => k.shell.win.getTitle() === `${k.shell.task.name} · Site-2 — Kulisa`)).toBe(true);
  // Its profiles: a new one; one of another project, the same person (its master, its sign-ins); × lets go of one.
  await projectMenu(ui, 'Project Settings…', tab);
  s = await sui();
  await expect(s.locator('#npprofilesrow')).toBeVisible();
  await expect(s.locator('#npprofiles .item')).toHaveCount(0);
  await newProfileHere(s, 'Site-user');
  await expect.poll(() => { try { return !!files.idOf('Site-user'); } catch { return false; } }).toBe(true);
  const siteUser = files.idOf('Site-user'), samId = files.idOf(SAM);
  await expect(s.locator(`#npprofiles [data-profile="${siteUser}"]`)).toBeVisible();
  await s.locator('#npprofileadd').click();
  expect((await menuRows(s)).join('|')).toContain('# Other Profiles|Sam.admin');
  await choose(s, 'Sam.admin');
  await expect(s.locator(`#npprofiles [data-profile="${samId}"] .cell`)).toHaveText(['Sam.admin', 'seller in the test shop', 'project']);
  await expect.poll(() => core((k, a) => k.shell.closed.has(a.sam) && k.shell.closed.has(a.user), { sam: samId, user: siteUser })).toBe(true); // its task lists them, closed
  await onRow(s, `#npprofiles [data-profile="${siteUser}"]`, 'npprofiledel');
  expect((await asked(core)).message).toBe('Remove the profile Site-user from Site-2?');
  await expect.poll(() => core((k, u) => !k.shell.closed.has(u), siteUser)).toBe(true);
  expect(await core((k, u) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(u)), siteUser), 'in no other project: kept all the same, until deleted in Settings → Profiles').toEqual([]);
  await core((k, u) => { k.shell.profileStore.delete(u); }, siteUser); // not needed after
  await closeSettings(core, ui, sui);
  // Opened in this task: a copy of its master, here.
  await act(ui, 'profile:open', { profile: samId });
  await expect.poll(() => core((k, sam) => k.shell.profiles.has(sam), samId)).toBe(true);
  expect(await core((k, sam) => k.shell.profiles.get(sam).dir, samId)).toBe(path.join(files.userData, 'projects', id, files.tid('site', 1), samId));
  // Let go here: it stays in project, with its master.
  await act(ui, 'profile:delete', { profile: samId });
  expect((await asked(core)).message).toBe('Remove the profile Sam.admin from Site-2?');
  await expect.poll(() => core((k, sam) => !k.shell.profiles.has(sam), samId)).toBe(true);
  expect(await core((k, sam) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(sam)), samId)).toEqual([files.pid('project')]);
  // Its agents: a list, added from the agents without accounts and the accounts in the store (one made in Settings →
  // Agents, in no project), one the default (a radio); at once, not on Save.
  const ann = await core((k) => { const a = k.shell.accounts; return a.create((a.prepare('fake') as { id: string }).id, 'fake', 'ann@shop.com').id; });
  await projectMenu(ui, 'Project Settings…', tab);
  s = await sui();
  await expect(s.locator('#npagentsrow')).toBeVisible();
  await s.locator('#npagentadd').click();
  expect(await menuRows(s), 'an agent with accounts: one of its accounts').not.toContain('Fake agent');
  await closeMenu(s);
  const titles = () => s.locator('#npagents .item').evaluateAll((rs) => rs.map((r) => (r as HTMLElement).title));
  for (const name of ['Terminal only', 'Fake agent · ann@shop.com']) {
    await s.locator('#npagentadd').click();
    await menuRows(s);
    await choose(s, name);
    await expect.poll(titles).toContain(name);
  }
  // The default marked, Make Default on the others.
  const agentRows = () => s.locator('#npagents .item').evaluateAll((rs) => rs.map((r) => `${(r as HTMLElement).title} ${!!r.querySelector('.default')}`));
  expect(await agentRows(), 'the first added, the default').toEqual(['Terminal only true', 'Fake agent · ann@shop.com false']);
  // A table: each value in its column, under its name, the columns at the same places in every row (values
  // one after another, each row in its own rhythm, read as chaos).
  expect(await s.evaluate(() => {
    const list = document.querySelector('#npagentsrow .list'), x = (e: Element) => Math.round(e.getBoundingClientRect().left);
    const rows = [list.querySelector('.head'), ...list.querySelectorAll('.item')].map((r) => [...r.children].map(x).join());
    return [[...list.querySelector('.head').children].map((h) => h.textContent), rows.every((r) => r === rows[0])];
  })).toEqual([['Agent', 'Account', ''], true]);
  expect((await entryOf()).agents).toEqual(['shell', ann]);
  expect(await core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), ann), 'the projects list their agents').toEqual([id]);
  await onRow(s, `#npagents [data-agent="${ann}"]`, 'npagentdefault');
  await expect.poll(agentRows).toEqual(['Fake agent · ann@shop.com true', 'Terminal only false']);
  // Its right-click has the same: Make Default.
  // The row not chosen yet: Reka's list takes the keyboard to it just after the menu opens, which would close the
  // menu (RightClickMenu.vue).
  await rightClick(s, '#npagents [data-agent="shell"] .label');
  expect(await menuRows(s)).toEqual(['Make Default', 'Remove from the Project']);
  await choose(s, 'Make Default');
  await expect.poll(agentRows).toEqual(['Terminal only true', 'Fake agent · ann@shop.com false']);
  // None the default: No Default on the default one's right-click, or its ★; ★ on it again makes it the default.
  await rightClick(s, '#npagents [data-agent="shell"] .label');
  expect(await menuRows(s)).toEqual(['No Default', 'Remove from the Project']);
  await choose(s, 'No Default');
  await expect.poll(agentRows).toEqual(['Terminal only false', 'Fake agent · ann@shop.com false']);
  expect((await entryOf()).noDefaultAgent).toBe(true);
  await onRow(s, '#npagents [data-agent="shell"]', 'npagentdefault');
  await expect.poll(agentRows).toEqual(['Terminal only true', 'Fake agent · ann@shop.com false']);
  expect((await entryOf()).noDefaultAgent).toBeUndefined();
  await onRow(s, '#npagents [data-agent="shell"]', 'npagentdefault');
  await expect.poll(agentRows).toEqual(['Terminal only false', 'Fake agent · ann@shop.com false']);
  await onRow(s, '#npagents [data-agent="shell"]', 'npagentdefault');
  await expect.poll(agentRows).toEqual(['Terminal only true', 'Fake agent · ann@shop.com false']);
  await closeSettings(core, ui, sui);
  // + makes a task with the default one (the first kept the one it started with). No git: a second task in the folder,
  // after the question.
  const agentOf = (key: string) => JSON.parse(fs.readFileSync(path.join(files.userData, 'projects', key.replace('/', path.sep), 'agent.json'), 'utf8')).agent;
  const before = await newTask(core, ui, id);
  expect(agentOf(before)).toBe('shell');
  // Another agent: made the default on the project's page (Make Default), + runs it.
  await invoke(ui, 'project:agent-default', { id, agent: ann });
  const annTask = await newTask(core, ui, id);
  await expect.poll(() => core((k) => k.shell.task.promptTarget()?.agent.id)).toBe(ann);
  expect(await core((k) => k.shell.task.profiles.size), 'no profile opens by itself').toBe(0);
  // None the default: a new task starts nothing, the island's buttons instead; Ctrl+` there gives them the keyboard.
  await invoke(ui, 'project:agent-default', { id, agent: null });
  await invoke(ui, 'task:new', { project: id });
  // Shown, not only loaded: a key while the window still switches acts for the task before (docs/testing.md; on a
  // loaded machine Ctrl+` below may do nothing).
  await expect.poll(() => core((k, a) => k.shell.task.key !== a && k.shell.task.loaded && !k.shell.windows[0].switching, annTask)).toBe(true);
  await notLoading(ui);
  const bare = await core((k) => { k.asked.length = 0; return k.shell.task.key; });
  await expect(ui.locator('.launch .agents .name')).toHaveText(['Fake agent', 'Terminal']);
  // A project with no profiles: one tile, Add Profile…, its page in Settings.
  await expect(ui.locator('.launch .profiles .name')).toHaveText(['Add Profile…']);
  await ui.locator('.launch .profiles .launcher').click();
  s = await sui();
  await expect(s.locator(`#pjlist [data-project="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await closeSettings(core, ui, sui);
  const terminals = () => core((k, key) => k.shell.taskByKey(key).terminals.size, bare);
  expect(await terminals()).toBe(0);
  expect(agentOf(bare)).toBe(null);
  await ui.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await focusWindow(core, ui);
  // Once more until the launcher has it: on a loaded machine the + menu, closed just before, may give the keyboard
  // back where it was after Ctrl+` had given it to the launcher. Opens nothing: no agent.
  const onLauncher = () => ui.evaluate(() => document.activeElement === document.querySelector('.launcher'));
  await expect(async () => {
    if (!(await onLauncher())) await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
    await expect.poll(onLauncher, { timeout: 1500 }).toBe(true);
  }, 'Ctrl+` gives the launcher the keyboard').toPass({ timeout: 6000 });
  expect(await terminals(), 'nothing opened').toBe(0);
  // With a profile open, the island is a strip: Ctrl+` opens its +.
  await call('profile_create', { name: 'Bo.bare' }, { task: bare });
  await expect(ui.locator('#termUnfold')).toHaveCount(1);
  await expect(ui.locator('.launch')).toHaveCount(0);
  await focusWindow(core, ui);
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  expect(await menuRows(ui)).toEqual(['Fake agent · ann@shop.com', '-', 'Terminal']);
  await closeMenu(ui);
  expect(await terminals(), 'nothing opened').toBe(0);
  const bo = files.idOf('Bo.bare');
  await act(ui, 'profile:delete', { profile: bo });
  await expect.poll(() => core((k, a) => !k.shell.taskByKey(a.key).profiles.has(a.bo), { key: bare, bo })).toBe(true);
  await core((k, b) => { k.shell.profileStore.delete(b); k.asked.length = 0; }, bo);
  // Let go of at once, an account as an agent without accounts: its tasks keep it, and the account stays in the store.
  await invoke(ui, 'project:agent-remove', { id, agent: ann });
  await invoke(ui, 'project:agent-remove', { id, agent: 'shell' });
  expect((await entryOf()).agents, 'none left').toBeUndefined();
  expect(await core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), ann)).toEqual([]);
  expect(await core((k, key) => k.shell.taskByKey(key).promptTarget().agent.id, annTask)).toBe(ann);
  expect(await core((k, key) => [...k.shell.taskByKey(key).terminals.values()].map((t) => [t.name, !!t.agent]), before), 'the terminal only: a shell').toEqual([['Terminal', false]]);
  await invoke(ui, 'project:close-tasks', { id });
  await expect.poll(() => core((k, i) => !k.shell.open.has(i), id)).toBe(true);
  // What it made gone, for a test after it.
  await forget(core, ui, files, 'site');
  await core((k, a) => { const acc = k.shell.accounts, dir = acc.find(a).dir; acc.drop(a); acc.remove(dir); }, ann);
});

test("projects: the title bar's gear opens Settings' window at the shown project; another one, not open, is configured there too, asked there; what is done in the task's window meanwhile is asked there; no New Project in it", async ({ core, ui, sui, files }) => {
  await begin(core, ui, files);
  // A project with no task open.
  const closed = path.join(files.root, 'closed');
  fs.mkdirSync(closed, { recursive: true });
  const closedId = await core((k, f) => { const p = k.shell.store.projectFor(f); k.shell.sendProjects(); return p.id; }, closed);
  // Shown once it is filled (its tree's three sections, the agents found, the project's page): as it came, it jumped.
  await core((k) => {
    const g = globalThis as any;
    g.__filled = null;
    k.electron.app.once('browser-window-created', (_e, w) => w.once('show', () => {
      void w.webContents.executeJavaScript(`[document.querySelectorAll('#pjlist [data-agent]').length > 0, document.querySelectorAll('#pjlist [data-profile]').length > 0, !!document.getElementById('pjhead')]`)
        .then((r) => { g.__filled = r; });
    }));
  });
  await ui.locator('#manageProjects').click();
  await expect.poll(() => core(() => (globalThis as any).__filled)).toEqual([true, true, true]);
  const s = await sui();
  await pageOf(s, 'project');
  await expect(s.locator('#pjlist [aria-selected="true"]')).toHaveAttribute('data-project', files.pid('project'));
  // Pages on screen under Settings' window (once live again after the last menu's pictures: on a loaded machine later).
  await expect.poll(() => core((k) => k.profile('Sam.admin').get().view.getVisible())).toBe(true);
  // The other project is closed: its configuration all the same; a profile made and let go there (asked first, in
  // Settings' window, where it was done).
  await s.locator(`#pjlist [data-project="${closedId}"]`).click();
  await pageOf(s, 'closed');
  expect(await core((k, i) => k.shell.open.has(i), closedId)).toBe(false);
  await newProfileHere(s, 'Closed-one');
  await expect.poll(() => { try { return !!files.idOf('Closed-one'); } catch { return false; } }).toBe(true);
  const closedOne = files.idOf('Closed-one');
  await expect(s.locator(`#npprofiles [data-profile="${closedOne}"]`)).toBeVisible();
  await onRow(s, `#npprofiles [data-profile="${closedOne}"]`, 'npprofiledel');
  await expect.poll(() => core((k, p) => k.asked.length > 0 && !k.shell.store.projectsWith('profiles', p).length, closedOne)).toBe(true);
  expect((await asked(core)).message).toBe('Remove the profile Closed-one from closed?');
  await expect(ui.locator('#ask'), "not in the task's window").toHaveCount(0);
  await core((k, p) => { k.shell.profileStore.delete(p); }, closedOne); // not needed after
  await expect(s.locator(`#npprofiles [data-profile="${closedOne}"]`)).toHaveCount(0);
  await expect(s.locator('#npprofileerror')).toHaveText('');
  const png = test.info().outputPath('projects.png');
  await core((k, f) => k.shot(f), png);
  await test.info().attach('projects', { path: png, contentType: 'image/png' });
  // Done in the task's window with Settings in front, that window minimized (a pane's Remove from Project…; on macOS the
  // OS's × of a window behind): asked in the task's window, not in Settings', and that window comes back to the front
  // with it.
  await core((k) => k.shell.win.minimize());
  await expect.poll(() => core((k) => k.shell.win.isMinimized())).toBe(true);
  await core((k) => k.shell.settings.win.focus());
  await expect.poll(() => core((k) => k.shell.settings.win.isFocused())).toBe(true);
  await core((k) => { k.answer = false; });
  const said = await invoke(ui, 'profile:delete', { task: await core((k) => k.shell.task.key), profile: files.idOf(SAM) });
  expect(said).toEqual({ error: 'the human said no' });
  expect((await asked(core)).message).toMatch(/^Remove the profile Sam\.admin from /);
  await expect(s.locator('#ask'), "not in Settings' window").toHaveCount(0);
  // Waited for: macOS restores a minimized window with its animation, and makes it key at its end.
  await expect.poll(() => core((k) => !k.shell.win.isMinimized() && k.shell.win.isFocused()), { message: 'the task\'s window in front with its question' }).toBe(true);
  await core((k) => { k.answer = true; });
  // The theme and the Kulisa zoom are every window's: its too.
  const theme = await core((k) => k.shell.theme);
  const other = theme === 'light' ? 'dark' as const : 'light' as const;
  await core((k, t) => k.shell.setTheme(t), other);
  await expect(s.locator('html')).toHaveAttribute('data-theme', other);
  await core((k, t) => k.shell.setTheme(t), theme);
  const zoom = () => core((k) => k.shell.settings.win.webContents.getZoomFactor());
  await core((k) => k.shell.setUiZoom(1.25));
  await expect.poll(zoom).toBeCloseTo(1.25, 6);
  await core((k) => k.shell.setUiZoom(1));
  await expect.poll(zoom).toBeCloseTo(1, 6);
  await closeSettings(core, ui, sui);
  await forget(core, ui, files, 'closed');
});

test("projects: Delete Project… (the projects' manager alone) asks, closes the project when open, deletes its data and its tasks' copies, never its folder; New Project takes its code from folders on the disk or clones it from URLs, one or several, making no other folder", async ({ core, ui, sui, files }) => {
  test.slow(); // git's work (worktrees, clones), five projects made and deleted, the project's tasks closed and opened again
  const root = files.root, home = await core((k) => k.shell.projectsHome);
  gone(...['spare', 'gone', 'back', 'cloned.git', 'back.git', 'bad'].map((d) => path.join(root, d)), path.join(home, 'cloned'), path.join(home, 'fullstack'));
  await begin(core, ui, files);
  const projects = async () => (await core((k) => k.shell.store.projects().map((p) => p.folders[0]))).map((f) => path.basename(f)); // each by its folder's name (pid)
  // A project that is not open, with a task that has a commit of its own, as Kulisa lays them out.
  const spare = path.join(root, 'spare');
  fs.mkdirSync(spare);
  git(spare, 'init', '-q'); fs.writeFileSync(path.join(spare, 'a.txt'), 'a'); git(spare, 'add', '-A'); git(spare, 'commit', '-qm', 'a');
  const wt = await createWorktree(spare, 'idea', null, []);
  fs.writeFileSync(path.join(wt.folder, 'b.txt'), 'b'); git(wt.folder, 'add', '-A'); git(wt.folder, 'commit', '-qm', 'b');
  // A profile of its own (in no other project): its master goes with it. An agent's account in no other project: it
  // stays, let go of (Settings → Agents deletes one).
  const made = await core((k, a) => {
    const s = k.shell, p = s.store.projectFor(a.spare);
    const own = s.profileStore.create(p.id, { name: 'Spare-user', avatar: 'fox' }) as { id: string };
    const account = s.accounts.create((s.accounts.prepare('fake') as { id: string }).id, 'fake', 'spare@shop.com');
    s.store.updateProject(p.id, { agents: [account.id] });
    return { id: p.id, own: own.id, account: account.id, accountDir: account.dir };
  }, { spare });
  const data = path.join(files.userData, 'projects', made.id);
  fs.mkdirSync(path.join(data, 'aaaaa1', made.own), { recursive: true });
  fs.mkdirSync(made.accountDir, { recursive: true });
  fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify({ list: [{ id: 'aaaaa1', name: 'task-1', named: true, resources: [{ kind: 'maintree', folder: spare }] }, { id: 'aaaaa2', name: 'Idea', named: true, resources: [{ kind: 'worktree', ...wt }] }] }));
  await core((k) => k.shell.sendProjects()); // made behind the windows' back: they are told, as when a project is made

  // In the projects' manager, its Delete Project…: the human is told what goes, says no, then yes.
  const removeRow = async (folder = 'spare') => {
    const { id, name } = await core((k, i) => k.shell.store.projects().find((x) => x.id === i), files.pid(folder));
    if (!(await core((k) => !!k.shell.settings))) await ui.locator('#manageProjects').click();
    const s = await sui();
    await s.locator(`#pjlist [data-project="${id}"]`).click();
    await pageOf(s, name);
    await s.locator('#pjmore').click(); // ⋯ at its top
    await menuRows(s);
    await choose(s, 'Delete Project…');
  };
  await core((k) => { k.answer = false; });
  await removeRow();
  const q = await asked(core);
  expect(q.message).toBe('Delete the project spare?');
  expect(q.detail).not.toMatch(/Spare-user/);
  expect(q.detail).toMatch(/Its profiles stay, with their sign-ins/);
  expect(q.detail, 'its accounts stay').not.toMatch(/accounts/);
  expect(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`Its folders stay as they are: ${spare}.`)).toBe(true);
  expect((await projects()).includes('spare') && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no').toBe(true);
  await core((k) => { k.answer = true; });
  await removeRow();
  await expect.poll(async () => (await projects()).includes('spare')).toBe(false);
  await expect.poll(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree)).toBe(true);
  const master = await core((k, o) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(o)).length === 0 && k.shell.profileStore.masterDir(o), made.own);
  expect(!!master && fs.existsSync(master), 'its profile kept, with its sign-ins, in no project (as its account)').toBe(true);
  await core((k, o) => { k.shell.profileStore.delete(o); k.asked.length = 0; }, made.own); // not needed after
  const logouts = path.join(root, 'logouts');
  expect(fs.existsSync(made.accountDir) && !(fs.existsSync(logouts) && fs.readFileSync(logouts, 'utf8').includes(made.accountDir)), 'its account kept, signed in').toBe(true);
  expect(await core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), made.account)).toEqual([]);
  expect(git(spare, 'branch', '--list', wt.branch), "the task's branch").toBe('');
  expect(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), "the project's own folder stays").toBe('a');
  expect(await core((k, i) => !!k.shell.task?.loaded && k.shell.current?.id === i, files.pid('project')), 'another project: the open one stays open').toBe(true);
  await expect((await sui()).locator(`#pjlist [data-project="${made.id}"]`)).toHaveCount(0);
  await closeSettings(core, ui, sui);

  // New Project… asks for its code first (the code is often on the disk already). Folder on disk, a repository: taken
  // as it is, its files and its history kept, no git init, nothing made; named after its folder; Create opens its
  // first task, as for any new project.
  const goneDir = path.join(root, 'gone');
  fs.mkdirSync(goneDir); git(goneDir, 'init', '-q'); fs.writeFileSync(path.join(goneDir, 'a.txt'), 'a'); git(goneDir, 'add', '-A'); git(goneDir, 'commit', '-qm', 'mine');
  // In a tasks' window (the bar's +, a dialog), Settings closed first.
  const newProject = async (from: string) => {
    if (await core((k) => !!k.shell.settings)) await closeSettings(core, ui, sui);
    // A task shown: New Project… in the bar's + dropdown; the empty window: the board's own button.
    if (await ui.locator('#newTask').count()) {
      await plusMenu(ui);
      await ui.locator('.menu[data-state="open"] [role="menuitem"]').filter({ has: ui.locator('.label', { hasText: /^New Project…$/ }) }).click();
    } else await ui.locator('#boardnewproject').click();
    await ui.locator(`#newproject #npfrom [data-value="${from}"]`).click();
    await expect(ui.locator(`#npfrom [data-value="${from}"]`)).toHaveAttribute('aria-selected', 'true');
  };
  const submit = () => ui.evaluate(() => (document.getElementById('npform') as HTMLFormElement).requestSubmit());
  // Its steps gone through (no agent, no profile chosen), then Create: made, its first task opened in this window.
  const create = async (folder: string) => {
    for (const step of ['Agents', 'Profiles']) {
      await submit();
      await expect.poll(() => ui.evaluate(() => document.querySelector('#newproject .steps [aria-current="step"]')?.textContent.slice(1))).toBe(step);
    }
    await submit();
    await expect.poll(async () => {
      const c = await core((k) => k.shell.current && !!k.shell.task?.loaded && !!k.shell.pty && !k.shell.windows[0].switching && k.shell.current.id);
      return !!c && files.named(c) === folder;
    }, { timeout: 10000 }).toBe(true); // a clone takes a while
    await notLoading(ui);
  };
  await newProject('folder');
  await expect(ui.locator('#nplocationrow'), 'no location: nothing is made').toHaveCount(0);
  const add = async (v: string) => { await typeIn(ui, '#npsource', v); await ui.locator('#npaddsource').click(); };
  await add(path.join(root, 'nowhere'));
  await expect(ui.locator('#nperror')).toHaveText(`${path.join(root, 'nowhere')} is not there`);
  await expect(ui.locator('#npsources .item'), 'not in the list').toHaveCount(0);
  expect(fs.existsSync(path.join(root, 'nowhere')), 'not made').toBe(false);
  await core((k, f) => {
    const d = k.electron.dialog;
    (globalThis as any).__open = d.showOpenDialog;
    d.showOpenDialog = (async () => ({ canceled: false, filePaths: [f] }));
  }, goneDir);
  try {
    await typeIn(ui, '#npsource', '');
    await typeIn(ui, '#npname', ''); // typed by the human: kept; emptied, it follows the first folder again
    await ui.locator('#npbrowsesource').click();
    await expect(ui.locator('#npname')).toHaveValue('gone');
  } finally { await core((k) => { k.electron.dialog.showOpenDialog = (globalThis as any).__open; }); }
  await expect(ui.locator('#npsources .item kbd')).toHaveText('git');
  await core((k) => { k.asked.length = 0; });
  await create('gone');
  expect(await core((k) => k.shell.current.folder)).toBe(goneDir);
  expect(git(goneDir, 'log', '--format=%s'), 'its history as it was').toBe('mine');
  expect(fs.readFileSync(path.join(goneDir, 'a.txt'), 'utf8')).toBe('a');
  expect(await core((k) => k.asked.length), 'its task in this window, nothing asked where').toBe(0);
  // The open one: closed, then deleted; the tab next to it shown.
  const goneData = path.join(files.userData, 'projects', files.pid('gone'));
  await removeRow('gone');
  await expect.poll(async () => (await projects()).includes('gone')).toBe(false);
  // Its grid taken down closes the window's dialogs, the manager too (lib/views.ts, closeLayers).
  if (await core((k) => !!k.shell.settings)) await closeSettings(core, ui, sui);
  await core((k) => { k.asked.length = 0; });
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded, files.project)).toBe(true);
  expect(await projectTabs(ui, files), 'the tab next to it shown').toEqual(['project', 'project *']);
  expect(fs.existsSync(goneDir) && !fs.existsSync(goneData)).toBe(true);
  await expect.poll(() => files.savedWindows()).toEqual([{ tabs: ['project/1', 'project/2'], shown: 'project/2' }]);

  // Folder on disk, several (a frontend and a backend): taken as they are, the first the default and the project's
  // folder; the one without git left so.
  const back = path.join(root, 'back');
  fs.mkdirSync(back); fs.writeFileSync(path.join(back, 'b.txt'), 'b');
  await newProject('folder');
  await add(goneDir);
  await add(back);
  await expect.poll(() => ui.locator('#npsources .item').evaluateAll((rs) => rs.map((r) => `${(r as HTMLElement).dataset.source} ${r.querySelector('kbd').textContent} ${!!r.querySelector('.default')}`).join()))
    .toBe(`${goneDir} git true,${back} no git false`);
  await create('gone');
  expect(await core((k, i) => k.shell.store.projects().find((x) => x.id === i).folders, files.pid('gone'))).toEqual([goneDir, back]);
  expect(fs.existsSync(path.join(back, '.git')), 'the one without git left so').toBe(false);
  expect(git(goneDir, 'log', '--format=%s'), 'the repository as it was').toBe('mine');
  await removeRow('gone');
  await expect.poll(async () => (await projects()).includes('gone')).toBe(false);

  // Clone from URL (a local one here): cloned into <location>/<name>, named after the repository, and that clone is
  // the project's folder: no empty one beside it, no git init. A folder with files there is refused.
  const bare = path.join(root, 'cloned.git'), backBare = path.join(root, 'back.git');
  git(back, 'init', '-q'); git(back, 'add', '-A'); git(back, 'commit', '-qm', 'back');
  git(root, 'clone', '-q', '--bare', goneDir, bare);
  git(root, 'clone', '-q', '--bare', back, backBare);
  await newProject('clone');
  await typeIn(ui, '#npsource', bare);
  await ui.locator('#npaddsource').click();
  await expect(ui.locator('#npname')).toHaveValue('cloned');
  const into = path.join(home, 'cloned');
  await expect(ui.locator('#npwhere')).toHaveText(`The repository will be cloned into ${into}`);
  await typeIn(ui, '#nplocation', root);
  await typeIn(ui, '#npname', 'gone');
  await expect(ui.locator('#npwhere')).toHaveText(`${goneDir} is there already: choose another name or location`);
  await typeIn(ui, '#nplocation', home);
  await typeIn(ui, '#npname', 'cloned');
  await create('cloned');
  expect(await core((k, i) => k.shell.store.projects().find((x) => x.id === i).folders, files.pid('cloned'))).toEqual([into]);
  expect(git(into, 'log', '--format=%s'), 'its history').toBe('mine');
  await removeRow('cloned');
  await expect.poll(async () => (await projects()).includes('cloned')).toBe(false);
  // Several: each repository cloned into a folder named after the project, the first the default; that folder is
  // none of the project's. A URL typed and not yet added counts.
  await newProject('clone');
  await typeIn(ui, '#npsource', bare);
  await ui.locator('#npaddsource').click();
  await typeIn(ui, '#npname', 'fullstack');
  await typeIn(ui, '#npsource', backBare);
  const stack = path.join(home, 'fullstack');
  await create('cloned'); // named by its first folder (data.ts, pid)
  const full = await core((k, i) => k.shell.store.projects().find((x) => x.id === i), files.pid('cloned'));
  expect([full.name, full.folders]).toEqual(['fullstack', [path.join(stack, 'cloned'), path.join(stack, 'back')]]);
  await removeRow('cloned');
  await expect.poll(async () => (await projects()).includes('cloned')).toBe(false);
  if (await core((k) => !!k.shell.settings)) await closeSettings(core, ui, sui);
  await core((k) => { k.asked.length = 0; });
  // A URL git cannot clone: git's own words, nothing left behind, the clones before it neither.
  expect((await invoke(ui, 'project:new', { from: 'clone', name: 'bad', location: root, urls: [bare, path.join(root, 'none.git')] })).error).toBeTruthy();
  expect(!fs.existsSync(path.join(root, 'bad')) && !(await projects()).includes('bad')).toBe(true);

  // Close All Tasks in its submenu: the last tasks, so the empty window; its tasks closed.
  await notLoading(ui);
  await projectMenu(ui, 'Close All Tasks', `#projectTabs [data-project="${files.pid('project')}"] .name`);
  await expect.poll(() => core((k) => k.shell.task === null && k.shell.open.size === 0)).toBe(true);
  await core((k) => { k.asked.length = 0; });
  await expect(ui.locator('html')).toHaveClass(/\bnoproject\b/);
  expect(await core((k, i) => k.shell.store.tasksOf({ id: i }).list.every((e) => e.closed), files.pid('project')), 'its tasks closed').toBe(true);

  // A closed task opened again from the board (the empty window), a tab at the end; another from the bar's + after.
  const first = files.tkey('project', 1);
  await ui.locator(`#board [data-task="${first}"]`).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && !!k.shell.task.loaded && !!k.shell.pty && !k.shell.windows[0].switching, first)).toBe(true);
  expect(await core((k) => !k.shell.task.entry.closed), 'open again').toBe(true);
  await notLoading(ui);
  await plusOpen(ui, 'project', 'Feature-X');
  await expect.poll(() => core((k) => k.shell.task?.name === 'Feature-X' && !!k.shell.task.loaded && !!k.shell.pty && !k.shell.windows[0].switching)).toBe(true);
  await ui.locator(`#projectTabs .tasktab[data-task="${first}"]`).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && !!k.shell.task.loaded && !k.shell.windows[0].switching, first)).toBe(true);
  expect(await projectTabs(ui, files), 'a tab each').toEqual(['project *', 'project']);
  expect(await taskTabs(ui)).toEqual(['task-1 *', 'Feature-X']);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('html')).not.toHaveClass(/\bnoproject\b/);
  await notLoading(ui);
  await expect.poll(async () => (await viewOn(core, ui, files, SAM)) && viewOn(core, ui, files, ELON)).toBe(true);
  await core((k, a) => { const acc = k.shell.accounts; acc.drop(a.account); acc.remove(a.dir); }, { account: made.account, dir: made.accountDir });
});

test("projects: another tab left in the background, with a terminal its agent ran something in: after a restart the open tasks are as they were left, the one in the background loads when shown, its terminals back in their tabs (its agent's conversation resumed, a shell with nothing running)", async ({ core, ui, call, files, restart }) => {
  await begin(core, ui, files);
  const other = path.join(files.root, 'other');
  await openFolder(core, ui, other);
  await call('terminal_run', { name: 'dev server', command: 'echo "served before"; sleep 60' });
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toMatch(/^served before$/m);
  await backTo(core, ui, files, 'project');
  expect(await projectTabs(ui, files)).toEqual(['project *', 'project', 'other']);

  const ui2 = await restart();
  await expect.poll(() => projectTabs(ui2, files)).toEqual(['project *', 'project', 'other']);
  expect(await core((k, id) => [...k.shell.open.get(id).tasks.values()][0].loaded, files.pid('other'))).toBe(false);
  await showProject(ui2, files, 'other');
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded, files.pid('other'))).toBe(true);
  const key = await core((k) => k.shell.task.key);
  const terminals = () => core((k, t) => k.shell.taskByKey(t).terminalsInfo().list.map(({ name, by, command, agent }) => ({ name, by, command, agent: agent?.account ?? null })), key);
  await expect.poll(terminals, { timeout: 10000 }).toEqual([{ name: 'bash', by: 'human', command: '', agent: 'custom' }, { name: 'dev server', by: 'agent', command: '', agent: null }]);
  await expect.poll(() => ui2.locator('.termtab').evaluateAll((ts) => ts.map((t) => t.querySelector('.title').textContent + (t.classList.contains('active') ? ' *' : ''))))
    .toEqual(['bash *', 'dev server']);
  await expect.poll(() => core((k, t) => { const task = k.shell.taskByKey(t), dev = task.terminal('dev server') as { pty?: unknown }; return !!dev.pty && !!task.promptTarget()?.pty; }, key)).toBe(true);
  expect(await core((k, t) => (k.shell.taskByKey(t).terminal('dev server') as { by: string }).by, key)).toBe('agent');
  await sleep(500); // nothing to wait for: that nothing runs
  expect((await call('terminal_read', { name: 'dev server' })).text, 'nothing runs there').not.toContain('served before');
});

test('projects: one left in a window of its own comes back after a restart where it was, with its project shown; saved smaller than the minimum, at the minimum', async ({ core, ui, files, restart }) => {
  await begin(core, ui, files);
  const third = path.join(files.root, 'third');
  await openFolder(core, ui, third);
  const key = files.tkey('third', 1);
  await invoke(ui, 'task:move', { key, terminals: {} });
  await expect.poll(() => core((k, t) => k.shell.windows[1]?.current?.key === t && !k.shell.windows[1].switching, key)).toBe(true);
  // Smaller than the window's minimum (setBounds passes below it, the human's drag does not): it comes back at it.
  await core((k) => k.shell.windows[1].win.setBounds({ x: 40, y: 50, width: 10, height: 10 }));
  await backTo(core, ui, files, 'project');
  expect(await projectTabs(ui, files)).toEqual(['project *', 'project']);

  const ui2 = await restart();
  await expect.poll(() => core((k, id) => k.shell.windows.length === 2 && k.shell.windows[1].current?.project.id === id && !!k.shell.windows[1].task?.loaded, files.pid('third'))).toBe(true);
  expect(await core((k) => k.shell.windows[1].tabs.map((t) => t.key))).toEqual([key]);
  expect(await core((k) => { const { width, height } = k.shell.windows[1].win.getNormalBounds(); return { width, height }; })).toEqual({ width: 640, height: 400 });
  expect(await core((k) => k.shell.windows[1].win.getMinimumSize())).toEqual([640, 400]);
  // Its page: the second window's (ui is the first's).
  const second = await pageWith(ui2, `#projectTabs .tasktab[data-task="${key}"]`);
  await expect.poll(() => projectTabs(second, files)).toEqual(['third *']);
});

test("projects: Settings, not modal, acts for the tasks' window last in front; its lists follow the profiles the agent makes and lets go meanwhile", async ({ core, ui, sui, call, files }) => {
  await begin(core, ui, files);
  // A second tasks' window, with a project of its own.
  const fourth = path.join(files.root, 'fourth');
  await openFolder(core, ui, fourth);
  const key = files.tkey('fourth', 1);
  await invoke(ui, 'task:move', { key, terminals: {} });
  await expect.poll(() => core((k, t) => k.shell.windows[1]?.current?.key === t && !k.shell.windows[1].switching && !!k.shell.windows[1].task?.loaded, key)).toBe(true);
  await backTo(core, ui, files, 'project');
  const there = await otherPage(ui);
  await notLoading(there);
  // Opened from the second window: at its shown task's project.
  await expect.poll(async () => (await there.evaluate(() => document.hasFocus())) || (await core((k) => k.focus(k.shell.windows[1].win)), false)).toBe(true);
  await there.evaluate(() => (window as any).kulisa.send('settings:open', { section: 'projects', id: null }));
  const s = await sui();
  await pageOf(s, 'fourth');
  // Made and let go by that task's agent (asked in its window): the project's page shows it, then not.
  await call('profile_create', { name: 'Fay' }, { task: key });
  const fay = files.idOf('Fay');
  await expect(s.locator(`#npprofiles [data-profile="${fay}"]`)).toHaveCount(1);
  await expect(s.locator(`#pjlist [data-profile="${fay}"]`)).toHaveCount(1);
  await call('profile_delete', { profile: 'Fay' }, { task: key });
  expect((await asked(core)).message).toBe('The agent asks to remove the profile Fay from fourth.');
  await expect(s.locator(`#npprofiles [data-profile="${fay}"]`)).toHaveCount(0);
  await core((k, f) => { k.shell.profileStore.delete(f); }, fay); // not needed after
  // The first one in front (the question's dialog in the second gone first): Settings acts for it now, without being
  // opened again.
  await expect.poll(() => there.evaluate(() => document.getElementById('ask')?.dataset.state !== 'open')).toBe(true);
  await focusWindow(core, ui);
  await expect.poll(async () => (await invoke(s, 'projects:list')).project).toBe(files.pid('project'));
  await closeSettings(core, ui, sui);
  // The second window and its project gone, for a test after it.
  await invoke(ui, 'project:close-tasks', { id: files.pid('fourth') });
  await expect.poll(() => core((k) => k.shell.windows.length)).toBe(1);
  await forget(core, ui, files, 'fourth');
});
