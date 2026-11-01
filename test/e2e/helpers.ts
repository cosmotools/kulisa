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

export async function showResources(ui: Page, section: 'Project' | 'Artifacts' | 'Agents' | 'Changes') {
  const icon = ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: section, exact: true });
  if (await icon.getAttribute('aria-expanded') !== 'true') await icon.click();
}

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
// The window done building what it shows (a project, a task: the grid's region busy; none before the window is up).
export const notLoading = (page: Page) => expect(page.locator('#dock:not([aria-busy])')).toHaveCount(1);
// That nothing happened is checked once what would have made it is done (docs/testing.md, Writing an e2e test): each
// of these waits for a proof of that, never for a time.
// The page drew what its last changes made: React's updates, a ResizeObserver's, what waits for a frame.
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

// Kulisa's question in page's dialog (components/Ask.tsx), answered as the human answers it: true its button that does it (the
// last), false the one that does not (Cancel, Later), or a button by its name. What it asked.
export async function answer(page: Page, yes: boolean | string = true) {
  const d = page.getByRole('alertdialog');
  await expect(d).toBeVisible();
  const asked = { message: await d.getByRole('heading').textContent(), detail: await page.locator(`#${await d.getAttribute('aria-describedby')}`).textContent() };
  const buttons = d.getByRole('button');
  await (typeof yes === 'string' ? d.getByRole('button', { name: yes, exact: true }) : yes ? buttons.last() : buttons.first()).click();
  await expect(d).toBeHidden();
  return asked;
}

// Kulisa's menus (docs/ui.md, Menus; components/Menus.tsx): the open one once it is shown (data-ready: the pages under
// it are pictures, lib/cover.ts; data-state: not one closing), the submenu open (the last one).
export const menu = (ui: Page) => ui.locator('[role="menu"][data-ready][data-state="open"]').first();
export const submenu = (ui: Page) => ui.locator('[role="menu"][data-ready][data-state="open"]').last();
// An item of the open menu (or of which) by its label, whole.
export const item = (ui: Page, label: string, which: Locator = menu(ui)) => which.getByRole('menuitem', { name: label, exact: true }).or(which.getByRole('menuitemradio', { name: label, exact: true }));
export const choose = (ui: Page, label: string, which?: Locator) => item(ui, label, which).click();
// The open menu closed as Esc does; no menu open after.
export async function closeMenu(ui: Page) {
  await ui.keyboard.press('Escape');
  await expect(ui.getByRole('menu')).toHaveCount(0);
}
// Keyboard Shortcuts (components/Shortcuts.tsx), and the keys a row of it shows by its label (or what it says while it
// waits for the key).
export const shortcutsDialog = (ui: Page) => ui.getByRole('dialog', { name: 'Keyboard Shortcuts' });
export const shortcutKeys = (ui: Page, label: string) => shortcutsDialog(ui).getByRole('row').filter({ has: ui.getByRole('cell', { name: label, exact: true }) }).locator('[data-key]');
// A row of ☰ that opens a menu beside it (Theme, Tasks bar, Language), opened, the pointer moved into it as a hand moves
// it; that menu. Radix keeps it open as the pointer leaves the row only toward the side the last moves inside ☰ went:
// a move in one step tells none, and a menu on the row's left (macOS: ☰ at the window's edge) closed on the way to it.
export async function windowSubmenu(ui: Page, row: string) {
  if (!(await menu(ui).count())) await ui.locator('#windowMenu').click();
  await item(ui, row).click();
  const sub = ui.getByRole('menu', { name: row, exact: true });
  await expect(sub).toBeVisible();
  const b = await sub.boundingBox();
  await ui.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  return sub;
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
export const tabProjects = async (ui: Page, files: Files) => (await ui.locator('#taskTabs [role="tab"]').evaluateAll((ts) => ts.map((t) => (t as HTMLElement).dataset.project + (t.ariaSelected === 'true' ? ' *' : '')))).map(files.named);
// Resources’ terminal rows: each its name, the one in front with ' *'.
export const terminalRows = (ui: Page) => ui.locator('#resources [data-terminal] [data-sidebar="menu-button"]').evaluateAll((ts) => ts.map((t) => t.getAttribute('aria-label') + (t.getAttribute('aria-current') === 'true' ? ' *' : '')));
// A project's first tab in the bar; the project shown again as the human does it, a click on it; its open tasks
// closed with the middle button on each tab.
// As a selector, for a script in the page.
export const projectTabSel = (files: Files, folder: string) => `#taskTabs [data-project="${files.pid(folder)}"]`;
export const projectTab = (ui: Page, files: Files, folder: string) => ui.locator(projectTabSel(files, folder)).first();
export const showProject = (ui: Page, files: Files, folder: string) => projectTab(ui, files, folder).click();
export async function closeProject(ui: Page, files: Files, folder: string) {
  for (const key of await ui.locator(projectTabSel(files, folder)).evaluateAll((ts) => ts.map((t) => (t as HTMLElement).dataset.task))) {
    await ui.locator(`#taskTabs [data-task="${key}"]`).click({ button: 'middle' });
  }
}

// Every open menu, a submenu too (menu waits for the first to be shown).
export const anyMenu = (ui: Page) => ui.getByRole('menu');
// The sidebar (components/Sidebar.tsx; docs/tasks.md, The sidebar): every project with its tasks, a group each. Docked in
// the empty window; over the grid opened with its button in the tasks' bar, closed by a choice or Esc. openSidebar gives it, open.
export const sidebar = (ui: Page) => ui.getByRole('navigation', { name: 'Projects' });
export async function openSidebar(ui: Page) {
  if (!(await sidebar(ui).count())) await ui.locator('#taskbar').getByRole('button', { name: 'Projects and tasks' }).click();
  await expect(sidebar(ui)).toBeVisible();
  return sidebar(ui);
}
export async function closeSidebar(ui: Page) {
  if (await ui.locator('html:not([data-page="task"])').count()) return; // docked: always there
  if (await sidebar(ui).count()) await sidebar(ui).press('Escape');
  await expect(sidebar(ui)).toHaveCount(0);
}
// A project's row (its tasks under it), by its name; a task's under it.
export const projectRow = (ui: Page, project: string) => sidebar(ui).getByRole('group', { name: project, exact: true }).and(ui.locator('[data-project]'));
export const taskRow = (ui: Page, project: string, task: string) => projectRow(ui, project).getByRole('button', { name: task, exact: true }).and(ui.locator('[data-task]'));
// A project's tasks in the sidebar, by their names, in its order.
export const sidebarTasks = (ui: Page, project: string) => projectRow(ui, project).locator('[data-task]').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label')));
// A row's own buttons, shown under the pointer: hovered at its start, where its name is (not its tasks under it). A
// task's are beside its row's button, in its list item.
export async function rowButton(row: Locator, name: string) {
  await row.hover({ position: { x: 48, y: 8 } });
  return row.locator('xpath=ancestor-or-self::*[self::li or @data-project][1]').getByRole('button', { name, exact: true }).first();
}
// From the sidebar as the human does it: a new task of the project (+ on its row), or one of its tasks opened again (a
// closed one) or shown.
export async function fromSidebar(ui: Page, project: string, task?: string) {
  await openSidebar(ui);
  if (task) return taskRow(ui, project, task).first().click();
  await (await rowButton(projectRow(ui, project), `New Task of ${project}`)).click();
}
// A project's submenu (a tab's right-click, then the row of the project's name, the one row opening a menu), open.
export async function projectMenu(ui: Page, tab = '#taskTabs [aria-selected="true"]') {
  await rightClick(ui, tab);
  await menu(ui).locator('[role="menuitem"][aria-haspopup]').click();
  await expect(anyMenu(ui)).toHaveCount(2);
  return submenu(ui);
}
// The shown task's tab's right-click menu, where its profiles are, open.
export async function taskMenu(ui: Page) {
  await rightClick(ui, '#taskTabs [aria-selected="true"]');
  await expect(menu(ui)).toBeVisible();
  return menu(ui);
}

// Stage placed relative to development panels through the title-bar menu.
export async function arrange(ui: Page, position: 'above' | 'left' | 'right') {
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await ui.getByRole('menuitemradio', { name: position[0].toUpperCase() + position.slice(1), exact: true }).click();
}
// The window resized as the human drags its edge (by its page's size), its size before given back.
export const resize = (core: Core, size: { width?: number; height?: number }) => core((k, s) => {
  const [width, height] = k.shell.win.getContentSize();
  k.shell.win.setContentSize(s.width ?? width, s.height ?? height);
  return { width, height };
}, size);

// Settings (components/settings): a category of its nav (projects, agents, profiles, github, log, about), the shown one
// aria-current; one thing's row on its category's page by its id; the shown
// page's path; a section of a page (its Card, a group) by its title; the open menu (Radix's: there only while open).
export const navRow = (s: Page, key: string) => s.getByRole('navigation', { name: 'Settings' }).locator(`[data-key="${key}"]`);
export const thingRow = (s: Page, id: string) => s.locator(`#settings main [data-row][data-key="${id}"]`);
export const pathOf = (s: Page) => s.getByRole('navigation', { name: 'Path' });
export const group = (s: Page, title: string) => s.getByRole('group', { name: title, exact: true });
export const settingsMenu = (s: Page) => s.getByRole('menu');
// One thing's page: its category's list, then its row.
export async function openThing(s: Page, category: 'projects' | 'agents' | 'profiles', id: string) {
  await navRow(s, category).click();
  await thingRow(s, id).click();
}
// The rows of a section of a page (its Card, a group) by its title, one by its name; a row's menu (its ⋯) and one of its actions.
export const listRows = (s: Page, list: string) => group(s, list).locator('[data-row]');
export const listRow = (s: Page, list: string, name: string) => group(s, list).locator(`[data-row][aria-label="${name}"]`);
export async function onRow(s: Page, row: string | Locator, action: string) {
  const r = typeof row === 'string' ? s.locator(row) : row;
  await r.getByRole('button', { name: /^More for / }).click();
  await choose(s, action);
}
// Settings → Profiles: the shown task's tab's menu, then Manage Profiles…; once Settings shows the page.
export async function manageProfiles(ui: Page, sui: () => Promise<Page>) {
  await taskMenu(ui);
  await choose(ui, 'Manage Profiles…');
  const s = await sui();
  await expect(pathOf(s)).toHaveText(/^Profiles/);
  return s;
}
// A profile's page shown from Settings' list of them (a click).
export async function chooseProfile(s: Page, files: Files, name: string) {
  await openThing(s, 'profiles', files.idOf(name));
  await expect(pathOf(s)).toHaveText(new RegExp(`^Profiles\\s*${RegExp.escape(name)}$`));
  await expect(s.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name);
}
// Settings closed as the human does it with Esc, what was typed saved; the grid back, the keyboard in the task's window.
export async function closeSettings(core: Core, ui: Page, sui: () => Promise<Page>) {
  const s = await sui();
  await s.keyboard.press('Escape');
  await settingsClosed(core, ui);
}
// A text field typed as the human types it, and left (a change; React's pages save as it loses the keyboard) when leave.
export async function typeIn(page: Page, sel: string | Locator, value: string, leave = false) {
  const field = typeof sel === 'string' ? page.locator(sel) : sel;
  await field.fill(value);
  if (leave) { await field.dispatchEvent('change'); await field.blur(); }
}
// Settings' project page shown: its name in its path and in its field.
export async function pageOf(s: Page, name: string) {
  await expect(pathOf(s)).toHaveText(new RegExp(`^Projects\\s*${RegExp.escape(name)}$`));
  await expect(s.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name);
}
// However it closed (Esc, its ×, the gear).
export async function settingsClosed(core: Core, ui: Page) {
  await expect(ui.locator('#settings')).toHaveCount(0);
  await expect.poll(async () => (await core((k) => k.shell.win.isFocused())) && ui.evaluate(() => document.hasFocus()), { message: 'the task\'s window has the keyboard' }).toBe(true);
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
// dockview's API, as the window keeps it for the tests (window.__dock), given to fn with an argument. Through a handle,
// not eval: the window's Content-Security-Policy refuses eval.
export async function dock<A, R>(ui: Page, fn: (api: any, arg: A) => R, arg?: A) {
  const api = await ui.evaluateHandle(() => (window as any).__dock);
  try { return await api.evaluate(fn as (api: any, arg: unknown) => R, arg); } finally { await api.dispose(); }
}
// Retained terminal content sits outside Dockview’s group DOM; the API owns its group’s box.
export const developmentBox = (ui: Page) => dock(ui, (api) => {
  const { left: x, top: y, width, height } = api.getPanel('terminal').group.api.boundingBox;
  const grid = document.getElementById('grid').getBoundingClientRect();
  return { x: grid.x + x, y: grid.y + y, width, height };
});
// The independent testing grid; development panels stay in dock().
export async function stageDock<A, R>(ui: Page, fn: (api: any, arg: A) => R, arg?: A) {
  const api = await ui.evaluateHandle(() => (window as any).__stage);
  try { return await api.evaluate(fn as (api: any, arg: unknown) => R, arg); } finally { await api.dispose(); }
}
// The Resources panel's height on screen (its group in the grid: lib/grid.ts).
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
