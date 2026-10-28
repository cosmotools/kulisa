// The tasks' bar: a tab per open task, switching between them (by a click, a press, the keys), more tabs than it holds, the agent's state on a tab, its + (docs/tasks.md, docs/window.md).
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import { MAC, frames, ipcSettled, menu, item, choose, closeMenu, rightClick, fromSidebar, openSidebar, closeSidebar, sidebar, taskRow, rowButton, focusWindow, viewOn, termShows, invoke, notLoading, answer, removed, termKeys, resize } from './helpers.ts';
import { committed, rand, keyAt, isNth, nthShown, taskTab, hook, begin, bothOn, newTask } from './tasks-helpers.ts';

// The tab chosen (lit) in the bar.
const chosen = (ui: Page) => ui.locator('#taskTabs [role="tab"][aria-selected="true"]');

test("tasks: switching shows the other grid and terminal; the one left keeps running; the agent's state shows on its tab", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call, shown: 2 });
  const first = await keyAt(core, 1), second = await keyAt(core, 2), SAM = files.idOf('Sam.admin');
  // No profiles' button on a task's tab, its right-click menu has them; the × on every tab, as Chrome's, not only
  // the shown one's (the author's choice).
  const tabs = ui.locator('#taskTabs [role="tab"]');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.getByRole('button')).toHaveCount(2);
  await expect(tabs.getByRole('button', { name: 'Close', exact: true }), 'one ×, shown').toHaveCount(2);
  const widths = async () => Promise.all((await tabs.all()).map(async (t) => (await t.boundingBox()).width));
  const before = await widths();
  // A tab's right-click menu: the shown one's has its profiles; then renaming, its folder, moving to another window,
  // closing, deleting, and its project's submenu. Show Folder opens the task's worktree in the file manager.
  await rightClick(ui, taskTab(ui, first));
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Rename…"
      - menuitem "Show Folder"
      - menuitem "Move to New Window"
      - menuitem "Close"
      - menuitem "Delete Task…"
      - menuitem "project"
  `);
  await closeMenu(ui);
  await core((k) => {
    const g = k.stash;
    g.openPath = k.electron.shell.openPath; g.shown = [];
    k.electron.shell.openPath = async (dir: string) => { g.shown.push(dir); return ''; };
  });
  try {
    await rightClick(ui, taskTab(ui, second));
    // Its open and closed profiles.
    await expect(menu(ui)).toMatchAriaSnapshot(`
      - menu:
        - text: Profiles
        - menuitem "Sam.admin"
        - menuitem "Elon.buyer"
        - menuitem "Dora"
        - menuitem "Manage Profiles…"
        - menuitem "Rename…"
        - menuitem "Show Folder"
        - menuitem "Move to New Window"
        - menuitem "Close"
        - menuitem "Delete Task…"
        - menuitem "project"
    `);
    await choose(ui, 'Show Folder');
    await expect.poll(() => core((k) => k.stash.shown.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  const [shown, folder] = await core((k, key) => [k.stash.shown[0], k.shell.taskByKey(key).folder], second);
  expect(shown).toBe(folder);
  expect(folder, "the task's own, not the project's").not.toBe(files.project);
  await taskTab(ui, first).click();
  await nthShown(core, 1);
  expect(await widths(), 'the tabs keep their widths').toEqual(before);
  await bothOn(core, ui, files);
  expect(await core((k, a) => {
    const t = k.shell.taskByKey(a.second), sam = t.profiles.get(a.SAM);
    return [sam.get().view.getVisible(), sam.tabs.every((x) => !x.wc.isDestroyed()) && !!t.pty];
  }, { second, SAM }), "the second task's pages are hidden, and alive, its agent too").toEqual([false, true]);
  await termShows(ui, `agent: rc of ${files.project}\n`);
  await expect.poll(() => files.savedWindows()[0].shown, 'the shown task kept for the next start').toBe('project/1');
  // What the second task's agent does reaches its tab (Claude Code's hooks); its captions do not show on the first's panes.
  const post = (event: string) => hook(core, second, event);
  // Its state on the tab: an icon of it, none shown while it is unknown ('').
  const badge = taskTab(ui, second).locator('[data-state]');
  const state = async (s: string, message?: string) => {
    await expect(badge, message).toHaveAttribute('data-state', s);
    if (s) await expect(badge, message).toBeVisible(); else await expect(badge, message).toBeHidden();
  };
  await state('', 'unknown: no icon');
  await post('prompt');
  await state('working');
  await post('stop');
  await state('done');
  // A permission the agent asks for: waiting.
  await post('waiting');
  await state('waiting');
  await expect(badge).toHaveAttribute('title', 'The agent waits for you');
  // Interrupted by the human (Codex's Interrupt), or its session ended: unknown again; but a session ending after a
  // done turn (Codex: 30 minutes idle) leaves "come and see".
  await post('prompt');
  await post('interrupt');
  await state('');
  // Esc in its terminal: Claude Code stops the turn and runs no hook, so working would be shown on and on. A done
  // one stays done.
  // Sent as its terminal sends a key: the task is behind, its terminal not on screen to type in.
  const agent = await core((k, key) => k.shell.taskByKey(key).promptTarget().key, second); // its agent's terminal
  const esc = () => ui.evaluate((key) => (window as any).kulisa.send('pty:in', { task: key, data: '\x1b' }), agent);
  for (const s of ['prompt', 'waiting']) {
    await post(s);
    await expect(badge).toHaveAttribute('data-state', s === 'prompt' ? 'working' : 'waiting');
    await esc();
    await state('');
  }
  // The hooks answer once handled, and the main process tells the window as it handles a hook, an Esc or a caption: all
  // of it is in the window once its channel has gone there and back.
  await post('stop');
  await esc();
  await ipcSettled(ui);
  await state('done', 'Esc after a done turn: it stays');
  await post('prompt');
  await post('session-end');
  await state('');
  await post('stop');
  await post('session-end');
  await ipcSettled(ui);
  await state('done', 'the session ending after a done turn: it stays');
  await core((k, a) => k.shell.taskByKey(a.second).caption(a.SAM, 'from the second task'), { second, SAM });
  await ipcSettled(ui);
  await expect(ui.locator(`[data-panel="profile:${SAM}"] [role="status"]`), 'not on the first task\'s pane').toHaveText('');
  // Done says "come and see" until the human sees that task.
  await post('stop');
  await state('done');
  await taskTab(ui, second).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key, second)).toBe(true);
  await state('');
  expect(await core((k, key) => k.shell.taskByKey(key).promptTarget().state, second), 'the agent is still done: only its tab says nothing').toBe('done');
  await taskTab(ui, first).click();
  await nthShown(core, 1);
  await bothOn(core, ui, files);
});

test('tasks: switching shows the other grid at once, its pages live once it is laid out; a menu opened as the grid goes keeps them pictures under it', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const first = await keyAt(core, 1), second = await keyAt(core, 2), SAM = files.idOf('Sam.admin'), ELON = files.idOf('Elon.buyer');
  const live = async () => (await ui.locator('[data-testid="snapshot"]').count()) === 0 && viewOn(core, ui, files, 'Sam.admin');
  // No frame without a grid between the two: the one on screen stays until the next one is built.
  await ui.evaluate(() => {
    const w = window as any;
    w.__empty = 0; w.__watching = true;
    const frame = () => {
      const dock = document.getElementById('dock');
      if (!dock || dock.hasAttribute('aria-busy') || !dock.querySelector('[data-panel]')) w.__empty++;
      if (w.__watching) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await invoke(ui, 'task:show', second);
  await expect.poll(live).toBe(true);
  expect(await ui.evaluate(() => { const w = window as any; w.__watching = false; return w.__empty; }), 'frames with no grid').toBe(0);
  // A page that draws no frame (busy, covered) holds a menu's pictures no longer than three times what the others
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
  // A menu opened as the grid left is taken down, before the next one is laid out, keeps the pages under it pictures,
  // not shown over it once the grid is. Pressed (a menu opens on the press) as the window hears of it: a click from the
  // test would come once the grid is laid out.
  await ui.evaluate(() => {
    let once = true;
    (window as any).kulisa.on('grid:closing', () => {
      if (once) document.getElementById('windowMenu').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      once = false;
    });
  });
  await invoke(ui, 'task:show', first);
  await expect(menu(ui)).toBeVisible();
  await notLoading(ui);
  // What the grid laid out does (lib/grid.ts, reveal: the pages shown, unless a menu holds them) asks the main process:
  // done once the window has drawn its frames and its channel gone there and back.
  await frames(ui);
  await ipcSettled(ui);
  expect(await core((k) => [...k.shell.profiles.values()].every((p) => !p.get().view.getVisible())), 'the pages stay under the menu').toBe(true);
  await closeMenu(ui);
  await expect.poll(live).toBe(true);
});

test('tasks: Ctrl+Shift+2 shows the second, Ctrl+Shift+PgUp and PgDn the one before and after, from the terminal too', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const shown = async (n: number) => {
    await expect.poll(async () => (await isNth(core, n)) && core((k) => k.settled())).toBe(true);
    await notLoading(ui);
  };
  await focusWindow(core, ui);
  // The terminal shown (dockview's overlay, laid out) before it takes the keyboard.
  await expect(termKeys(ui)).toHaveCSS('visibility', 'visible');
  await termKeys(ui).focus();
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
  // About 3 s: three tasks more, as many as the narrowest window's bar does not hold.
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const strip = ui.locator('#taskTabs'), tabs = strip.getByRole('tab');
  // Where the bar is scrolled to, and how far it can be: Playwright reads no scroll.
  const scroll = () => strip.evaluate((s) => ({ left: Math.round(s.scrollLeft), max: s.scrollWidth - s.clientWidth }));
  // Which edges fade: the one with a tab past it.
  const fades = async (start: boolean, end: boolean, message?: string) => {
    await (start ? expect(strip, message).toHaveAttribute('data-past-start') : expect(strip, message).not.toHaveAttribute('data-past-start'));
    await (end ? expect(strip, message).toHaveAttribute('data-past-end') : expect(strip, message).not.toHaveAttribute('data-past-end'));
  };
  await fades(false, false, 'all fit: no edge fades');
  for (let i = 0; i < 3; i++) await newTask(core, ui); // the last one shown
  const before = await resize(core, { width: 640 });
  try {
    await expect.poll(async () => (await scroll()).max).toBeGreaterThan(0);
    await expect(chosen(ui), 'brought into view when the bar narrowed').toBeInViewport({ ratio: 1 });
    for (const t of await tabs.all()) {
      expect((await t.boundingBox()).width, 'at their narrowest').toBe(160);
      // The name whole: its words' box as wide as they are (Playwright reads no overflow).
      expect(await t.getByText(await t.getAttribute('aria-label'), { exact: true }).evaluate((n) => n.scrollWidth <= n.clientWidth), 'the name whole').toBe(true);
    }
    const now = await scroll();
    expect(now.left, 'scrolled to the end').toBe(now.max);
    await fades(true, false, 'only the edge with a tab past it fades');
    // The wheel turns up and down; the bar scrolls sideways.
    await strip.hover();
    await ui.mouse.wheel(0, -400); // up: towards the start
    await expect.poll(async () => (await scroll()).left).toBe(0);
    await fades(false, true); // scrolled to the start: the other edge fades
    await expect(chosen(ui), 'the bar stays where the wheel took it').not.toBeInViewport({ ratio: 1 });
    // In the title bar: the tabs give way before the space after + that drags the window (Chrome's), however many. The
    // tabs scrolled past the bar's edges are no-drag over the logo and that space too (Chromium does not clip them to
    // the bar) and the last region in the page wins: so both come after the bar, the logo shown first all the same (a
    // real drag of the window is the OS's, out of a test's reach). Where each is in the page and its app-region:
    // Playwright reads neither.
    await invoke(ui, 'bar:set', 'top');
    await expect(ui.locator('#topbar #taskTabs')).toHaveCount(1);
    await expect.poll(async () => (await scroll()).max, 'the tabs overflow').toBeGreaterThan(0);
    const width = async (sel: string) => (await ui.locator(sel).boundingBox()).width;
    expect(await width('[data-testid="drag-area"]'), '40 px left to drag by').toBeGreaterThanOrEqual(40);
    const plus = await ui.locator('#newTask').boundingBox(), gear = await ui.locator('#settingsButton').boundingBox();
    expect(gear.x - (plus.x + plus.width)).toBeGreaterThanOrEqual(40);
    const logo = ui.getByTestId('title-logo');
    expect(await ui.evaluate(() => {
      const q = (s: string) => document.querySelector(s);
      const after = (x: string) => !!(q('#taskbar').compareDocumentPosition(q(x)) & Node.DOCUMENT_POSITION_FOLLOWING) && (getComputedStyle(q(x)) as any).appRegion;
      return [q('[data-testid="title-logo"]') ? after('[data-testid="title-logo"]') : 'drag', after('[data-testid="drag-area"]')];
    }), 'it and the logo (none on macOS) after the bar in the page').toEqual(['drag', 'drag']);
    if (await logo.count()) {
      const l = await logo.boundingBox(), bar = await ui.locator('#taskbar').boundingBox();
      expect(l.x + l.width, 'the logo before the bar on screen').toBeLessThanOrEqual(bar.x);
    }
    await expect(chosen(ui), 'the shown one in sight, the bar drawn anew there').toBeInViewport({ ratio: 1 });
  } finally {
    await invoke(ui, 'bar:set', 'bottom');
    await resize(core, before);
  }
  await expect(ui.locator('#topbar #taskTabs')).toHaveCount(0);
  await expect(ui.locator('#taskTabs')).toHaveCount(1);
  await taskTab(ui, await keyAt(core, 1)).click();
  await nthShown(core, 1);
});

test("tasks: a press on a tab not shown shows its task at once, as Chrome's, the tab lit from then on", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  // Every change of the lit tab noted as it comes: an assertion sees only the state when it looks.
  await ui.evaluate(() => {
    const w = window as any, lit = () => document.querySelector<HTMLElement>('#taskTabs [role="tab"][aria-selected="true"]')?.dataset.task ?? '';
    w.__lit = [lit()];
    w.__litObs = new MutationObserver(() => w.__lit.push(lit()));
    w.__litObs.observe(document.getElementById('taskTabs'), { attributes: true, attributeFilter: ['aria-selected'], subtree: true });
  });
  // Pressed where the hand does it, on its name; shown while the button is still down.
  await taskTab(ui, second).hover();
  await ui.mouse.down();
  await nthShown(core, 2);
  await notLoading(ui);
  expect([...new Set(await ui.evaluate(() => { const w = window as any; w.__litObs.disconnect(); return w.__lit as string[]; }))], 'lit once, no blink').toEqual([first, second]);
  await ui.mouse.up();
  // Focused by the press, not ringed as by the keyboard (BrowserTabs.tsx). Playwright has no :focus-visible check.
  await expect(taskTab(ui, second)).toBeFocused();
  expect(await taskTab(ui, second).evaluate((t) => t.matches(':focus-visible')), 'no focus ring after a press').toBe(false);
  await taskTab(ui, second).blur(); // a real press leaves the keyboard on the tab; a later dialog takes it from nothing
});

test("tasks: a double click on a task's tab is its Rename…, the shown one's and another's (its first press shows it)", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call, shown: 2 });
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  for (const key of [second, first]) {
    const tab = taskTab(ui, key);
    const name = await tab.textContent();
    const renaming = ui.getByRole('dialog', { name: 'Rename Task' });
    await tab.dblclick();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(renaming).toBeVisible();
    await expect(renaming.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
    await notLoading(ui);
    await expect(renaming, 'still open once the grid is shown').toBeVisible();
    await ui.keyboard.press('Escape');
    await expect(renaming).toHaveCount(0);
  }
});

test('menus: one longer than the window has stays in it and scrolls', async ({ core, ui }) => {
  // A menu longer than the window (thirty closed tasks) must not run past its edge, its first rows out of reach
  // above. Any menu: ☰'s here, in the lowest window.
  const before = await resize(core, { height: 400 });
  try {
    await expect.poll(() => ui.evaluate(() => innerHeight)).toBeLessThanOrEqual(400); // Playwright knows no viewport here (noDefaults)
    await ui.locator('#windowMenu').click();
    await expect(menu(ui)).toBeInViewport({ ratio: 1 });
    // Its rows scroll, in the menu itself (Playwright reads no scroll).
    expect(await menu(ui).evaluate((m) => m.scrollHeight > m.clientHeight)).toBe(true);
    await closeMenu(ui);
  } finally { await resize(core, before); }
});

test("tasks: with one project the bar's + makes a new task of it in one click", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const before = await core((k) => k.shell.current.tasks.size), first = await keyAt(core, 1);
  await expect(ui.locator('#newTask')).toHaveAccessibleName('New task');
  await ui.locator('#newTask').hover();
  await expect(ui.getByRole('tooltip')).toBeVisible();
  await ui.locator('#newTask').click();
  await expect(ui.getByRole('tooltip'), 'gone as it is pressed').toBeHidden();
  await expect.poll(() => core((k, a) => k.shell.current.tasks.size === a.before + 1 && k.shell.task?.key !== a.first && k.settled(), { before, first }), { timeout: 20000 }).toBe(true);
  await expect(ui.getByRole('menu'), 'no menu: made at once').toHaveCount(0);
  await expect(ui.locator('#taskTabs [role="tab"]')).toHaveCount(before + 1);
  await taskTab(ui, first).click();
  await nthShown(core, 1);
});

test("tasks: with several projects the bar's + asks which (one not loaded too), the sidebar's project's + makes it a new task, and a task's 🗑 deletes it after the question", async ({ core, ui, files, call }) => {
  // About 1 s: git's work (a second project made and deleted).
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A second project, open.
  const plus2 = path.join(files.root, `plus2-${rand()}`);
  committed(plus2, 'a.txt', 'a', 'mine');
  const made = await invoke(ui, 'project:new', { from: 'folder', folders: [plus2], name: 'Plus2' });
  expect(made.id, 'the second project is made').toBeTruthy();
  // The bar's + asks which project: each with its icon, the shown task's first (worked in last) with Ctrl+Shift+N, the
  // key's. Plus2, not loaded yet, gets its first task.
  await ui.locator('#newTask').click();
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "project"
      - menuitem "Plus2"
  `);
  await expect(item(ui, 'project')).toContainText(MAC ? '⇧⌘N' : 'Ctrl+Shift+N');
  await expect(item(ui, 'Plus2').getByTestId('project-icon')).toBeVisible();
  await choose(ui, 'Plus2');
  const on = () => core((k, id) => k.shell.current?.id === id && k.settled(), made.id);
  await expect.poll(async () => (await on()) && core((k) => !!k.shell.pty), { timeout: 10000 }).toBe(true);
  await notLoading(ui);
  const tasks2 = () => core((k, id) => k.shell.store.tasksOf(k.shell.store.projects().find((x) => x.id === id)).list.length, made.id);
  // A project's + (on its row, under the pointer) makes a new task of it and closes the sidebar.
  const before = await tasks2();
  await fromSidebar(ui, 'Plus2');
  await expect.poll(async () => (await tasks2()) === before + 1 && on(), { timeout: 10000 }).toBe(true);
  await expect(sidebar(ui)).toHaveCount(0);

  // Each task row carries a 🗑 (on the row under the pointer) that deletes the task after the Delete Task… question
  // (Cancel keeps it).
  await openSidebar(ui);
  await (await rowButton(taskRow(ui, 'project', 'Feature-X'), 'Delete Task…')).click();
  expect((await answer(ui, false)).message).toBe('Delete the task Feature-X?');
  await closeSidebar(ui);

  // The second project removed; back to project's task-1 shown.
  const deleted = invoke(ui, 'project:delete', { id: made.id });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, id) => !k.shell.open.has(id), made.id)).toBe(true);
  // Once its task's shell has left it: Windows does not remove a process's folder.
  await removed(plus2);
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded, files.pid('project'))).toBe(true);
  await taskTab(ui, await keyAt(core, 1)).click();
  await nthShown(core, 1);
});
