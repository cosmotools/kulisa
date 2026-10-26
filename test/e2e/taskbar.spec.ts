// The tasks' bar: a tab per open task, switching between them (by a click, a press, the keys), the slide, more tabs than
// it holds, the agent's state on a tab, its + with several projects (docs/tasks.md, docs/window.md).
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import { MAC, sleep, menu, menuRows, choose, closeMenu, rightClick, plusMenu, focusWindow, viewOn, termShows, invoke, notLoading, noSlide, asked, mouse, mid } from './helpers.ts';
import { committed, rand, keyAt, isNth, nthShown, taskTab, hook, begin } from './tasks-helpers.ts';
import { removeTree } from '../../src/main/remove.ts';

const chosen = (ui: Page) => ui.evaluate(() => document.querySelector<HTMLElement>('#projectTabs .tasktab.active')?.dataset.task ?? '');

test("tasks: switching shows the other grid and terminal; the one left keeps running; the agent's state shows on its tab", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call, shown: 2 });
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
    const g = k.stash;
    g.openPath = k.electron.shell.openPath; g.shown = [];
    k.electron.shell.openPath = async (dir: string) => { g.shown.push(dir); return ''; };
  });
  try {
    await rightClick(ui, taskTab(ui, second).locator('.name'));
    const rows = await menuRows(ui) as string[];
    expect([rows[0], ...rows.slice(-12)]).toEqual(['# Profiles', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'project']);
    expect(rows.slice(1, -12).toSorted(), 'its open and closed profiles').toEqual(['Dora', 'Elon.buyer', 'Sam.admin']);
    await choose(ui, 'Show Folder');
    await expect.poll(() => core((k) => k.stash.shown.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  const [shown, folder] = await core((k, key) => [k.stash.shown[0], k.shell.taskByKey(key).folder], second);
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
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
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
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
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
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
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
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  const nameOf = (key: string) => mid(core, ui, `#projectTabs .tasktab[data-task="${key}"] .name`); // where the hand presses a tab
  // The slide that showing a task starts makes Chromium drop a drag about to begin: a tab not shown would not be
  // dragged, its press only showing it. One begun goes on through the slide.
  await noSlide(ui); // the slide's pictures over the window take every event
  await mouse(core, 'mouseDown', await nameOf(second));
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
  await mouse(core, 'mouseUp', await nameOf(second));
  await nthShown(core, 2);
  await noSlide(ui);
  expect([...new Set(await ui.evaluate(() => { const w = window as any; w.__litObs.disconnect(); return w.__lit as string[]; }))], 'the tab lit from the press to the task shown, no other').toEqual([second]);
  // A drag begins: Chromium cancels the pointer (a real drag of a tab is the OS's, out of a test's reach).
  await mouse(core, 'mouseDown', await nameOf(first));
  await expect.poll(() => chosen(ui)).toBe(first);
  await ui.evaluate(() => dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' })));
  await nthShown(core, 1);
  await mouse(core, 'mouseUp', await nameOf(first));
  await ui.evaluate(() => (document.activeElement as HTMLElement).blur()); // a real press leaves the keyboard on the tab (Reka's); a later dialog takes it from nothing
});

test("tasks: a double click on a task's tab is its Rename…", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
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
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A second project, open, so the + nests each project as a submenu (one project shows its tasks inline).
  const plus2 = path.join(files.root, `plus2-${rand()}`);
  committed(plus2, 'a.txt', 'a', 'mine');
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
