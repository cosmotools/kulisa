// Projects (docs/tasks.md, Projects; docs/window.md, Settings): Project Settings… and Settings' window.
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import { attr, menu, choose, closeMenu, rightClick, projectTabs, projectTab, projectTabSel, showProject, focusWindow, closeSettings, settingsClosed, invoke, act, typeIn, answer, notLoading, projectMenu, otherPage, pageOf, onRow, removed } from './helpers.ts';
import { SAM, begin, newTask, openFolder, projectShown } from './tasks-helpers.ts';
import { fakeAgent } from './agent-helpers.ts';

// A project the window has no task of shown again as the human does it (its tab), once it is.
async function backTo(core: Core, ui: Page, files: Files, folder: string) {
  await showProject(ui, files, folder);
  await projectShown(core, files.pid(folder));
  await notLoading(ui);
}
// A new profile on a project's page: + → New Profile…, its name typed in place, Create.
async function newProfileHere(s: Page, name: string) {
  await s.locator('#npprofileadd').click();
  await choose(s, 'New Profile…');
  await expect(s.locator('#npnewprofile')).toBeFocused();
  await s.locator('#npnewprofile').fill(name);
  await s.locator('#npprofilenew').click();
}
// A project deleted as Settings does (its data and tasks' copies; Delete Project… is tested below), its folder too.
async function forget(core: Core, ui: Page, files: Files, folder: string, dir = path.join(files.root, folder)) {
  const id = await core((k, f) => k.shell.store.projects().find((p) => p.folders.some((x) => path.basename(x).toLowerCase() === f))?.id, folder).catch((): undefined => undefined);
  if (id) {
    const deleted = invoke(ui, 'project:delete', { id });
    await answer(ui);
    await deleted;
  }
  await removed(dir);
}

test("projects: the projects' manager (Project Settings…) changes its name and agents, the default one + runs, none the default: a new task starts nothing, the island's buttons instead; a folder with a favicon gets it as its icon, and its hue as its color", async ({ core, ui, sui, call, files }) => {
  test.slow(); // three tasks started, Settings opened six times
  await fakeAgent(ui, files);
  await begin(core, ui, files, { featureX: true });
  const site = path.join(files.root, 'site');
  fs.mkdirSync(path.join(site, 'public'), { recursive: true });
  fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="red"/></svg>');
  await openFolder(core, ui, site);
  const id = files.pid('site'), tab = projectTabSel(files, 'site');
  await expect(projectTab(ui, files, 'site').getByTestId('project-icon')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  // Its color: its favicon's hue (red: 29°; a few degrees off where its edges blend) in the lightness and chroma of
  // Kulisa's own colors; the window's and its island's. What projects.json keeps (the next free color) is for a
  // project with none.
  const shown = async (hue: number | string) => {
    const color = typeof hue === 'string' ? hue : new RegExp(`^oklch\\(0\\.61 0\\.12 (${Array.from({ length: 9 }, (_, i) => hue - 4 + i).join('|')})\\)$`);
    await expect(ui.locator(':root')).toHaveCSS('--project', color);
    await expect(ui.locator(tab).first()).toHaveCSS('--color', color);
  };
  await shown(29);
  // Its settings: its favicon in the list, the folder shown and not changed.
  await choose(ui, 'Project Settings…', await projectMenu(ui, tab));
  let s = await sui();
  await pageOf(s, 'site');
  // The manager lists every project, this one chosen.
  await expect(s.locator(`#pjlist [data-project="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(s.locator(`#pjlist [data-project="${id}"] [data-testid="project-icon"]`), 'its favicon, a picture').toHaveJSProperty('tagName', 'IMG');
  await expect(s.locator('#npfolders [data-folder] small'), 'its folder, as its code').toHaveText(site);
  await expect(s.locator('#nplocationrow')).toHaveCount(0);
  // A page: its top (New Task, ⋯), each part saved as it changes; the dialog stays open.
  await expect(s.locator('#pjconfig :is(h3, label[for])')).toHaveText(['Name:', 'Folders', 'Agents', 'Profiles', 'Local addresses:']);
  const entryOf = () => core((k, i) => k.shell.store.projects().find((p) => p.id === i), id);
  // Its favicon changed: read again as its settings open. Mostly blue with a red dot: the hue of the most (264°).
  const favicon = (svg: string) => fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${svg}</svg>`);
  const reopen = async () => {
    await closeSettings(core, ui, sui);
    await choose(ui, 'Project Settings…', await projectMenu(ui, tab));
    s = await sui();
    await pageOf(s, 'site');
  };
  favicon('<rect width="16" height="16" fill="#00f"/><circle cx="8" cy="8" r="2" fill="red"/>');
  await reopen();
  await shown(264);
  // A black mark (GitHub's, an SVG in currentColor) has no hue: the color it was given.
  favicon('<path d="M2 2h12v12H2z" fill="#000"/>');
  await reopen();
  const given = (await entryOf()).color;
  await shown(given);
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
  const renames = files.log().match(new RegExp(`\\[project\\] ${id} renamed: .*`, 'g'));
  expect(renames).toEqual([`[project] ${id} renamed: Site-2`]);
  expect(entry.local, "its own local addresses, where test users' pairs may be typed (local.ts)").toEqual(['abc.ngrok.app', 'shop.dev']);
  await expect.poll(async () => (await projectTabs(ui, files)).includes('site *') && await core((k) => k.shell.win.getTitle() === `${k.shell.task.name} · Site-2 — Kulisa`)).toBe(true);
  // Its profiles: a new one; one of another project, the same person (its master, its sign-ins); × lets go of one.
  await choose(ui, 'Project Settings…', await projectMenu(ui, tab));
  s = await sui();
  await expect(s.locator('#npprofilesrow')).toBeVisible();
  await expect(s.locator('#npprofiles [role="option"]')).toHaveCount(0);
  await newProfileHere(s, 'Site-user');
  await expect.poll(() => { try { return !!files.idOf('Site-user'); } catch { return false; } }).toBe(true);
  const siteUser = files.idOf('Site-user'), samId = files.idOf(SAM);
  await expect(s.locator(`#npprofiles [data-profile="${siteUser}"]`)).toBeVisible();
  await s.locator('#npprofileadd').click();
  await expect(menu(s)).toMatchAriaSnapshot(`
    - /children: contain
    - text: Other Profiles
    - menuitem "Sam.admin"
  `);
  await choose(s, 'Sam.admin');
  await expect(s.locator(`#npprofiles [data-profile="${samId}"] > *`)).toHaveText(['Sam.admin', 'seller in the test shop', 'project']);
  await expect.poll(() => core((k, a) => k.shell.closed.has(a.sam) && k.shell.closed.has(a.user), { sam: samId, user: siteUser })).toBe(true); // its task lists them, closed
  await onRow(s, `#npprofiles [data-profile="${siteUser}"]`, '#npprofiledel');
  expect((await answer(s)).message).toBe('Remove the profile Site-user from Site-2?');
  await expect.poll(() => core((k, u) => !k.shell.closed.has(u), siteUser)).toBe(true);
  expect(await core((k, u) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(u)), siteUser), 'in no other project: kept all the same, until deleted in Settings → Profiles').toEqual([]);
  await core((k, u) => { k.shell.profileStore.delete(u); }, siteUser); // not needed after
  await closeSettings(core, ui, sui);
  // Opened in this task: a copy of its master, here.
  await act(ui, 'profile:open', { profile: samId });
  await expect.poll(() => core((k, sam) => k.shell.profiles.has(sam), samId)).toBe(true);
  expect(await core((k, sam) => k.shell.profiles.get(sam).dir, samId)).toBe(path.join(files.userData, 'projects', id, files.tid('site', 1), samId));
  // Let go here: it stays in project, with its master.
  const dropped = act(ui, 'profile:delete', { profile: samId });
  expect((await answer(ui)).message).toBe('Remove the profile Sam.admin from Site-2?');
  await dropped;
  await expect.poll(() => core((k, sam) => !k.shell.profiles.has(sam), samId)).toBe(true);
  expect(await core((k, sam) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(sam)), samId)).toEqual([files.pid('project')]);
  // Its agents: a list, added from the agents without accounts and the accounts in the store (one made in Settings →
  // Agents, in no project), one the default (a radio); at once, not on Save.
  const ann = await core((k) => { const a = k.shell.accounts; return a.create((a.prepare('fake') as { id: string }).id, 'fake', 'ann@shop.com').id; });
  await choose(ui, 'Project Settings…', await projectMenu(ui, tab));
  s = await sui();
  await expect(s.locator('#npagentsrow')).toBeVisible();
  await s.locator('#npagentadd').click();
  await expect(menu(s)).toBeVisible();
  await expect(menu(s).getByRole('menuitem', { name: 'Fake agent', exact: true }), 'an agent with accounts: one of its accounts').toHaveCount(0);
  await closeMenu(s);
  for (const name of ['Terminal only', 'Fake agent · ann@shop.com']) {
    await s.locator('#npagentadd').click();
    await choose(s, name);
    await expect(s.locator(`#npagents [role="option"]${attr('title', name)}`)).toHaveCount(1);
  }
  // The default marked, Make Default on the others. Each row by its title, and whether it is the default.
  const agentRows = async (rows: [string, boolean][]) => {
    const options = s.locator('#npagents [role="option"]');
    await expect(options).toHaveCount(rows.length);
    for (const [i, [title, isDefault]] of rows.entries()) {
      await expect(options.nth(i)).toHaveAttribute('title', title);
      await expect(options.nth(i).locator('kbd').getByText('default', { exact: true })).toHaveCount(isDefault ? 1 : 0);
    }
  };
  await agentRows([['Terminal only', true], ['Fake agent · ann@shop.com', false]]); // the first added, the default
  // A table: each value in its column, under its name, the columns at the same places in every row (values
  // one after another, each row in its own rhythm, read as chaos).
  await expect(s.locator('#npagentsrow div[aria-hidden="true"] > *')).toHaveText(['Agent', 'Account', '']);
  // Every cell's left edge in every row at once (boundingBox reads one element at a time).
  expect(await s.locator('#npagentsrow').evaluate((t) => {
    const x = (e: Element) => Math.round(e.getBoundingClientRect().left);
    const rows = [t.querySelector('div[aria-hidden="true"]'), ...t.querySelectorAll('[role="option"]')].map((r) => [...r.children].map(x).join());
    return rows.every((r) => r === rows[0]);
  }), 'the columns in line').toBe(true);
  expect((await entryOf()).agents).toEqual(['shell', ann]);
  expect(await core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), ann), 'the projects list their agents').toEqual([id]);
  await onRow(s, `#npagents [data-agent="${ann}"]`, '#npagentdefault');
  await agentRows([['Fake agent · ann@shop.com', true], ['Terminal only', false]]);
  // Its right-click has the same: Make Default.
  // The row not chosen yet: Reka's list takes the keyboard to it just after the menu opens, which would close the
  // menu (RightClickMenu.vue).
  await rightClick(s, '#npagents [data-agent="shell"]');
  await expect(menu(s)).toMatchAriaSnapshot(`
    - menuitem "Make Default"
    - menuitem "Remove from the Project"
  `);
  await choose(s, 'Make Default');
  await agentRows([['Terminal only', true], ['Fake agent · ann@shop.com', false]]);
  // None the default: No Default on the default one's right-click, or its ★; ★ on it again makes it the default.
  await rightClick(s, '#npagents [data-agent="shell"]');
  await expect(menu(s)).toMatchAriaSnapshot(`
    - menuitem "No Default"
    - menuitem "Remove from the Project"
  `);
  await choose(s, 'No Default');
  await agentRows([['Terminal only', false], ['Fake agent · ann@shop.com', false]]);
  expect((await entryOf()).noDefaultAgent).toBe(true);
  await onRow(s, '#npagents [data-agent="shell"]', '#npagentdefault');
  await agentRows([['Terminal only', true], ['Fake agent · ann@shop.com', false]]);
  expect((await entryOf()).noDefaultAgent).toBeUndefined();
  await onRow(s, '#npagents [data-agent="shell"]', '#npagentdefault');
  await agentRows([['Terminal only', false], ['Fake agent · ann@shop.com', false]]);
  await onRow(s, '#npagents [data-agent="shell"]', '#npagentdefault');
  await agentRows([['Terminal only', true], ['Fake agent · ann@shop.com', false]]);
  await closeSettings(core, ui, sui);
  // + makes a task with the default one (the first kept the one it started with). No git: a second task in the folder,
  // after the question.
  const agentOf = (key: string) => files.json('projects', key.replace('/', path.sep), 'agent.json').agent;
  const before = await newTask(core, ui, id);
  expect(agentOf(before)).toBe('shell');
  // Another agent: made the default on the project's page (Make Default), + runs it.
  await invoke(ui, 'project:agent-default', { id, agent: ann });
  const annTask = await newTask(core, ui, id);
  await expect.poll(() => core((k) => k.shell.task.promptTarget()?.agent.id)).toBe(ann);
  expect(await core((k) => k.shell.task.profiles.size), 'no profile opens by itself').toBe(0);
  // None the default: a new task starts nothing, the island's buttons instead; Ctrl+` there gives them the keyboard.
  await invoke(ui, 'project:agent-default', { id, agent: null });
  const made = invoke(ui, 'task:new', { project: id });
  await answer(ui, 'Create Anyway');
  await made;
  // Shown, not only loaded: a key while the window still switches acts for the task before (docs/testing.md; on a
  // loaded machine Ctrl+` below may do nothing).
  await expect.poll(() => core((k, a) => k.shell.task.key !== a && k.settled(), annTask)).toBe(true);
  await notLoading(ui);
  const bare = await core((k) => k.shell.task.key);
  await expect(ui.getByRole('navigation', { name: 'New terminal' })).toMatchAriaSnapshot(`
    - navigation "New terminal":
      - button "Fake agent"
      - button "Terminal"
  `);
  // A project with no profiles: one tile, Add Profile…, its page in Settings.
  const launchProfiles = ui.locator('#dock').getByRole('navigation', { name: 'Open a profile' });
  await expect(launchProfiles.getByRole('button')).toHaveText(['Add Profile…']);
  await launchProfiles.getByRole('button').click();
  s = await sui();
  await expect(s.locator(`#pjlist [data-project="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await closeSettings(core, ui, sui);
  const terminals = () => core((k, key) => k.shell.taskByKey(key).terminals.size, bare);
  expect(await terminals()).toBe(0);
  expect(agentOf(bare)).toBe(null);
  if (await ui.locator(':focus').count()) await ui.locator(':focus').blur();
  await focusWindow(core, ui);
  // Ctrl+` gives the launcher the keyboard. Opens nothing: no agent.
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  await expect(ui.getByRole('navigation', { name: 'New terminal' }).getByRole('button').first()).toBeFocused();
  expect(await terminals(), 'nothing opened').toBe(0);
  // With a profile open, the island is a strip: Ctrl+` opens its +.
  await call('profile_create', { name: 'Bo.bare' }, { task: bare });
  await expect(ui.locator('#termUnfold')).toHaveCount(1);
  await expect(ui.getByRole('navigation', { name: 'New terminal' })).toHaveCount(0);
  await focusWindow(core, ui);
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menuitem "Fake agent · ann@shop.com"
    - separator
    - menuitem "Terminal"
  `);
  await closeMenu(ui);
  expect(await terminals(), 'nothing opened').toBe(0);
  const bo = files.idOf('Bo.bare');
  const droppedBo = act(ui, 'profile:delete', { profile: bo });
  await answer(ui);
  await droppedBo;
  await expect.poll(() => core((k, a) => !k.shell.taskByKey(a.key).profiles.has(a.bo), { key: bare, bo })).toBe(true);
  await core((k, b) => { k.shell.profileStore.delete(b); }, bo);
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
  await begin(core, ui, files, { featureX: true });
  // A project with no task open.
  const closed = path.join(files.root, 'closed');
  fs.mkdirSync(closed, { recursive: true });
  const closedId = await core((k, f) => { const p = k.shell.store.projectFor(f); k.shell.sendProjects(); return p.id; }, closed);
  // Shown once it is filled (its tree's three sections, the agents found, the project's page): as it came, it jumped.
  await core((k) => {
    const g = k.stash;
    g.filled = null;
    k.electron.app.once('browser-window-created', (_e, w) => w.once('show', () => {
      void w.webContents.executeJavaScript(`[document.querySelectorAll('#pjlist [data-agent]').length > 0, document.querySelectorAll('#pjlist [data-profile]').length > 0, !!document.getElementById('pjhead')]`)
        .then((r) => { g.filled = r; });
    }));
  });
  await ui.locator('#manageProjects').click();
  await expect.poll(() => core((k) => k.stash.filled)).toEqual([true, true, true]);
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
  await onRow(s, `#npprofiles [data-profile="${closedOne}"]`, '#npprofiledel');
  await expect(s.getByRole('alertdialog')).toBeVisible();
  await expect(ui.getByRole('alertdialog'), "not in the task's window").toHaveCount(0);
  expect((await answer(s)).message).toBe('Remove the profile Closed-one from closed?');
  await expect.poll(() => core((k, p) => !k.shell.store.projectsWith('profiles', p).length, closedOne)).toBe(true);
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
  const said = invoke(ui, 'profile:delete', { task: await core((k) => k.shell.task.key), profile: files.idOf(SAM) });
  await expect(ui.getByRole('alertdialog')).toBeVisible();
  await expect(s.getByRole('alertdialog'), "not in Settings' window").toHaveCount(0);
  // Waited for: macOS restores a minimized window with its animation, and makes it key at its end.
  await expect.poll(() => core((k) => !k.shell.win.isMinimized() && k.shell.win.isFocused()), { message: 'the task\'s window in front with its question' }).toBe(true);
  expect((await answer(ui, false)).message).toMatch(/^Remove the profile Sam\.admin from /);
  expect(await said).toEqual({ error: 'the human said no' });
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

test("projects: Settings, not modal, acts for the tasks' window last in front; its lists follow the profiles the agent makes and lets go meanwhile", async ({ core, ui, sui, call, files }) => {
  await begin(core, ui, files, { featureX: true });
  // A second tasks' window, with a project of its own.
  const fourth = path.join(files.root, 'fourth');
  await openFolder(core, ui, fourth);
  const key = files.tkey('fourth', 1);
  await invoke(ui, 'task:move', { key, terminals: {} });
  await expect.poll(() => core((k, t) => k.shell.windows[1]?.current?.key === t && k.settled(false, k.shell.windows[1]), key)).toBe(true);
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
  const dropping = call('profile_delete', { profile: 'Fay' }, { task: key });
  expect((await answer(there)).message).toBe('The agent asks to remove the profile Fay from fourth.');
  await dropping;
  await expect(s.locator(`#npprofiles [data-profile="${fay}"]`)).toHaveCount(0);
  await core((k, f) => { k.shell.profileStore.delete(f); }, fay); // not needed after
  // The first one in front (the question's dialog in the second gone first: answer): Settings acts for it now, without
  // being opened again.
  await focusWindow(core, ui);
  await expect.poll(async () => (await invoke(s, 'projects:list')).project).toBe(files.pid('project'));
  await closeSettings(core, ui, sui);
  // The second window and its project gone, for a test after it.
  await invoke(ui, 'project:close-tasks', { id: files.pid('fourth') });
  await expect.poll(() => core((k) => k.shell.windows.length)).toBe(1);
  await forget(core, ui, files, 'fourth');
});
