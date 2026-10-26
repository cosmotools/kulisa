// The tasks' bar: a tab per open task, switching between them (by a click, a press, the keys), the slide, more tabs than
// it holds, the agent's state on a tab, its + with several projects (docs/tasks.md, docs/window.md).
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core, Call } from './fixtures.ts';
import type { data } from './data.ts';
import { SITE, MAC, sleep, menu, menuRows, choose, closeMenu, rightClick, plusMenu, focusWindow, viewOn, termShows } from './helpers.ts';
import { removeTree } from '../../src/main/remove.ts';

type Files = ReturnType<typeof data>;

const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const rand = () => crypto.randomBytes(3).toString('hex');
const invoke = (ui: Page, channel: string, arg?: unknown) => ui.evaluate(([c, a]) => (window as any).kulisa.invoke(c, a), [channel, arg] as const);
const notLoading = (ui: Page) => expect(ui.locator('html')).not.toHaveClass(/\bloading\b/);
const noSlide = (ui: Page) => expect.poll(() => ui.evaluate(() => document.documentElement.matches(':active-view-transition'))).toBe(false);
// The last question Kulisa asked (answered in its dialog: driver.ts), once it is asked.
async function asked(core: Core) {
  await expect.poll(() => core((k) => k.asked.length)).toBeGreaterThan(0);
  return core((k) => k.asked.pop());
}
// A task's tab in the bar by its key.
const taskTab = (ui: Page, key: string) => ui.locator(`#projectTabs .tasktab[data-task="${key}"]`);
// The shown project's task by its place (from 1), as made; whether the shown task is that one, the window done showing it.
const keyAt = (core: Core, n: number) => core((k, i) => [...k.shell.current.tasks.values()][i - 1]?.key, n);
const isNth = (core: Core, n: number) => core((k, i) => { const t = k.shell.task; return !!t && [...t.project.tasks.values()][i - 1] === t; }, n);
const nthShown = (core: Core, n: number, timeout = 5000) => expect.poll(async () => (await isNth(core, n)) && core((k) => !k.shell.windows[0].switching), { timeout }).toBe(true);
// One of the agent's hooks, as its plugin sends it (agent-hooks.ts); its answer.
async function hook(core: Core, task: string, event: string, input = {}) {
  const url = await core((k, key) => k.hooksOf(k.shell.taskByKey(key)), task);
  const text = await (await fetch(`${url}/${event}`, { method: 'POST', body: JSON.stringify(input) })).text();
  return JSON.parse(text || '{}');
}
// A new task of the shown project (its + in the bar: task:new; the menu itself is tested elsewhere), shown once its agent
// started; named task-<its place among its project's tasks> for the test to refer to it by, unless name is null (left
// "New Task"). Its key.
async function newTask(core: Core, ui: Page, name?: string | null) {
  const before = await core((k) => k.shell.task?.key ?? null);
  await invoke(ui, 'task:new', { project: await core((k) => k.shell.current.id) });
  await expect.poll(() => core((k, b) => { const t = k.shell.task; return !!t && t.key !== b && t.loaded && [...t.terminals.values()].some((x) => !!x.pty) && !k.shell.windows[0].switching; }, before), { timeout: 20000 }).toBe(true);
  return core(async (k, n) => {
    const t = k.shell.task;
    if (n !== null) await t.rename(n ?? `task-${[...t.project.tasks.values()].indexOf(t) + 1}`);
    if (k.shell.pty) k.watchPty(k.shell.pty);
    k.asked.length = 0;
    return t.key;
  }, name);
}

// The project made a git repository as the human sets it up: committed, with what a task's copy takes along or not (an
// .env, an .envrc direnv allowed, a file .worktreeinclude names, an agent's local settings, a file not committed).
function gitProject(project: string) {
  git(project, 'init', '-q');
  fs.writeFileSync(path.join(project, '.gitignore'), '.env*\nconfig/local.json\ntranscript.jsonl\n.claude/settings.local.json\n');
  fs.writeFileSync(path.join(project, '.worktreeinclude'), 'config/local.json\n');
  fs.writeFileSync(path.join(project, 'README.md'), '# shop\n');
  git(project, 'add', '-A');
  git(project, 'commit', '-qm', 'first');
  fs.writeFileSync(path.join(project, '.env'), 'SECRET=1\n');
  fs.writeFileSync(path.join(project, '.envrc'), 'export FROM_ENVRC="envrc of $PWD"\n');
  if (hasDirenv) execFileSync('direnv', ['allow', project]);
  fs.mkdirSync(path.join(project, 'config'), { recursive: true });
  fs.writeFileSync(path.join(project, 'config', 'local.json'), '{"db":"local"}');
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), '{"model":"x"}');
  fs.writeFileSync(path.join(project, 'wip.txt'), 'not committed');
}

// The project as the tasks' tests know it: a git repository (gitProject), the only project open; its task-1 with
// Sam.admin signed in and Elon.buyer signed out side by side (Columns), Dora closed; Feature-X (its second task) open in
// a worktree of its own, Sam and Elon open there too, unless alone (task-1 its only task then); task `shown` shown. Made
// through the core and the window's channels (each tested elsewhere); a task another test left is deleted.
async function begin(core: Core, ui: Page, files: Files, call: Call, { alone = false, shown = 1 } = {}) {
  const pid = files.pid('project');
  if (!fs.existsSync(path.join(files.project, '.git'))) gitProject(files.project);
  for (const id of await core((k, p) => [...k.shell.open.keys()].filter((x) => x !== p), pid)) await invoke(ui, 'project:close-tasks', { id });
  const ready = (key?: string) => expect.poll(() => core((k, a) => k.shell.current?.id === a.pid && !!k.shell.task?.loaded && (!a.key || k.shell.task.key === a.key) && !k.shell.windows[0].switching, { pid, key }), { timeout: 20000 }).toBe(true);
  if (await core((k, p) => k.shell.current?.id !== p || !k.shell.task, pid)) await invoke(ui, 'project:open', { id: pid, task: files.tid('project', 1) });
  await ready();
  for (const key of await core((k, a) => {
    const all = [...k.shell.current.tasks.values()], fx = all.slice(1).find((t) => t.name === 'Feature-X');
    return all.slice(1).filter((t) => a || t !== fx).map((t) => t.key);
  }, alone)) await invoke(ui, 'task:delete', key);
  const first = await keyAt(core, 1);
  if (await core((k, key) => !!k.shell.taskByKey(key).entry.closed, first)) await invoke(ui, 'project:open', { id: pid, task: first.split('/')[1] });
  else if (await core((k, key) => k.shell.task?.key !== key, first)) await invoke(ui, 'task:show', first);
  await ready(first);
  await core(async (k) => {
    const task = k.shell.task, closed = (n: string) => [...task.closed.values()].find((c) => c.cfg.name === n);
    if (task.name !== 'task-1') await task.rename('task-1');
    for (const [name, description, avatar] of [['Sam.admin', 'seller in the test shop', 'fox'], ['Elon.buyer', '', 'owl'], ['Dora', '', undefined]]) {
      if (closed(name)) { if (name !== 'Dora') await task.openProfile(closed(name).cfg.id); } else if (![...k.shell.profiles.values()].some((p) => p.name === name)) await task.createProfile(name, description, avatar);
    }
    const dora = [...k.shell.profiles.values()].find((p) => p.name === 'Dora');
    if (dora) await task.closeProfile(dora.id);
    k.watchPty(k.shell.pty);
  });
  await expect(ui.locator('.ptab[data-panel^="profile:"]')).toHaveCount(2);
  await notLoading(ui);
  await ui.evaluate(() => (window as any).__layoutPreset('columns'));
  await core(async (k, site) => {
    await k.ensureProfile('Sam.admin', `${site}/app/login?name=sam`);
    await k.ensureProfile('Elon.buyer', `${site}/app`);
  }, SITE);
  if (!alone) {
    let fx = await core((k) => [...k.shell.current.tasks.values()].find((t) => t.name === 'Feature-X')?.key);
    if (!fx) {
      fx = await newTask(core, ui, null);
      await call('task_worktree', { name: 'Feature-X' }, { task: fx });
    } else if (await core((k, key) => !!k.shell.taskByKey(key).entry.closed, fx)) await invoke(ui, 'project:open', { id: pid, task: fx.split('/')[1] });
    for (const profile of ['Sam.admin', 'Elon.buyer']) {
      if (await core((k, a) => [...k.shell.taskByKey(a.fx).closed.values()].some((c) => c.cfg.name === a.profile), { fx, profile })) await call('profile_open', { profile }, { task: fx });
    }
    await invoke(ui, 'task:show', shown === 1 ? first : fx);
    await ready(shown === 1 ? first : fx);
  }
  await notLoading(ui);
  await noSlide(ui);
  await core((k) => { k.asked.length = 0; });
}

// A whole mouse button's press or release on a task's tab, as the hand makes it (an input event into the window).
async function mouse(core: Core, ui: Page, type: 'mouseDown' | 'mouseUp', key: string) {
  const b = await taskTab(ui, key).locator('.name').evaluate((n) => n.getBoundingClientRect().toJSON());
  await core((k, a) => {
    const wc = k.shell.win.webContents, z = wc.getZoomFactor();
    wc.sendInputEvent({ type: a.type, x: Math.round((a.b.x + a.b.width / 2) * z), y: Math.round((a.b.y + a.b.height / 2) * z), button: 'left', clickCount: 1 });
  }, { type, b });
}
const chosen = (ui: Page) => ui.evaluate(() => document.querySelector<HTMLElement>('#projectTabs .tasktab.active')?.dataset.task ?? '');

test("tasks: switching shows the other grid and terminal; the one left keeps running; the agent's state shows on its tab", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call, { shown: 2 });
  const first = await keyAt(core, 1), second = await keyAt(core, 2), SAM = files.idOf('Sam.admin');
  // No profiles' button on a task's tab, its right-click menu has them; the × on every tab, as Chrome's, not only
  // the shown one's (the author's choice).
  expect(await ui.evaluate(() => [...document.querySelectorAll('#projectTabs .tasktab')].map((t) => [...t.querySelectorAll('button')].map((b) => `${b.ariaLabel} ${getComputedStyle(b).visibility}`))))
    .toEqual([['Close visible'], ['Close visible']]);
  const widths = () => ui.evaluate(() => [...document.querySelectorAll('#projectTabs .tasktab')].map((t) => t.getBoundingClientRect().width));
  const before = await widths();
  // A tab's right-click menu: the shown one's has its profiles; then renaming, its folder, moving to another window,
  // closing, deleting, and its project's submenu. Show Folder opens the task's worktree in the file manager.
  await rightClick(ui, taskTab(ui, first).locator('.name'));
  expect(await menuRows(ui)).toEqual(['Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'project']);
  await closeMenu(ui);
  await core((k) => {
    const g = globalThis as any;
    g.__openPath = k.electron.shell.openPath; g.__shown = [];
    k.electron.shell.openPath = async (dir: string) => { g.__shown.push(dir); return ''; };
  });
  try {
    await rightClick(ui, taskTab(ui, second).locator('.name'));
    const rows = await menuRows(ui) as string[];
    expect([rows[0], ...rows.slice(-12)]).toEqual(['# Profiles', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'project']);
    expect(rows.slice(1, -12).toSorted(), 'its open and closed profiles').toEqual(['Dora', 'Elon.buyer', 'Sam.admin']);
    await choose(ui, 'Show Folder');
    await expect.poll(() => core(() => (globalThis as any).__shown.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = (globalThis as any).__openPath; }); }
  const [shown, folder] = await core((k, key) => [(globalThis as any).__shown[0], k.shell.taskByKey(key).folder], second);
  expect(shown).toBe(folder);
  expect(folder, "the task's own, not the project's").not.toBe(files.project);
  await taskTab(ui, first).click();
  await nthShown(core, 1);
  expect(await widths(), 'the tabs keep their widths').toEqual(before);
  await expect.poll(async () => (await viewOn(core, ui, files, 'Sam.admin')) && viewOn(core, ui, files, 'Elon.buyer')).toBe(true);
  expect(await core((k, a) => {
    const t = k.shell.taskByKey(a.second), sam = t.profiles.get(a.SAM);
    return [sam.get().view.getVisible(), sam.tabs.every((x) => !x.wc.isDestroyed()) && !!t.pty];
  }, { second, SAM }), "the second task's pages are hidden, and alive, its agent too").toEqual([false, true]);
  await termShows(ui, `agent: rc of ${files.project}\n`);
  await expect.poll(() => files.savedWindows()[0].shown, 'the shown task kept for the next start').toBe('project/1');
  // What the second task's agent does reaches its tab (Claude Code's hooks); its captions do not show on the first's panes.
  const post = (event: string) => hook(core, second, event);
  const state = () => taskTab(ui, second).locator('.state').evaluate((s: HTMLElement) => `${s.dataset.state} ${s.querySelector('use').getAttribute('href')} ${s.checkVisibility()}`);
  expect(await state(), 'unknown: no icon').toBe(' #i-done false');
  await post('prompt');
  await expect.poll(state).toBe('working #i-working true');
  await post('stop');
  await expect.poll(state).toBe('done #i-done true');
  // A permission the agent asks for: waiting.
  await post('waiting');
  await expect.poll(state).toBe('waiting #i-waiting true');
  await expect(taskTab(ui, second).locator('.state')).toHaveAttribute('title', 'The agent waits for you');
  // Interrupted by the human (Codex's Interrupt), or its session ended: unknown again; but a session ending after a
  // done turn (Codex: 30 minutes idle) leaves "come and see".
  await post('prompt');
  await post('interrupt');
  await expect.poll(state).toBe(' #i-done false');
  // Esc in its terminal: Claude Code stops the turn and runs no hook, so working would be shown on and on. A done
  // one stays done.
  const agent = await core((k, key) => k.shell.taskByKey(key).promptTarget().key, second); // its agent's terminal
  const esc = () => ui.evaluate((key) => (window as any).kulisa.send('pty:in', { task: key, data: '\x1b' }), agent);
  for (const s of ['prompt', 'waiting']) {
    await post(s);
    await expect.poll(state).toMatch(s === 'prompt' ? /^working/ : /^waiting/);
    await esc();
    await expect.poll(state).toBe(' #i-done false');
  }
  await post('stop');
  await esc();
  await sleep(300); // nothing to wait for: that it stays
  expect(await state()).toBe('done #i-done true');
  await post('prompt');
  await post('session-end');
  await expect.poll(state).toBe(' #i-done false');
  await post('stop');
  await post('session-end');
  await sleep(300); // nothing to wait for: that it stays
  expect(await state()).toBe('done #i-done true');
  await core((k, a) => k.shell.taskByKey(a.second).caption(a.SAM, 'from the second task'), { second, SAM });
  await sleep(200); // nothing to wait for: that it does not show
  await expect(ui.locator(`.ptab[data-panel="profile:${SAM}"] .caption`)).toHaveText('');
  // Done says "come and see" until the human sees that task.
  await post('stop');
  await expect.poll(state).toBe('done #i-done true');
  await taskTab(ui, second).click();
  await expect.poll(async () => (await core((k, key) => k.shell.task?.key === key, second)) && state()).toBe(' #i-done false');
  expect(await core((k, key) => k.shell.taskByKey(key).promptTarget().state, second), 'the agent is still done: only its tab says nothing').toBe('done');
  await taskTab(ui, first).click();
  await nthShown(core, 1);
  await expect.poll(async () => (await viewOn(core, ui, files, 'Sam.admin')) && viewOn(core, ui, files, 'Elon.buyer')).toBe(true);
  await noSlide(ui);
});

test('tasks: switching slides the grid towards the other tab (a view transition); then the pages are live again', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call);
  const first = await keyAt(core, 1), second = await keyAt(core, 2), SAM = files.idOf('Sam.admin'), ELON = files.idOf('Elon.buyer');
  // The transition's types (which way), and the grid's own slide as it runs: an animation of 0 s, as a CSS minifier may
  // make it, leaves the two grids' pictures one over the other; out past the window's margin, not lingering at its edge
  // (Grid.vue).
  const swap = (key: string) => ui.evaluate(async (key) => {
    const d = document as any, start = d.startViewTransition.bind(document);
    let seen: { types: string[]; animations: string[] };
    d.startViewTransition = (o: unknown) => {
      const t = start(o);
      t.ready.then(() => {
        seen = { types: [...t.types],
          animations: document.getAnimations().filter((a) => ['::view-transition-old(grid)', '::view-transition-new(grid)'].includes((a.effect as KeyframeEffect)?.pseudoElement) && Number(a.effect.getTiming().duration) > 0)
            .map((a) => { const [from, to] = (a.effect as KeyframeEffect).getKeyframes(); return [(a as CSSAnimation).animationName, from.translate === 'none' ? to.translate : from.translate, from.easing].join(' '); }).sort() };
      });
      return t;
    };
    await (window as any).kulisa.invoke('task:show', key);
    await new Promise((r) => setTimeout(r, 800));
    delete d.startViewTransition; // the document's own again
    return seen;
  }, key);
  const live = async () => (await ui.locator('img.snapshot').count()) === 0 && viewOn(core, ui, files, 'Sam.admin');
  let seen = await swap(second);
  expect(seen.types).toEqual(['next']);
  expect(seen.animations, 'it slides').toEqual(['grid-from-right calc(100% + 8px) cubic-bezier(0.4, 0, 0.2, 1)', 'grid-to-left calc(-100% - 8px) cubic-bezier(0.4, 0, 0.2, 1)']);
  await expect.poll(live).toBe(true);
  // A page that draws no frame (busy, covered) holds the slide's start no longer than three times what the others
  // take (a tenth of a second at least), its pane then empty: half a second is felt after each click.
  // Their pace, not a fixed time: a loaded machine takes over a tenth of a second for a picture.
  const pics = await core(async (k, ids) => {
    const tab = k.shell.profiles.get(ids.SAM).get() as any, elon = k.shell.profiles.get(ids.ELON).get().wc as any, its = elon.capturePage;
    let took = 0;
    tab.wc.capturePage = () => new Promise(() => {});
    elon.capturePage = (...a: unknown[]) => its.apply(elon, a).then((img: unknown) => { took = Date.now() - t0; return img; });
    const t0 = Date.now(), got = await k.shell.windows[0].pictures(), all = Date.now() - t0;
    delete tab.wc.capturePage; delete elon.capturePage; // their prototypes' again
    return { took, all, sam: !!got[ids.SAM], elon: !!got[ids.ELON] };
  }, { SAM, ELON });
  expect(pics.took && pics.all < Math.max(100, 3 * pics.took) + 150, `pictures in ${pics.all} ms, the other's in ${pics.took} ms`).toBeTruthy();
  expect(!pics.sam && pics.elon, 'the others taken').toBe(true);
  seen = await swap(first);
  expect(seen.types).toEqual(['previous']);
  expect(seen.animations).toEqual(['grid-from-left calc(-100% - 8px) cubic-bezier(0.4, 0, 0.2, 1)', 'grid-to-right calc(100% + 8px) cubic-bezier(0.4, 0, 0.2, 1)']);
  await expect.poll(live).toBe(true);
  // A menu opened while the grid still slides keeps the pages under it pictures, not shown over it at the slide's end.
  // Opened as soon as the slide starts, before the grid left is taken down (the transition's update, a frame later,
  // later still on a loaded machine): taking it down must not forget the menu's pictures.
  const sliding = () => ui.evaluate(() => document.documentElement.matches(':active-view-transition'));
  await ui.evaluate((key) => {
    const d = document as any, start = d.startViewTransition.bind(document);
    d.startViewTransition = (o: unknown) => { const t = start(o); delete d.startViewTransition; document.getElementById('windowMenu').click(); return t; };
    void (window as any).kulisa.invoke('task:show', key);
  }, second);
  await expect.poll(sliding).toBe(true);
  await expect(menu(ui)).toBeVisible();
  await expect.poll(sliding).toBe(false);
  await sleep(100); // what the slide's end did, which must not show them
  expect(await core((k) => [...k.shell.profiles.values()].every((p) => !p.get().view.getVisible())), 'the pages stay under the menu').toBe(true);
  await closeMenu(ui);
  await expect.poll(live).toBe(true);
  await swap(first);
  await expect.poll(live).toBe(true);
});

test('tasks: Ctrl+Shift+2 shows the second, Ctrl+Shift+PgUp and PgDn the one before and after, from the terminal too', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call);
  const shown = (n: number) => expect.poll(async () => (await isNth(core, n)) && (await core((k) => !k.shell.windows[0].switching)) && !(await ui.evaluate(() => document.documentElement.classList.contains('loading')))).toBe(true);
  await focusWindow(core, ui);
  // The terminal shown before it takes the keyboard: the grid's slide hides it (dockview's overlay) until it is over.
  await expect.poll(() => ui.evaluate(() => !!(window as any).__term?.textarea?.checkVisibility({ visibilityProperty: true }))).toBe(true);
  await ui.evaluate(() => (window as any).__term.focus());
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('terminal');
  // ⌘⌥2 on macOS: ⌘⇧3…5 are its screenshots.
  await core((k, mac) => k.press(k.shell.win.webContents, '2', ...(mac ? ['meta', 'alt'] as const : ['control', 'shift'] as const)), MAC);
  await shown(2);
  await core((k) => k.press(k.shell.win.webContents, 'PageUp', k.CMD, 'shift'));
  await shown(1);
  await core((k) => k.press(k.shell.win.webContents, 'PageDown', k.CMD, 'shift'));
  await shown(2);
  await taskTab(ui, await keyAt(core, 1)).click();
  await shown(1);
});

test("tasks: more tabs than the bar holds: each keeps its name readable, a mouse's wheel scrolls them, a faded edge says some are past it, the shown one stays in sight; in the title bar the window is still dragged after +", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call);
  // Two tabs, the bar narrowed to less than they take: as thirty tabs in a window.
  const bar = () => ui.evaluate(() => {
    const s = document.querySelector('#projectTabs'), a = s.querySelector('.active').getBoundingClientRect(), b = s.getBoundingClientRect();
    return { left: Math.round(s.scrollLeft), max: s.scrollWidth - s.clientWidth, fade: ['past-start', 'past-end'].filter((e) => s.classList.contains(e)).join(' '), inSight: a.left >= b.left && a.right <= b.right };
  });
  const frame = () => ui.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect((await bar()).fade, 'all fit: no edge fades').toBe('');
  await taskTab(ui, await keyAt(core, 2)).click();
  await nthShown(core, 2);
  try {
    await ui.evaluate(() => { document.querySelector<HTMLElement>('#taskbar').style.maxWidth = '300px'; });
    await expect.poll(async () => { const b = await bar(); return b.max > 0 && b.inSight; }).toBe(true);
    expect(await ui.evaluate(() => [...document.querySelectorAll('#projectTabs .tasktab')].map((t) => { const n = t.querySelector('.name'); return [t.getBoundingClientRect().width, n.scrollWidth <= n.clientWidth]; })),
      'at their narrowest, the names whole').toEqual([[160, true], [160, true]]);
    const now = await bar();
    expect([now.left, now.fade], 'brought into view when the bar narrowed; only the edge with a tab past it fades').toEqual([now.max, 'past-start']);
    // The wheel turns up and down; the bar scrolls sideways.
    await noSlide(ui); // the slide's pictures over the window take every event
    const b = await ui.evaluate(() => document.querySelector('#projectTabs').getBoundingClientRect().toJSON());
    await core((k, r) => {
      const wc = k.shell.win.webContents, z = wc.getZoomFactor();
      wc.sendInputEvent({ type: 'mouseWheel', x: Math.round((r.x + r.width / 2) * z), y: Math.round((r.y + r.height / 2) * z), deltaX: 0, deltaY: 400 }); // up: towards the start
    }, b);
    await expect.poll(async () => (await bar()).left).toBe(0);
    await expect.poll(async () => (await bar()).fade).toBe('past-end'); // scrolled to the start: the other edge fades
    expect((await bar()).inSight, 'the bar stays where the wheel took it').toBe(false);
    // In the title bar: the tabs give way before the space after + that drags the window (Chrome's), however many. The
    // tabs scrolled past the bar's edges are no-drag over the logo and that space too (Chromium does not clip them to
    // the bar) and the last region in the page wins: so both come after the bar, the logo shown first all the same (a
    // real drag of the window is the OS's, out of a test's reach).
    await invoke(ui, 'bar:set', 'top');
    await expect(ui.locator('#topbar #projectTabs')).toHaveCount(1);
    await ui.evaluate(() => document.querySelectorAll<HTMLElement>('#projectTabs .tasktab').forEach((t) => { t.style.minWidth = t.style.maxWidth = '1000px'; })); // the bar drawn anew: tabs as wide as many
    await frame();
    expect(await ui.evaluate(() => {
      const q = (s: string) => document.querySelector(s), r = (s: string) => q(s).getBoundingClientRect(), s = q('#projectTabs');
      const after = (x: string) => !!(q('#taskbar').compareDocumentPosition(q(x)) & Node.DOCUMENT_POSITION_FOLLOWING) && (getComputedStyle(q(x)) as any).appRegion;
      return [s.scrollWidth > s.clientWidth, r('#topbar .drag').width >= 40, r('#manageProjects').left - r('#newTask').right >= 40, q('#topbar .logo') ? after('#topbar .logo') : 'drag', after('#topbar .drag'), !q('.logo') || r('.logo').right <= r('#taskbar').left];
    }), 'the tabs overflow, 40 px left to drag by; it and the logo (none on macOS) after the bar in the page, the logo before it on screen').toEqual([true, true, true, 'drag', 'drag', true]);
    expect((await bar()).inSight, 'the shown one in sight, the bar drawn anew there').toBe(true);
  } finally {
    await invoke(ui, 'bar:set', 'bottom');
    await ui.evaluate(() => {
      document.querySelector<HTMLElement>('#taskbar').style.maxWidth = '';
      document.querySelectorAll<HTMLElement>('#projectTabs .tasktab').forEach((t) => { t.style.minWidth = t.style.maxWidth = ''; });
    });
  }
  await expect(ui.locator('#topbar #projectTabs')).toHaveCount(0);
  await expect(ui.locator('#projectTabs')).toHaveCount(1);
  await taskTab(ui, await keyAt(core, 1)).click();
  await nthShown(core, 1);
});

test("tasks: a press on a tab not shown chooses it at once, as Chrome's; its task is shown when the button is let go or the tab starts being dragged, so it can be dragged", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call);
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  // The slide that showing a task starts makes Chromium drop a drag about to begin: a tab not shown would not be
  // dragged, its press only showing it. One begun goes on through the slide.
  await noSlide(ui); // the slide's pictures over the window take every event
  await mouse(core, ui, 'mouseDown', second);
  await expect.poll(() => chosen(ui)).toBe(second);
  await sleep(200); // nothing to wait for: that it is not shown yet
  expect(await isNth(core, 1), 'not shown while the button is down').toBe(true);
  // Lit on the press, it stays lit: let go of, it would go dark while the main process takes the pictures for the slide
  // and light again with the new state, the tab blinking.
  await ui.evaluate(() => {
    const w = window as any, lit = () => document.querySelector<HTMLElement>('#projectTabs .tasktab.active')?.dataset.task ?? '';
    w.__lit = [lit()];
    w.__litObs = new MutationObserver(() => w.__lit.push(lit()));
    w.__litObs.observe(document.getElementById('projectTabs'), { attributes: true, attributeFilter: ['class'], subtree: true });
  });
  await mouse(core, ui, 'mouseUp', second);
  await nthShown(core, 2);
  await noSlide(ui);
  expect([...new Set(await ui.evaluate(() => { const w = window as any; w.__litObs.disconnect(); return w.__lit as string[]; }))], 'the tab lit from the press to the task shown, no other').toEqual([second]);
  // A drag begins: Chromium cancels the pointer (a real drag of a tab is the OS's, out of a test's reach).
  await mouse(core, ui, 'mouseDown', first);
  await expect.poll(() => chosen(ui)).toBe(first);
  await ui.evaluate(() => dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' })));
  await nthShown(core, 1);
  await mouse(core, ui, 'mouseUp', first);
  await ui.evaluate(() => (document.activeElement as HTMLElement).blur()); // a real press leaves the keyboard on the tab (Reka's); a later dialog takes it from nothing
});

test("tasks: a double click on a task's tab is its Rename…", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, call);
  const tab = ui.locator('#projectTabs .tasktab:not(.active) .name');
  const name = await tab.textContent();
  await tab.dispatchEvent('dblclick');
  await expect(ui.locator('#taskrename')).toHaveAttribute('data-state', 'open');
  await expect(ui.locator('#taskname')).toHaveValue(name);
  await core((k) => k.press(k.shell.win.webContents, 'Escape'));
  await expect(ui.locator('#taskrename[data-state="open"]')).toHaveCount(0);
});

test('menus: one longer than the window has stays in it and scrolls', async ({ ui }) => {
  // A menu longer than the window (thirty closed tasks) must not run past its edge, its first rows out of reach
  // above. Any menu: ☰'s here.
  await ui.locator('#windowMenu').click();
  await menuRows(ui);
  await menu(ui).evaluate((m) => { const row = m.querySelector('.item'); for (let i = 0; i < 60; i++) m.append(row.cloneNode(true)); }); // as many rows as thirty closed tasks and more
  expect(await menu(ui).evaluate((m) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const b = m.getBoundingClientRect();
    r([b.top >= 0, b.bottom <= innerHeight, m.scrollHeight > m.clientHeight]);
  }))))).toEqual([true, true, true]);
  await closeMenu(ui);
});

test("tasks: the bar's + with several projects — a click on a project makes it a new task, and a task's 🗑 deletes it after the question", async ({ core, ui, files, call }) => {
  // About 1 s: git's work (a second project made and deleted).
  await begin(core, ui, files, call);
  // A second project, open, so the + nests each project as a submenu (one project shows its tasks inline).
  const plus2 = path.join(files.root, `plus2-${rand()}`);
  fs.mkdirSync(plus2); git(plus2, 'init', '-q'); fs.writeFileSync(path.join(plus2, 'a.txt'), 'a'); git(plus2, 'add', '-A'); git(plus2, 'commit', '-qm', 'mine');
  const made = await invoke(ui, 'project:new', { from: 'folder', folders: [plus2], name: 'Plus2' });
  expect(made.id, 'the second project is made').toBeTruthy();
  await invoke(ui, 'project:open', { id: made.id });
  const on = () => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded && !k.shell.windows[0].switching, made.id);
  await expect.poll(async () => (await on()) && core((k) => !!k.shell.pty), { timeout: 10000 }).toBe(true);
  await notLoading(ui);
  const tasks2 = () => core((k, id) => k.shell.store.tasksOf(k.shell.store.projects().find((x) => x.id === id)).list.length, made.id);
  const open = ui.locator('.menu[data-state="open"]');
  const trigger = (name: string) => open.first().locator('[role="menuitem"][aria-haspopup]').filter({ has: ui.locator('.label', { hasText: new RegExp(`^${RegExp.escape(name)}$`) }) });

  // A left release on the project row itself makes a new task of it and closes the menu (its tasks still open on hover).
  await plusMenu(ui);
  const before = await tasks2();
  await trigger('Plus2').click();
  await expect.poll(async () => (await tasks2()) === before + 1 && on(), { timeout: 10000 }).toBe(true);
  await expect(open).toHaveCount(0);

  // Each task row carries a 🗑 that deletes the task after the Delete Task… question (Cancel keeps it).
  await core((k) => { k.answer = false; });
  await plusMenu(ui);
  const fx = () => open.last().locator('[role="menuitem"]').filter({ has: ui.locator('.label', { hasText: /^Feature-X$/ }) });
  await expect(async () => {
    if ((await open.count()) < 2) { await ui.mouse.move(0, 0); await trigger('project').hover(); }
    await expect(fx()).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
  await expect(fx().locator('.remove'), 'a task row has a 🗑').toHaveCount(1);
  await fx().hover();
  await fx().locator('.remove').click();
  expect((await asked(core)).message).toBe('Delete the task Feature-X?');
  await expect(ui.locator('#ask[data-state="open"]')).toHaveCount(0);

  // The second project removed; back to project's task-1 shown.
  await core((k) => { k.answer = true; });
  await invoke(ui, 'project:delete', { id: made.id });
  await expect.poll(() => core((k, id) => !k.shell.open.has(id), made.id)).toBe(true);
  // Once its task's shell has left it: Windows does not remove a process's folder.
  await expect.poll(() => { try { removeTree(plus2); return true; } catch { return false; } }).toBe(true);
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded, files.pid('project'))).toBe(true);
  await taskTab(ui, await keyAt(core, 1)).click();
  await nthShown(core, 1);
});
