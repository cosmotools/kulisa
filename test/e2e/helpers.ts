// What the e2e files share: the test site, the OS, and driving the window as the human does (its menus, the tasks' bar,
// its dialogs, Settings, the terminal). Locators and web-first assertions, which wait (docs/testing.md, End to end).
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Core, Call, Where } from './fixtures.ts';
import { removeTree } from '../../src/main/remove.ts';
import type { Files } from './data.ts';

// The run's test site (global-setup.ts), on a free port: never a literal port (CLAUDE.md, Hard-won facts).
export const SITE = process.env.KULISA_TEST_SITE;
export const PORT = SITE && new URL(SITE).port; // none while Playwright only lists the tests (no global setup)
// The checkout the tests run from.
export const CHECKOUT = path.join(import.meta.dirname, '..', '..');
// The checkout's own folder for the tests' Kulisas, a folder each named with its worker's pid: worktrees run their tests
// at once (CLAUDE.md, Worktrees). The temporary folder by its real name: Windows may give it by a short one (C:\Users\COSMOT~1).
export const BASE = path.join(fs.realpathSync.native(os.tmpdir()), `kulisa-e2e-${path.basename(CHECKOUT)}-${crypto.createHash('sha1').update(CHECKOUT).digest('hex').slice(0, 6)}`);
export const MAC = process.platform === 'darwin';
// What Windows does its own way: the user's shell is PowerShell (src/terminal), a right-click's menu opens on the
// release, the terminal copies and pastes with Ctrl+C / V.
export const WIN = process.platform === 'win32';
// An attribute's value in a selector, as a CSS string: a Windows path's backslashes are CSS escapes.
export const attr = (name: string, value: string) => `[${name}=${JSON.stringify(value)}]`;
export const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
// A promise's answer, or null when it has none within ms: a wait with an end, not a pause (an action repeated until it
// takes, a call that must answer in time).
export const upTo = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => { setTimeout(() => r(null), ms); })]);
// A text whole, as a pattern (a label, a name).
export const exact = (s: string) => new RegExp(`^${RegExp.escape(s)}$`);
// How many lines of Kulisa's log since the test began match (driver.ts, logged: no file read).
export const logged = (core: Core, re: RegExp) => core((k, a) => k.logged.filter((l) => new RegExp(a.source, a.flags).test(l)).length, { source: re.source, flags: re.flags });
// The Kulisa zoom of the first window.
export const uiZoom = (core: Core) => core((k) => k.shell.win.webContents.getZoomFactor());

// A channel of the window's, as its page sends it (a part tested elsewhere, or one with no control of its own), and an
// action on the shown task's profiles, as the renderer sends it (lib/store.ts, act). What they answer ({ error } when
// refused).
export const invoke = (page: Page, channel: string, arg?: unknown) => page.evaluate(([c, a]) => (window as any).kulisa.invoke(c, a), [channel, arg] as const);
export const act = (page: Page, channel: string, arg: unknown) => page.evaluate(([c, a]) => (window as any).act(c, a), [channel, arg] as const);
// The window done building what it shows (a project, a task: the grid's region busy; none before the window is up), and
// its grid done sliding to another task (a view transition: a key or a click meanwhile goes to the grid being left).
export const notLoading = (page: Page) => expect(page.locator('#dock:not([aria-busy])')).toHaveCount(1);
export const noSlide = (page: Page) => expect(page.locator(':root:active-view-transition')).toHaveCount(0);
// That nothing happened is checked once what would have made it is done (docs/testing.md, Writing an e2e test): each
// of these waits for a proof of that, never for a time.
// The page drew what its last changes made: Vue's updates, a ResizeObserver's, what waits for a frame.
export const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
// Every message the page sent the main process before now is handled there, and every one the main process sent the
// page before it handled is handled in the page: a channel's round trip, on the one pipe that keeps their order.
export const ipcSettled = async (page: Page) => { await page.evaluate(() => (window as any).kulisa.invoke('zoom:get')); };
// act sends the page an input event of type (as the hand does, through the main process): once the page has it, every
// handler of it has run (they run in its one dispatch), and what they changed is drawn.
export async function seen(page: Page, type: string, act: () => Promise<unknown>) {
  await page.evaluate((t) => { const w = window as any; w.__seen = false; addEventListener(t, () => { w.__seen = true; }, { capture: true, once: true }); }, type);
  await act();
  await expect.poll(() => page.evaluate(() => (window as any).__seen), { message: `the page got no ${type}` }).toBe(true);
  await frames(page);
}
// Everything written into the shown task's agent's terminal before now has come back (the terminal echoes its input in
// the order it came): a mark typed (or sent as send sends it), waited for in its output (or on the screen, by shows),
// then rubbed out.
type Echo = { shows?: () => Promise<string>; send?: (mark: string) => Promise<unknown> };
export async function echoed(core: Core, { shows, send }: Echo = {}) {
  const mark = `kl${Math.random().toString(36).slice(2, 8)}`;
  await (send ? send(mark) : core((k, m) => k.shell.pty.write(m), mark));
  if (shows) await expect.poll(shows, { message: 'the terminal does not echo' }).toContain(mark);
  else await expect.poll(() => core((k, m) => k.ptyOutput().includes(m), mark), { message: 'the terminal does not echo' }).toBe(true);
  await core((k, n) => k.shell.pty.write('\x7f'.repeat(n)), mark.length);
  return mark;
}

// A press on an element as the hand makes it (CDP's input), dated a second back, and its release when called: the
// page's events carry the time, so a hold is told from a click without waiting for one.
export async function holdPointer(page: Page, target: Locator) {
  const b = await target.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, timestamp: Date.now() / 1000 - 1 });
  return async () => { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await cdp.detach(); };
}

// Another tasks' window's page than ui (the one showing sel, when named), once Playwright has it.
export async function otherPage(ui: Page, sel?: string) {
  let found: Page | undefined;
  await expect.poll(async () => {
    for (const p of ui.context().pages()) {
      if (p !== ui && !p.isClosed() && p.url().includes('/index.html') && (!sel || await p.locator(sel).count())) { found = p; return true; }
    }
    return false;
  }).toBe(true);
  return found;
}

// Kulisa's question in page's dialog (Ask.vue), answered as the human answers it: true its button that does it (the
// last), false the one that does not (Cancel, Later), or a button by its name. What it asked.
export async function answer(page: Page, yes: boolean | string = true) {
  const d = page.getByRole('alertdialog');
  await expect(d).toBeVisible();
  const asked = { message: await d.getByRole('heading').textContent(), detail: await page.locator(`#${await d.getAttribute('aria-describedby')}`).textContent() };
  const buttons = d.locator('[data-slot="alert-dialog-footer"] button');
  await (typeof yes === 'string' ? d.getByRole('button', { name: yes, exact: true }) : yes ? buttons.last() : buttons.first()).click();
  await expect(d).toBeHidden();
  return asked;
}

// A dialog's × (shadcn-vue's: the content's own close, not one in its buttons).
export const closeX = (dialog: Locator) => dialog.locator(':scope > [data-slot="dialog-close"]');

// Kulisa's menus (Reka's, docs/ui.md, Menus): the open one once it is shown (the pages under it are pictures), the
// submenu open (the last one).
export const menu = (ui: Page) => ui.locator('[role="menu"][data-state="open"][data-ready]').first();
export const submenu = (ui: Page) => ui.locator('[role="menu"][data-state="open"]').last();
// An item of the open menu (or of which) by its label, whole.
export const item = (ui: Page, label: string, which: Locator = menu(ui)) => which.getByRole('menuitem', { name: label, exact: true }).or(which.getByRole('menuitemradio', { name: label, exact: true }));
export const choose = (ui: Page, label: string, which?: Locator) => item(ui, label, which).click();
// The open menu closed as Esc does; no menu or list open after.
export async function closeMenu(ui: Page) {
  await ui.keyboard.press('Escape');
  await expect(ui.locator('[data-state="open"]:is([role="menu"], [role="listbox"])')).toHaveCount(0);
}
// A right-click as the mouse makes it, at an element's middle (its press closes a menu open elsewhere; on Windows the
// menu opens on the release).
export const rightClick = (ui: Page, sel: string | Locator) => (typeof sel === 'string' ? ui.locator(sel) : sel).first().click({ button: 'right' });

// The window given the keyboard as the human's click gives it, once its page has it: on a loaded machine the window
// manager focuses the window and its page learns it later, and macOS gives the keyboard back to the view that had it
// (a profile's page), over this: given again until the page has it.
export async function focusWindow(core: Core, ui: Page) {
  await core((k) => k.focus());
  await expect.poll(async () => (await ui.evaluate(() => document.hasFocus())) || (await core((k) => k.focus()), false)).toBe(true);
}

// The tasks' bar's tabs (one per open task): each its project, by its folder's name, the shown one with ' *'.
export const projectTabs = async (ui: Page, files: Files) => (await ui.locator('#projectTabs [role="tab"]').evaluateAll((ts) => ts.map((t) => (t as HTMLElement).dataset.project + (t.ariaSelected === 'true' ? ' *' : '')))).map(files.named);
// The island's terminals' tabs: each its name, the one in front with ' *'.
export const termTabs = (ui: Page) => ui.locator('nav[aria-label="Terminals"] [role="tab"]').evaluateAll((ts) => ts.map((t) => t.textContent.trim() + (t.ariaSelected === 'true' ? ' *' : '')));
// A project's first tab in the bar; the project shown again as the human does it, a click on it; its open tasks
// closed with the middle button on each tab.
// As a selector, for a script in the page.
export const projectTabSel = (files: Files, folder: string) => `#projectTabs [data-project="${files.pid(folder)}"]`;
export const projectTab = (ui: Page, files: Files, folder: string) => ui.locator(projectTabSel(files, folder)).first();
export const showProject = (ui: Page, files: Files, folder: string) => projectTab(ui, files, folder).click();
export async function closeProject(ui: Page, files: Files, folder: string) {
  for (const key of await ui.locator(projectTabSel(files, folder)).evaluateAll((ts) => ts.map((t) => (t as HTMLElement).dataset.task))) {
    await ui.locator(`#projectTabs [data-task="${key}"]`).click({ button: 'middle' });
  }
}

// Every open menu, a submenu too (menu waits for the first to be shown).
export const anyMenu = (ui: Page) => ui.locator('[role="menu"][data-state="open"]');

// The sidebar (ProjectsSidebar.vue): every project a group of its tasks, New Project… at its foot; docked in the empty
// window, over the grid from the title bar's button. sidebar(ui) opens it and gives it; fromSidebar(ui, project) makes
// a new task of that project (its +); fromSidebar(ui, project, task) opens that task (again). closeSidebar closes it.
const sheet = (ui: Page) => ui.locator('[data-slot="sheet-content"]');
export async function sidebar(ui: Page) {
  await expect(sheet(ui).and(ui.locator('[data-state="closed"]')), 'not one fading out').toHaveCount(0);
  if (!(await ui.locator('#projects').count())) await ui.locator('#sidebarToggle').click();
  await expect(ui.locator('#projects')).toBeVisible();
  return ui.locator('#projects');
}
export const sidebarProject = (ui: Page, project: string) => ui.locator('#projects').getByRole('group', { name: project, exact: true });
export const sidebarTask = (ui: Page, project: string, task: string) => sidebarProject(ui, project).locator('[data-task]').and(ui.getByRole('button', { name: task, exact: true }));
// A project's tasks in the sidebar, by their names, in its order.
export const sidebarRows = (ui: Page, projectId: string) => ui.locator(`#projects [data-project="${projectId}"] [data-task]`).evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label')));
export async function fromSidebar(ui: Page, project: string, task?: string) {
  await sidebar(ui);
  await (task === undefined ? sidebarProject(ui, project).locator('[data-sidebar="group-action"]') : sidebarTask(ui, project, task)).click();
}
export async function closeSidebar(ui: Page) {
  if (await sheet(ui).count()) await sheet(ui).press('Escape');
  await expect(sheet(ui)).toHaveCount(0);
}
// A project's submenu (a tab's right-click, then the row of the project's name, the one row opening a menu), open.
export async function projectMenu(ui: Page, tab = '#projectTabs [aria-selected="true"]') {
  await rightClick(ui, tab);
  await menu(ui).locator('[role="menuitem"][aria-haspopup]').click();
  await expect(anyMenu(ui)).toHaveCount(2);
  return submenu(ui);
}
// The shown task's tab's right-click menu, where its profiles are, open.
export async function taskMenu(ui: Page) {
  await rightClick(ui, '#projectTabs [aria-selected="true"]');
  await expect(menu(ui)).toBeVisible();
  return menu(ui);
}

// The panels arranged as the human does it: ☰ → Arrange panels.
export async function arrange(ui: Page, preset: 'columns' | 'grid' | 'focus') {
  await ui.locator('#windowMenu').click();
  await menu(ui).locator(`[data-preset="${preset}"]`).click();
}
// The window resized as the human drags its edge (by its page's size), its size before given back.
export const resize = (core: Core, size: { width?: number; height?: number }) => core((k, s) => {
  const [width, height] = k.shell.win.getContentSize();
  k.shell.win.setContentSize(s.width ?? width, s.height ?? height);
  return { width, height };
}, size);

// Settings → Profiles: the shown task's tab's menu, then Manage Profiles…; once its window shows the page.
export async function manageProfiles(ui: Page, sui: () => Promise<Page>) {
  await taskMenu(ui);
  await choose(ui, 'Manage Profiles…');
  const s = await sui();
  await expect(s.locator('#prconfig')).toBeVisible();
  return s;
}
// A profile in Settings' tree chosen (a click), its page shown.
export async function chooseProfile(s: Page, files: Files, name: string) {
  const row = s.locator(`#pjlist [data-profile="${files.idOf(name)}"]`);
  await row.click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(s.locator('#profilepage')).toBeVisible();
}
// Settings closed as the human does it with Esc, what was typed saved; its window gone, the keyboard back in the task's
// window, the window's and its page's (a menu opened there before it comes closes as the window gets it). The key's
// promise is not waited for: its page closes under it.
export async function closeSettings(core: Core, ui: Page, sui: () => Promise<Page>) {
  const s = await sui();
  void s.keyboard.press('Escape').catch(() => {});
  await settingsClosed(core, ui);
}
// A text field typed as the human types it, and left (a change) when leave.
export async function typeIn(page: Page, sel: string, value: string, leave = false) {
  await page.locator(sel).fill(value);
  if (leave) await page.locator(sel).dispatchEvent('change');
}
// Settings' project page shown: its name in place at its top.
export async function pageOf(s: Page, name: string) {
  await expect(s.locator('#pjname')).toHaveValue(name);
  await expect(s.locator('#pjhead')).toBeVisible();
}
// A list's row selected (a click), then a button of its toolbar acting on it (− removes, ★ makes it the default).
export async function onRow(s: Page, row: string, button: string) {
  await s.locator(row).click();
  await expect(s.locator(row)).toHaveAttribute('aria-selected', 'true');
  await expect(s.locator(button)).toBeEnabled();
  await s.locator(button).click();
}
// However it closed (Esc, the OS's ×).
export async function settingsClosed(core: Core, ui: Page) {
  await expect.poll(() => core((k) => !k.shell.settings)).toBe(true);
  await expect.poll(async () => (await core((k) => k.shell.win.isFocused())) && ui.evaluate(() => document.hasFocus()), { message: 'the task\'s window has the keyboard back' }).toBe(true);
}

// The window is a grid of peer panels (dockview): a pane per profile and the terminal. A profile's page is a native view
// laid over its pane's .content box, so after any change in the grid it must follow the box (driver.ts, viewOn).
// None while it is not there: a wait that polls it ends.
export const box = async (ui: Page, sel: string) => {
  const r = await ui.locator(sel).count() === 1 ? await ui.locator(sel).boundingBox() : null;
  return r && { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
};
export const pageBox = (ui: Page, files: Files, name: string) => box(ui, `[role="region"][data-profile="${files.idOf(name)}"] [data-testid="page"]`);
export const viewOn = async (core: Core, ui: Page, files: Files, name: string) => core((k, a) => k.viewOn(a.name, a.box), { name, box: await pageBox(ui, files, name) });
// dockview's API, as the window keeps it for the tests (window.__dock), given to fn with an argument.
export const dock = <A, R>(ui: Page, fn: (api: any, arg: A) => R, arg?: A) => ui.evaluate(([src, a]) => (0, eval)(`(${src})`)((window as any).__dock, a), [fn.toString(), arg] as const) as Promise<R>;
// The Resources island's height on screen (its group in the grid: lib/grid.ts).
export const resourcesHeight = (ui: Page) => ui.evaluate(() => Math.round(document.getElementById('resources').closest('.dv-groupview').getBoundingClientRect().height));

// Who the test site says is signed in, in a profile's page, as the agent (of the window's task, or of where) reads it.
export const who = async (call: Call, profile: string, where?: Where) => (await call('browser_snapshot', { profile }, where)).text.match(/Signed (in as \w+|out)/)?.[0];

// The shown terminal's keyboard (xterm's own field; the others' terminals are kept hidden).
export const termKeys = (ui: Page) => ui.locator('[data-testid="terminal"] .xterm:visible .xterm-helper-textarea');
// What the terminal in the window shows ('' while none is shown yet), as the screen reads: lines wrapped at its width
// joined again, and each line's trailing spaces dropped (ConPTY pads a line repainted after a resize). With a text, only
// whether it is there: the screen's text stays in the page.
const screenText = (t: string | null) => {
  const b = (window as any).__term?.buffer.active;
  const all = !b ? '' : Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l: any, i) => (i && !l.isWrapped ? '\n' : '') + l.translateToString(true)).join('')
    .split('\n').map((l) => l.replace(/ +$/, '')).join('\n');
  return t === null ? all : all.includes(t);
};
export const termText = (ui: Page) => ui.evaluate(screenText, null) as Promise<string>;
// The terminal's xterm as it is: its size, its cursor, its lines up to the cursor and every one with text, each with its
// number and a ~ when it continues the one before (wrapped): what a failed wait on the terminal says.
export const termDump = (ui: Page) => ui.evaluate(() => {
  const t = (window as any).__term, b = t?.buffer.active;
  if (!b) return 'no terminal shown';
  const lines = Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l: any, i) => `${i}${l.isWrapped ? '~' : ' '}|${l.translateToString(true)}`);
  return { cols: t.cols, rows: t.rows, length: b.length, cursor: [b.cursorX, b.cursorY], baseY: b.baseY,
    lines: lines.filter((l, i) => i <= b.baseY + b.cursorY + 2 || l.length > 4).slice(0, 40) };
});
export async function termShows(ui: Page, text: string, timeout = 5000) {
  try { await expect.poll(() => ui.evaluate(screenText, text), { timeout }).toBe(true); } catch (e) {
    throw new Error(`the terminal does not show ${JSON.stringify(text)}: ${JSON.stringify(await termDump(ui))}`, { cause: e });
  }
}

// A folder of the test's removed, once nothing holds it: on Windows a folder a process was in (Kulisa's git, a shell)
// cannot go until that process lets go (docs/testing.md, On Windows).
export const removed = (...dirs: string[]) => expect(() => { for (const d of dirs) removeTree(d); }).toPass();
// A file renamed once nothing holds it: Windows refuses (EBUSY, EPERM) while a process runs it, as an agent's .cmd that
// a look at the agents' versions runs a moment longer (docs/testing.md, On Windows).
export const renamed = (from: string, to: string) => expect.poll(() => {
  try { fs.renameSync(from, to); return true; } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EBUSY' || (e as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw e;
  }
}).toBe(true);
