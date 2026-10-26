// Several projects and windows: a tab per task in the bar, Move to New Window, tabs dragged (docs/window.md, The tasks'
// bar; docs/tasks.md, Windows).
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { data } from './data.ts';
import { SITE, MAC, sleep, submenu, menuRows, choose, rightClick, projectTabs, showProject, closeProject, plusMenu, plusRows, closeBoard, viewOn, who, termText } from './helpers.ts';

type Files = ReturnType<typeof data>;

const SAM = 'Sam.admin', ELON = 'Elon.buyer';

// Another tasks' window's page than ui, once Playwright has it.
async function otherPage(kulisa: { context: BrowserContext }, ui: Page) {
  const find = () => kulisa.context.pages().find((p) => p !== ui && !p.isClosed() && p.url().includes('/index.html'));
  await expect.poll(() => !!find()).toBe(true);
  return find();
}
const notLoading = (page: Page) => expect(page.locator('html')).not.toHaveClass(/\bloading\b/);
const bothOn = (core: Core, ui: Page, files: Files) => expect.poll(async () => (await viewOn(core, ui, files, SAM)) && viewOn(core, ui, files, ELON)).toBe(true);
// A question asked, and answered in its dialog (driver.ts, answer).
const answered = (core: Core, page: Page) => expect.poll(async () => (await core((k) => k.asked.length)) > 0
  && page.evaluate(() => document.getElementById('ask')?.dataset.state !== 'open')).toBe(true);

// The task shown as the tasks' tests know it: named task-1, Sam signed in and Elon signed out side by side (Columns),
// the agent's output watched. Made through the core (test/setup.ts's state; making and signing in are tested elsewhere).
async function begin(core: Core, ui: Page, files: Files) {
  await core(async (k) => {
    const task = k.shell.task, has = (n: string) => [...k.shell.profiles.values()].some((p) => p.name === n);
    if (task.name !== 'task-1') await task.rename('task-1');
    if (!has('Sam.admin')) await task.createProfile('Sam.admin', 'seller in the test shop', 'fox');
    if (!has('Elon.buyer')) await task.createProfile('Elon.buyer', '', 'owl');
    k.watchPty(k.shell.pty);
  });
  await expect(ui.locator('.ptab[data-panel^="profile:"]')).toHaveCount(2); // a pane stacked behind another has no .pane drawn
  await notLoading(ui);
  await ui.evaluate(() => (window as any).__layoutPreset('columns'));
  await core(async (k, site) => {
    await k.ensureProfile('Sam.admin', `${site}/app/login?name=sam`);
    await k.ensureProfile('Elon.buyer', `${site}/app`);
  }, SITE);
  await bothOn(core, ui, files);
}

// The second project, a folder 'other' with a task 1 that has Sam.seller: made if there is none, closed.
const otherFolder = (files: Files) => path.join(files.root, 'other');
const hasOther = (files: Files) => JSON.parse(fs.readFileSync(path.join(files.userData, 'projects.json'), 'utf8')).list
  .some((p: { folders: string[] }) => p.folders.some((f) => path.basename(f).toLowerCase() === 'other'));
async function makeOther(core: Core, ui: Page, files: Files) {
  if (hasOther(files)) return;
  const other = otherFolder(files);
  fs.mkdirSync(other, { recursive: true });
  await ui.evaluate((f) => (window as any).kulisa.invoke('project:open', { folder: f }), other);
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded && !!k.shell.pty && !k.shell.windows[0].switching, other)).toBe(true);
  await core((k) => k.shell.task.createProfile('Sam.seller'));
  await expect(ui.locator('.pane')).toHaveCount(1);
  await closeProject(ui, files, 'other');
  await expect.poll(() => core((k, a) => !k.shell.open.has(a.other) && k.shell.current?.id === a.project && !k.shell.windows[0].switching,
    { other: files.pid('other'), project: files.pid('project') })).toBe(true);
  await notLoading(ui);
}
// The second project gone, with its Sam.seller, as Settings deletes them: for a test that opens it first.
async function forgetOther(core: Core, ui: Page, files: Files) {
  if (hasOther(files)) await ui.evaluate((id) => (window as any).kulisa.invoke('project:delete', { id }), files.pid('other'));
  const seller = JSON.parse(fs.readFileSync(path.join(files.userData, 'profiles.json'), 'utf8')).list.find((p: { name: string }) => p.name === 'Sam.seller');
  if (seller) await ui.evaluate((id) => (window as any).kulisa.invoke('profiles:delete', { profile: id }), seller.id);
  await core((k) => { k.asked.length = 0; });
}
// A project's tab in the bar, as a selector for a script in the page.
const tabSel = (files: Files, folder: string) => `#projectTabs .tasktab[data-project="${files.pid(folder)}"]`;

test('projects: another folder opens in a tab of its own, with its own profiles and agent; the first keeps running', async ({ core, ui, call, files }) => {
  await begin(core, ui, files);
  await forgetOther(core, ui, files);
  // The agent reported its session (its SessionStart hook, as Claude Code sends it): Kulisa resumes it when the project
  // opens again.
  if (JSON.parse(fs.readFileSync(files.pfile('agent.json'), 'utf8')).conversations?.[0]?.sessionId !== 'session-1') {
    const transcript = path.join(files.project, 'transcript.jsonl');
    fs.writeFileSync(transcript, '');
    const hooks = await core((k) => k.hooksOf());
    await new Promise((resolve) => http.request(`${hooks}/session-start`, { method: 'POST' }, (res) => { res.resume(); res.on('end', resolve); })
      .end(JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' })));
    await expect.poll(() => JSON.parse(fs.readFileSync(files.pfile('agent.json'), 'utf8')).conversations[0].sessionId).toBe('session-1');
  }
  const other = otherFolder(files), project = files.project;
  fs.mkdirSync(other, { recursive: true });
  const ids = { sam: files.idOf(SAM), elon: files.idOf(ELON), project: files.pid('project') };
  await core((k, id) => { (globalThis as any).__grid = { firstPty: k.shell.pty, sam: k.shell.profiles.get(id) }; }, ids.sam);
  await ui.evaluate((f) => (window as any).kulisa.invoke('project:open', { folder: f }), other);
  await expect.poll(() => core((k, f) => { const g = (globalThis as any).__grid; return k.shell.current?.folder === f && !!k.shell.pty && k.shell.pty !== g.firstPty; }, other)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect.poll(() => termText(ui)).toContain(`agent: rc of ${other}`); // started by the shell, in the project
  expect((await termText(ui)).split('exec cat -v').length - 1, 'the command that starts the agent shows once').toBe(1);
  expect(await core((k, project) => {
    const g = (globalThis as any).__grid;
    return { profiles: k.shell.profiles.size, kept: g.sam.tabs.every((t: any) => !t.wc.isDestroyed()) && !g.sam.get().view.getVisible(),
      agent: [...k.shell.open.get(project).tasks.values()][0].pty === g.firstPty, title: k.shell.win.getTitle(), resumed: k.shell.resumedSession };
  }, ids.project)).toEqual({ profiles: 0, kept: true, agent: true, title: 'New Task · other — Kulisa', resumed: null }); // the first project's pages keep running, hidden, and its agent; a new project has no conversation to resume
  await expect.poll(async () => JSON.stringify(await projectTabs(ui, files)) === '["project","other *"]' && ui.evaluate(() => !!(window as any).__dock.getPanel('terminal'))).toBe(true);
  await expect(ui.locator('.pane')).toHaveCount(0);
  // A tab per task, its project's icon on it, its name in its tooltip.
  expect(await ui.locator('#projectTabs .tasktab').evaluateAll((ts) => ts.map((g) => [g.querySelector('.picon use')?.getAttribute('href'), g.querySelector('.name').textContent, (g as HTMLElement).title.split('\n')[0]])))
    .toEqual([['#i-logo', 'task-1', 'project'], ['#i-logo', 'New Task', 'other']]);
  // Every island keeps its place and width whichever task is shown, also while it switches: nothing jumps.
  const islands = () => ui.locator('#projectTabs .tasktab').evaluateAll((ts) => ts.map((t) => { const r = t.getBoundingClientRect(); return [r.x, r.width]; }));
  const before = await islands();
  await ui.evaluate(() => {
    const w = window as any;
    w.__islands = new Set();
    const tick = () => {
      if (!w.__islands) return;
      w.__islands.add(JSON.stringify([...document.querySelectorAll('#projectTabs .tasktab')].map((t) => { const r = t.getBoundingClientRect(); return [r.x, r.width]; })));
      requestAnimationFrame(tick);
    };
    tick();
  });
  await core(async (k) => { await k.shell.task.createProfile('Sam.seller'); (globalThis as any).__grid.seller = k.profile('Sam.seller'); }); // the same name as in the first project (the agent's profile_create)
  const seller = await core((k) => { const s = k.profile('Sam.seller'); return { id: s.id, dir: s.dir, endpoint: s.endpoint }; });
  // A copy in the task's data, named as its master in the store of profiles.
  expect(seller.dir, "a task's copy is in its task's data").toBe(path.join(files.userData, 'projects', files.pid('other'), files.tid('other', 1), files.idOf('Sam.seller')));
  expect(fs.existsSync(path.join(files.userData, 'profiles', files.idOf('Sam.seller'))), 'its master').toBe(true);
  expect(seller.endpoint.endsWith(`/${files.tkey('other', 1)}/${seller.id}`), 'the CDP proxy knows it by its project too').toBe(true);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  expect(await who(call, 'Sam.seller'), "the first project's sign-ins stay there").toBe('Signed out');

  // The bar's + (NewTask.vue): a dropdown menu — every project (a submenu each when several are open), New Project…
  // last; a project's submenu lists its tasks (an open one shown, not to choose) and New Task.
  expect([...await plusMenu(ui) as string[]].sort()).toEqual(['New Project…', 'other', 'project']);
  expect(await plusRows(ui, 'project')).toEqual(['task-1', 'New Task']);
  // Ctrl+Shift+A opens the + menu from anywhere; again closes it.
  const anyMenu = ui.locator('.menu[data-state="open"]');
  await core((k) => k.press(k.shell.win.webContents, 'A', k.CMD, 'shift'));
  await expect(anyMenu.first()).toBeVisible();
  await core((k) => k.press(k.shell.win.webContents, 'A', k.CMD, 'shift'));
  await expect(anyMenu).toHaveCount(0);
  await ui.evaluate(() => (window as any).__islands.clear()); // a new tab is a tab more in the bar, as a task's: watched from here on
  await showProject(ui, files, 'other');
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !k.shell.windows[0].switching, other)).toBe(true);
  // The tab's right-click: the task's rows, then its project's in a submenu of its name (the project has no tab of
  // its own).
  await rightClick(ui, `${tabSel(files, 'other')} .name`);
  expect(await menuRows(ui)).toEqual(['# Profiles', 'Sam.seller', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'other']);
  await choose(ui, 'other');
  await expect(anyMenu).toHaveCount(2);
  expect(await menuRows(ui, submenu(ui))).toEqual(['New Task', '-', 'Move All Tasks to New Window', '-', 'Project Settings…', 'Show Data Folder', '-', 'Close All Tasks']);
  // Show Data Folder: Kulisa's folder of that project, in the file manager.
  await core((k) => {
    const g = (globalThis as any).__grid, e = k.electron;
    g.openPath = e.shell.openPath; g.shown = [];
    e.shell.openPath = async (dir: string) => { g.shown.push(dir); return ''; };
  });
  try {
    await choose(ui, 'Show Data Folder', submenu(ui));
    await expect.poll(() => core(() => (globalThis as any).__grid.shown.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = (globalThis as any).__grid.openPath; }); }
  expect(await core(() => (globalThis as any).__grid.shown)).toEqual([path.join(files.userData, 'projects', files.pid('other'))]);
  expect(await ui.evaluate(() => [...(window as any).__islands]), 'the islands keep their places while another project opens').toEqual([JSON.stringify(before)]);
  await ui.evaluate(() => (window as any).__islands.clear());
  // A click on the first project's task: it comes back as it was left, its agent the same; no page shows before
  // it has its place in the grid (nothing jumps).
  await core((k) => {
    const g = (globalThis as any).__grid;
    g.jumps = [];
    g.watch = setInterval(() => {
      for (const p of k.shell.profiles.values()) {
        const v = p.get()?.view;
        if (v && !v.webContents.isDestroyed() && v.getVisible() && !v.getBounds().width) g.jumps.push(p.id);
      }
    }, 5);
  });
  await showProject(ui, files, 'project');
  await expect.poll(() => core((k, a) => k.shell.current?.folder === a.project && k.shell.profiles.get(a.sam) === (globalThis as any).__grid.sam, { project, sam: ids.sam })).toBe(true);
  await notLoading(ui);
  await bothOn(core, ui, files);
  expect(await core((k) => {
    const g = (globalThis as any).__grid;
    clearInterval(g.watch);
    return { jumps: g.jumps, agent: k.shell.pty === g.firstPty, seller: g.seller.get().view.getVisible() };
  })).toEqual({ jumps: [], agent: true, seller: false }); // pages shown before the grid placed them; the same agent; the other project's pages hidden
  expect(await projectTabs(ui, files)).toEqual(['project *', 'other']);
  const seen = await ui.evaluate(() => { const w = window as any, s = [...w.__islands]; w.__islands = null; return s; });
  expect(seen, 'the islands keep their places, also while switching').toEqual([JSON.stringify(before)]);

  // Closing the task (the middle button on its tab) asks first when an agent works; Cancel keeps it open.
  await core((k) => { k.asked.length = 0; k.answer = false; const g = (globalThis as any).__grid; g.working = k.shell.task; g.working.promptTarget().state = 'working'; });
  await closeProject(ui, files, 'project');
  await answered(core, ui);
  expect(await core((k) => k.asked.pop().message)).toBe('Close the task task-1?');
  expect(await core((k, a) => k.shell.open.has(a.id) && k.shell.current?.folder === a.project, { id: ids.project, project }), 'still open when the human says no').toBe(true);
  await core((k) => { k.answer = true; (globalThis as any).__grid.working.promptTarget().state = null; });
  // Close: no agent works, no question; the task closes (tabs and sign-ins kept), the project let go, the tab next to
  // it shown.
  await closeProject(ui, files, 'project');
  await expect.poll(() => core((k, a) => k.shell.current?.folder === a.other && !k.shell.open.has(a.id), { other, id: ids.project })).toBe(true);
  expect(await core((k, id) => ({ asked: k.asked.length, closed: k.shell.store.tasksOf({ id } as any).list.every((e) => e.closed),
    tabs: (globalThis as any).__grid.sam.tabs.every((t: any) => t.wc.isDestroyed()) }), ids.project)).toEqual({ asked: 0, closed: true, tabs: true }); // nothing asked; its tasks closed; the closed project's tabs are closed
  expect(await projectTabs(ui, files)).toEqual(['other *']);
  // Opened again from the bar's +, on its task: the conversation goes on, the profiles signed in.
  await plusMenu(ui, 'project', 'task-1');
  await expect.poll(() => core((k, a) => k.shell.current?.folder === a.project && k.shell.profiles.has(a.elon) && !!k.shell.pty, { project, elon: ids.elon })).toBe(true);
  await notLoading(ui);
  await core((k) => k.watchPty(k.shell.pty));
  await expect.poll(() => termText(ui)).toContain(`agent: rc of ${project}\n`);
  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual([ids.sam, ids.elon]);
  expect(await core((k) => k.shell.resumedSession), "the agent continues the project's conversation").toBe('session-1');
  expect(await who(call, SAM)).toBe('Signed in as sam');
  await bothOn(core, ui, files);
  expect(await projectTabs(ui, files), 'a tab opens at the end').toEqual(['other', 'project *']);
  // × on a tab in the background: that project closes, the one on screen stays.
  await closeProject(ui, files, 'other');
  await expect.poll(() => core((k, id) => !k.shell.open.has(id), files.pid('other'))).toBe(true);
  expect(await core((k) => { k.asked.length = 0; return (globalThis as any).__grid.seller.tabs.every((t: any) => t.wc.isDestroyed()); })).toBe(true);
  expect(await projectTabs(ui, files)).toEqual(['project *']);
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(files.userData, 'projects.json'), 'utf8')).list.map((p: { folders: string[] }) => p.folders[0])).toEqual([project, other]);
  expect(files.savedWindows()).toEqual([{ tabs: ['project/1'], shown: 'project/1' }]);
  await core(() => { delete (globalThis as any).__grid; });
});

test('tasks: Move to New Window puts a task in a window of its own, still running; closing that window closes it', async ({ kulisa, core, ui, call, files }, info) => {
  await begin(core, ui, files);
  await makeOther(core, ui, files);
  const other = otherFolder(files), ids = { other: files.pid('other'), project: files.pid('project'), seller: files.idOf('Sam.seller') };
  await ui.evaluate(([f, t]) => (window as any).kulisa.invoke('project:open', { folder: f, task: t }), [other, files.tid('other', 1)]);
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task.loaded && !!k.shell.pty, ids.other)).toBe(true);
  await notLoading(ui);
  await core((k, id) => { const t = k.shell.task; (globalThis as any).__grid = { moved: t, pty: t.pty, seller: t.profiles.get(id), first: k.shell.windows[0] }; }, ids.seller);
  await expect.poll(() => termText(ui)).toContain(`agent: rc of ${other}`);
  // A line as wide as an agent's prompt box (Claude Code's), and the size the agent has.
  const LINE = '='.repeat(150);
  await core((_k, line) => (globalThis as any).__grid.pty.write(`${line}\r`), LINE);
  await expect.poll(() => termText(ui)).toContain(LINE);
  const size = await core(() => { const p = (globalThis as any).__grid.pty; return { cols: p.cols, rows: p.rows }; });
  expect(size.cols, 'the terminal is wide enough for it').toBeGreaterThan(150);
  await core(() => { // every size the agent gets from here on
    const g = (globalThis as any).__grid, pty = g.pty;
    g.sizes = []; g.resize = pty.resize;
    pty.resize = (cols: number, rows: number) => { g.sizes.push([cols, rows]); return g.resize.call(pty, cols, rows); };
  });
  await rightClick(ui, `${tabSel(files, 'other')} .name`);
  await menuRows(ui);
  await choose(ui, 'Move to New Window');
  await expect.poll(() => core((k) => k.shell.windows.length === 2 && k.shell.windows[1].current === (globalThis as any).__grid.moved && !k.shell.windows[1].switching)).toBe(true);
  await core((k) => { (globalThis as any).__grid.second = k.shell.windows[1]; });
  const ui2 = await otherPage(kulisa, ui);

  // The first window keeps its other tab; the new one has the task, as it was: the same agent, the same pages
  // (moved into it, not loaded again), what the terminal showed.
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task.loaded, ids.project)).toBe(true);
  expect(await projectTabs(ui, files)).toEqual(['project *']);
  await expect.poll(() => projectTabs(ui2, files)).toEqual(['other *']);
  expect(await core((_k, id) => {
    const g = (globalThis as any).__grid, view = g.seller.get().view;
    return { window: g.moved.window === g.second, title: g.second.win.getTitle(), agent: g.moved.pty === g.pty, profile: g.moved.profiles.get(id) === g.seller,
      page: g.second.win.contentView.children.includes(view) && !g.first.win.contentView.children.includes(view) };
  }, ids.seller)).toEqual({ window: true, title: 'New Task · other — Kulisa', agent: true, profile: true, page: true }); // the same agent, the same profile, its page moved
  await expect.poll(async () => {
    const b = await ui2.evaluate((id) => { const r = document.querySelector(`.pane[data-profile="${id}"] .content`)?.getBoundingClientRect(); return r?.width ? { width: r.width } : null; }, ids.seller);
    return !!b && core((_k, w) => { const g = (globalThis as any).__grid, view = g.seller.get().view; return view.getVisible() && Math.abs(view.getBounds().width - Math.round(w * g.second.win.webContents.getZoomFactor())) <= 1; }, b.width);
  }).toBe(true);
  await expect.poll(() => termText(ui2)).toContain(`agent: rc of ${other}`);
  // What it showed comes as it was, not cut at a default width; the agent never gets another width meanwhile (it
  // would draw its prompt again for it, leaving the old one behind).
  const lines = await ui2.evaluate(() => {
    const b = (window as any).__term.buffer.active;
    return Array.from({ length: b.length }, (_, i) => b.getLine(i)).filter((l: any) => l.translateToString(true).includes('===')).map((l: any) => [l.translateToString(true).length, l.isWrapped]);
  });
  expect(lines.filter(([n, wrapped]) => n !== 150 || wrapped), `whole lines: ${JSON.stringify(lines)}`).toEqual([]);
  // The window is the same size, so the agent keeps its size, and gets no other on the way: each one makes it draw
  // its prompt again. The new window's page must not fit the terminal before its grid is laid out, at the window's
  // whole height (46 rows for 17).
  const windows = () => core(() => { const g = (globalThis as any).__grid; return [g.first.win.getContentSize(), g.second.win.getContentSize()]; });
  await expect.poll(() => core(() => { const p = (globalThis as any).__grid.pty; return { cols: p.cols, rows: p.rows }; }), { message: `the same size; windows ${JSON.stringify(await windows())}` }).toEqual(size);
  const sizes: number[][] = await core(() => { const g = (globalThis as any).__grid; g.pty.resize = g.resize; return g.sizes; });
  expect(sizes.filter(([cols, rows]) => cols !== size.cols || rows !== size.rows), `no other size on the way: ${JSON.stringify(sizes)}, windows ${JSON.stringify(await windows())}`).toEqual([]);
  // The agent's output and its tools go on there.
  await core(() => (globalThis as any).__grid.pty.write('moved along\r'));
  await expect.poll(() => termText(ui2)).toContain('moved along');
  const png = info.outputPath('second-window.png');
  await core((k, f) => k.shot(f, k.shell.windows[1]), png);
  await info.attach('second-window', { path: png, contentType: 'image/png' });
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app?moved` }, { task: files.tkey('other', 1) });
  expect(await core(() => (globalThis as any).__grid.seller.get().wc.getURL())).toMatch(/\?moved$/);
  // The bar's + in either window: every project.
  expect((await plusMenu(ui2) as string[]).filter((r) => !r.startsWith('  '))).toEqual([...await core((k) => k.shell.store.projects().map((p) => p.name)), 'New Project…']);
  await closeBoard(ui2);
  // Questions about its project are asked in its window.
  await core((k) => { k.answer = false; });
  await ui2.evaluate((id) => (window as any).act('profile:delete', { profile: id }), ids.seller);
  await core((k) => { k.answer = true; });
  expect(await core((_k, id) => (globalThis as any).__grid.moved.profiles.has(id), ids.seller), 'kept: the human said no').toBe(true);
  expect(files.savedWindows()).toEqual([{ tabs: ['project/1'], shown: 'project/1' }, { tabs: ['other/1'], shown: 'other/1' }]);

  // Back into the first window (Move to Window, as a browser moves a tab; the other window named by its shown
  // task): the only tab of the second, so it closes.
  await rightClick(ui2, `${tabSel(files, 'other')} .name`);
  expect(await menuRows(ui2)).toEqual(['# Profiles', 'Sam.seller', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Move to New Window (off)', 'Move to Window: task-1', '-', 'Close', 'Delete Task…', '-', 'other']);
  // Chosen once the script has answered: the choice closes this window, and a script still running in a window that
  // goes never answers.
  await ui2.evaluate(() => { setTimeout(() => [...document.querySelector('.menu[data-state="open"]').querySelectorAll<HTMLElement>('.item')].find((b) => b.querySelector('.label').textContent === 'Move to Window: task-1').click()); });
  await expect.poll(() => core((k) => { const g = (globalThis as any).__grid; return k.shell.windows.length === 1 && k.shell.task === g.moved && !g.first.switching; })).toBe(true);
  expect(await core(() => {
    const g = (globalThis as any).__grid;
    return { gone: g.second.win.isDestroyed(), agent: g.moved.pty === g.pty, page: g.first.win.contentView.children.includes(g.seller.get().view) };
  })).toEqual({ gone: true, agent: true, page: true }); // the same agent, its page back
  await expect.poll(async () => (await viewOn(core, ui, files, 'Sam.seller')) && (await termText(ui)).includes('moved along')).toBe(true);
  expect(await projectTabs(ui, files)).toEqual(['project', 'other *']);
  expect(files.savedWindows()).toEqual([{ tabs: ['project/1', 'other/1'], shown: 'other/1' }]);
  await closeProject(ui, files, 'other');
  await expect.poll(() => core((k, a) => !k.shell.open.has(a.other) && k.shell.current?.id === a.project && !k.shell.windows[0].switching, ids)).toBe(true);

  // A closed task opened again: a tab in this window, nothing asked where; Move to New Window takes it away.
  await core((k) => { k.asked.length = 0; });
  await plusMenu(ui, 'other', 'New Task');
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && [...k.shell.current.tasks.values()][0] === k.shell.task && !!k.shell.task.pty && !k.shell.windows[0].switching, ids.other)).toBe(true);
  expect(await core((k) => k.asked.length), 'no question where').toBe(0);
  expect(await projectTabs(ui, files)).toEqual(['project', 'other *']);
  await rightClick(ui, `${tabSel(files, 'other')} .name`);
  await menuRows(ui);
  await choose(ui, 'Move to New Window');
  await expect.poll(() => core((k, id) => k.shell.windows.length === 2 && k.shell.windows[1].current?.project.id === id && !k.shell.windows[1].switching, ids.other)).toBe(true);
  await core((k) => { const g = (globalThis as any).__grid; g.third = k.shell.windows[1]; g.reopened = g.third.current; });
  await expect.poll(() => core(() => !!(globalThis as any).__grid.reopened.pty)).toBe(true);
  expect(await projectTabs(ui, files), 'nothing else in the first window').toEqual(['project *']);

  // Closing the window (the OS's ×) closes its tasks, as × on each would, after one question in that window
  // (the function that closes a tab); Kulisa goes on in the first.
  await core((k) => { k.asked.length = 0; k.answer = false; (globalThis as any).__grid.third.win.close(); });
  await expect.poll(() => core(async (k) => k.asked.length > 0
    && await (globalThis as any).__grid.third.win.webContents.executeJavaScript(`document.getElementById('ask')?.dataset.state !== 'open'`))).toBe(true);
  const q = await core((k) => k.asked.pop());
  expect(q.message).toBe('Close the window?');
  expect(q.detail).toMatch(/Its tasks close: New Task\./);
  expect(await core((k, id) => !(globalThis as any).__grid.third.win.isDestroyed() && k.shell.open.has(id), ids.other), 'still open when the human says no').toBe(true);
  await core((k) => { k.answer = true; (globalThis as any).__grid.third.win.close(); });
  await expect.poll(() => core((k, id) => k.shell.windows.length === 1 && !k.shell.open.has(id), ids.other)).toBe(true);
  expect(await core((k) => {
    k.asked.length = 0;
    const g = (globalThis as any).__grid;
    return g.third.win.isDestroyed() && g.reopened.profiles.size === 0 && g.reopened.pty === null;
  })).toBe(true);
  expect(files.savedWindows()).toEqual([{ tabs: ['project/1'], shown: 'project/1' }]);
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);

  // macOS: the last window's × hides it, as Mac apps' windows: Kulisa stays in the Dock, its
  // agents go on; a click on the Dock (activate) shows it again as it was. ⌘Q quits (the context menus' test).
  if (MAC) {
    await core((k) => { k.shell.task.promptTarget().state = 'working'; (globalThis as any).__grid.pty = k.shell.task.pty; k.shell.win.close(); });
    await expect.poll(() => core((k) => !k.shell.win.isVisible())).toBe(true);
    expect(await core((k, id) => !k.shell.win.isDestroyed() && k.shell.open.has(id) && k.shell.task.pty === (globalThis as any).__grid.pty && !k.asked.length, ids.project),
      'hidden, asked nothing, its agent goes on').toBe(true);
    await core((k) => { k.electron.app.emit('activate'); });
    await expect.poll(() => core((k) => k.shell.win.isVisible())).toBe(true);
    await core((k) => { k.shell.task.promptTarget().state = null; delete (globalThis as any).__grid; });
    return;
  }
  // The last window's × quits Kulisa (its projects come back at the next start): asked only when an agent works.
  await core((k) => { k.shell.task.promptTarget().state = 'working'; k.answer = false; k.shell.win.close(); });
  await answered(core, ui);
  const quit = await core((k) => k.asked.pop());
  expect(quit.message).toBe('Quit Kulisa?');
  expect(quit.detail).toMatch(/^An agent is still working \(task-1\): quitting stops it\./);
  expect(await core((k, id) => !k.shell.win.isDestroyed() && k.shell.open.has(id), ids.project), 'Kulisa goes on when the human says no').toBe(true);
  await core((k) => { k.shell.task.promptTarget().state = null; k.answer = true; delete (globalThis as any).__grid; });
});

test('tasks: a tab dragged changes the order, goes out into a new window and back into the first', async ({ kulisa, core, ui, files }) => {
  await begin(core, ui, files);
  await makeOther(core, ui, files);
  const other = otherFolder(files), DRAG = 'application/x-kulisa-task', ids = { other: files.pid('other'), project: files.pid('project') };
  await ui.evaluate(([f, t]) => (window as any).kulisa.invoke('project:open', { folder: f, task: t }), [other, files.tid('other', 1)]);
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task.loaded && !!k.shell.pty && !k.shell.windows[0].switching, ids.other)).toBe(true);
  await core((k) => { k.asked.length = 0; (globalThis as any).__grid = { moved: k.shell.task, pty: k.shell.task.pty, pointer: k.shell.pointer }; });
  // Synthetic drag events, as the human's mouse would send them; a drop gets what the drag carried.
  const dragStart = (page: Page, folder: string) => page.evaluate(([sel, drag]) => {
    const w = window as any;
    w.__dt = new DataTransfer();
    document.querySelector(sel).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: w.__dt }));
    return w.__dt.getData(drag) as string;
  }, [tabSel(files, folder), DRAG]);
  const dragEnd = (page: Page, folder: string, effect: string) => page.evaluate(([sel, e]) => {
    const w = window as any;
    w.__dt.dropEffect = e;
    document.querySelector(sel).dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: w.__dt }));
  }, [tabSel(files, folder), effect]);
  // The mark is drawn with the window's next update (Vue), before the next frame.
  const dropOn = (page: Page, folder: string, side: 'before' | 'after', carried: string) => page.evaluate(async ([sel, s, drag, d]) => {
    const dt = new DataTransfer();
    dt.setData(drag, d);
    const t = document.querySelector(sel), r = t.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + (s === 'before' ? 3 : r.width - 3), clientY: r.y + r.height / 2 };
    t.dispatchEvent(new DragEvent('dragover', o));
    await new Promise(requestAnimationFrame);
    const shown = t.classList.contains(`drop-${s}`);
    t.dispatchEvent(new DragEvent('drop', o));
    return shown;
  }, [tabSel(files, folder), side, DRAG, carried]);
  const pointAt = (p: { x: number; y: number } | null) => core((k, at) => { const g = (globalThis as any).__grid; k.shell.pointer = at ? () => at : g.pointer; }, p);

  // The pointer where a test says (dragend's dropEffect of synthetic events is 'none': taken for let go outside).
  const b = await core((k) => k.shell.win.getBounds());
  await pointAt({ x: b.x + 10, y: b.y + 10 });

  // Within the tabs: another order, kept.
  let carried = await dragStart(ui, 'other');
  expect(JSON.parse(carried).key).toBe(files.tkey('other', 1));
  await expect(ui.locator(tabSel(files, 'other'))).toHaveClass(/\bdragging\b/);
  expect(await dropOn(ui, 'project', 'before', carried), 'where it would go is marked').toBe(true);
  await dragEnd(ui, 'other', 'move');
  await expect.poll(() => projectTabs(ui, files)).toEqual(['other *', 'project']);
  expect(files.savedWindows()).toEqual([{ tabs: ['other/1', 'project/1'], shown: 'other/1' }]);

  // Let go outside every window: a new window there. Inside one (or cancelled): nothing.
  await dragStart(ui, 'other');
  await dragEnd(ui, 'other', 'none');
  await sleep(300); // nothing to wait for: that no window comes
  expect(await core((k) => k.shell.windows.length)).toBe(1);
  // Let go beside the window, on the side with more room on the screen: where the window manager put the test's
  // window varies, and a point off the screen gives a window the OS pulls back next to the first one. A window as
  // wide as the screen (a laptop's) is made narrower meanwhile, or no point is beside it.
  const area = await core((k, bounds) => k.electron.screen.getDisplayMatching(bounds).workArea, b);
  const narrowed = Math.max(area.x + area.width - (b.x + b.width), b.x - area.x) < 400;
  if (narrowed) {
    await core((k, a) => k.shell.win.setBounds(a), { x: area.x, y: b.y, width: area.width - 400, height: b.height });
    await expect.poll(() => core((k) => k.shell.win.getBounds().width)).toBe(area.width - 400);
  }
  const nw = await core((k) => k.shell.win.getBounds()), right = area.x + area.width - (nw.x + nw.width) >= nw.x - area.x;
  await pointAt({ x: right ? Math.min(nw.x + nw.width + 300, area.x + area.width - 10) : Math.max(nw.x - 300, area.x + 10), y: nw.y + 200 });
  await dragStart(ui, 'other');
  await dragEnd(ui, 'other', 'none');
  await expect.poll(() => core((k) => k.shell.windows.length === 2 && k.shell.windows[1].current === (globalThis as any).__grid.moved && !k.shell.windows[1].switching)).toBe(true);
  await pointAt(null);
  if (narrowed) await core((k, a) => k.shell.win.setBounds(a), b);
  const ui2 = await otherPage(kulisa, ui);
  const nb = await core((k) => k.shell.windows[1].win.getBounds());
  expect(right ? nb.x > nw.x + 32 : nb.x < nw.x - 32, `towards the pointer, not next to the first window: ${JSON.stringify({ nw, nb, right })}`).toBe(true);
  expect(await projectTabs(ui, files)).toEqual(['project *']);
  expect(await core(() => { const g = (globalThis as any).__grid; return g.moved.pty === g.pty; }), 'the same agent').toBe(true);

  // Onto the first window's tabs: back there, where it was let go; the second window, left empty, closes.
  await core((k) => { (globalThis as any).__grid.second = k.shell.windows[1]; });
  await expect(ui2.locator(tabSel(files, 'other'))).toBeVisible();
  carried = await dragStart(ui2, 'other');
  expect(await dropOn(ui, 'project', 'after', carried)).toBe(true);
  // Its window closes with it: no dragend there.
  await expect.poll(() => core((k) => k.shell.windows.length === 1 && k.shell.task === (globalThis as any).__grid.moved && !k.shell.windows[0].switching)).toBe(true);
  expect(await core(() => { const g = (globalThis as any).__grid; return g.second.win.isDestroyed() && g.moved.pty === g.pty; })).toBe(true);
  expect(await projectTabs(ui, files)).toEqual(['project', 'other *']);
  await closeProject(ui, files, 'other');
  await expect.poll(() => core((k, a) => !k.shell.open.has(a.other) && k.shell.current?.id === a.project && !k.shell.windows[0].switching, ids)).toBe(true);
  await core((k) => { k.asked.length = 0; delete (globalThis as any).__grid; });
});
