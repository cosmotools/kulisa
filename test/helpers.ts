// What the test files share: the test folder, the test site, waiting, and driving the window like the human.
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import electron from 'electron';
import type { WebContents } from 'electron';
import type { Shell } from '../src/main/shell.ts';
import type { Task } from '../src/main/tasks.ts';
import type { Ctx } from './run.ts';

// Script run in a window's page (webContents.executeJavaScript): what it gives back is the page's.
type UI = (js: string) => Promise<any>;

// The test folder: each group of files its own (start.ts), else kulisa-test.
const root = process.env.KULISA_TEST_ROOT || path.join(os.tmpdir(), 'kulisa-test');
const userData = path.join(root, 'data');
const project = path.join(root, 'project');

// A project's id is random (store.ts): a test names a project by the name of a folder of it, the one it was made from
// ('project', 'other'): the first, or another once a folder added before it is made the default. pid('other') is its id; tkey('other', 1) its first task's key; named(key) a key, or an id, back by the folder's name (and its task's place), to compare.
const projectsSaved = (): { id: string; folders: string[] }[] => JSON.parse(fs.readFileSync(path.join(userData, 'projects.json'), 'utf8')).list;
const folderName = (p: { folders: string[] }) => path.basename(p.folders[0]).toLowerCase();
const pid = (folder: string) => {
  const found = projectsSaved().filter((p) => p.folders.some((r) => path.basename(r).toLowerCase() === folder));
  assert.equal(found.length, 1, `one project in a folder named ${folder}`);
  return found[0].id;
};
// A task's id is random too: a test names a task by its place among its project's tasks, as made (tasks.json).
const tid = (folder: string, i: number): string => {
  const list = JSON.parse(fs.readFileSync(path.join(userData, 'projects', pid(folder), 'tasks.json'), 'utf8')).list;
  assert.ok(list[i - 1], `a task ${i} of ${folder}`);
  return list[i - 1].id;
};
const tkey = (folder: string, i: number) => `${pid(folder)}/${tid(folder, i)}`;
// A loaded project's task by its place, as made; whether a task is that one.
const taskAt = (p: { tasks: Map<string, Task> }, i: number): Task => [...p.tasks.values()][i - 1];
const isNth = (t: Task | null | undefined, i: number) => !!t && taskAt(t.project, i) === t;
const named = (key: string) => key.replace(/^([^/ ]+)(?:\/([^/ ]+))?/, (all, id: string, task?: string) => {
  const p = projectsSaved().find((x) => x.id === id);
  if (!p) return all;
  if (!task) return folderName(p);
  const at = JSON.parse(fs.readFileSync(path.join(userData, 'projects', id, 'tasks.json'), 'utf8')).list.findIndex((e: { id: string }) => e.id === task);
  return `${folderName(p)}/${at < 0 ? task : at + 1}`;
});
// A file of the test project's own data, of its first task (or of its task by place, or by id) (store.ts).
const pfile = (f: string, task: number | string = 1) => path.join(userData, 'projects', pid('project'), typeof task === 'string' ? task : tid('project', task), f);
// A profile's id is random (profile-store.ts): a test names a profile by its name, as the agent does (any case), and
// idOf gives its id, by which the window and the core know it (its folders, its panel, data-profile).
const idOf = (name: string): string => {
  const found = JSON.parse(fs.readFileSync(path.join(userData, 'profiles.json'), 'utf8')).list.filter((p: { name: string }) => p.name.toLowerCase() === name.toLowerCase());
  assert.equal(found.length, 1, `one profile named ${name}`);
  return found[0].id;
};
// The tabs saved for a profile (in its folder).
const savedTabs = (name: string, task = 1): string[] => savedFile(name, task).urls;
// The place of the tab saved as the one in front.
const savedActive = (name: string, task = 1): number => savedFile(name, task).active;
const savedFile = (name: string, task: number) => JSON.parse(fs.readFileSync(pfile(path.join(idOf(name), 'Kulisa Tabs.json'), task), 'utf8'));
// The id of a profile's panel in the grid.
const panel = (name: string) => `profile:${idOf(name)}`;
// The test site: the run's own (start.ts gives each run a free port), else 4417.
const SITE = process.env.KULISA_TEST_SITE || 'http://127.0.0.1:4417';
const PORT = new URL(SITE).port;
// The windows as settings.json keeps them for the next start: each one's tabs and the one shown.
// Its tasks' keys named by their projects' folders (named).
const savedWindows = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).windows.map(({ tabs, shown }: { tabs: string[]; shown: string | null }) => ({ tabs: tabs.map(named), shown: shown && named(shown) }));
// Where an agent's hooks report (tasks.ts, env): the agent's terminal of task, the one picks go to.
const hooksOf = (task: Task) => `${task.env(task.promptTarget()).KULISA_URL}/hooks`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// A window's screenshot (window.ts: the screen recorded, its profiles' views included), kept in the group's folder to
// look at. On macOS only with the screen recording permission, which is the app's that started the run (the terminal
// running npm test, not Electron): without it, said and not taken.
const canShoot = () => process.platform !== 'darwin' || electron.systemPreferences.getMediaAccessStatus('screen') === 'granted';
const NO_SHOT = 'macOS: the app that started the tests (the terminal) may not record the screen';
const shot = async (w: { screenshot(file: string): Promise<unknown> }, file: string) => {
  if (canShoot()) await w.screenshot(file); else console.log(`      (no ${path.basename(file)}: ${NO_SHOT})`);
};

// Kulisa's menus (Reka's, docs/ui.md, Menus): the open one, once it is shown (the pages under it are pictures);
// its rows ('-' a line, '# …' a heading, '~ …' a note, 'zoom' the zoom row; an item: its label, '(off)' when
// disabled, '  ' before it when it is set in under the row above); choose one by its label; close it as Esc does.
const MENU = `document.querySelector('.menu[data-state="open"]')`;
const SUBMENU = `[...document.querySelectorAll('.menu[data-state="open"]')].at(-1)`; // the submenu open (MenuRows.vue): the last one
const menuOpen = (ui: UI) => ui(`!!document.querySelector('.menu[data-state="open"].ready')`);
// The rows of the open menu (menu: SUBMENU for a submenu's), each as its words.
const menuRows = async (ui: UI, menu = MENU) => {
  await waitFor(() => menuOpen(ui));
  return ui(`(() => { const row = (r) => r.matches('[role="separator"]') ? '-' : r.matches('.heading') ? '# ' + r.textContent
    : r.matches('.zoomrow') ? 'zoom' : r.matches('.themerow') ? 'theme' : r.matches('.barrow') ? 'bar' : r.matches('.arrange') ? 'arrange: ' + [...r.querySelectorAll('span')].map((s) => s.textContent).join(', ')
    : r.matches('[role="group"]') ? [...r.children].map(row)
    : (r.matches('.inset') ? '  ' : '') + r.querySelector('.label').textContent + ((r.matches('.item') ? r : r.querySelector('.item')).matches('[data-disabled]') ? ' (off)' : '');
  return [...${menu}.children].flatMap(row); })()`);
};
const closeMenu = async (ui: UI) => {
  await ui(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`);
  await waitFor(async () => !(await ui(`!!document.querySelector('[data-state="open"]:is(.menu, [role="listbox"])')`)));
};
// The tasks' bar's tabs (one per open task): each its project, by its folder's name (named), the shown one with ' *'.
const projectTabs = async (ui: UI): Promise<string[]> => (await ui(`[...document.querySelectorAll('#projectTabs .tasktab')].map((t) => t.dataset.project + (t.classList.contains('active') ? ' *' : ''))`)).map(named);
// A project's first tab in the bar, the project by its folder's name.
const projectTab = (folder: string) => `document.querySelector('#projectTabs .tasktab[data-project="${pid(folder)}"]')`;
// A click as the mouse makes it (the press, the release, the click) on an element: tabs are chosen on the press
// (Reka's Tabs, as a browser's).
const click = (ui: UI, el: string) => ui(`(() => { const e = ${el}, r = e.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { ...at, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(t) ? 1 : 0 })); })()`);
// A project shown again as the human does it: a click on its first tab in the bar.
// Once its tab is drawn: the bar is drawn again as projects load (after a restart, on a slow screen).
const showProject = async (ui: UI, folder: string) => {
  const tab = projectTab(folder);
  await waitFor(() => ui(`!!${tab}`));
  return click(ui, tab);
};
// A project's open tasks closed as the human does it: the middle button on each tab (its menu has Close and Close
// All Tasks too).
const closeProject = (ui: UI, folder: string) => ui(`for (const t of document.querySelectorAll('#projectTabs .tasktab[data-project="${pid(folder)}"]')) t.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true })); 0`);
const choose = (ui: UI, label: string, menu = MENU) => ui(`[...${menu}.querySelectorAll('.item')].find((b) => b.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
// The bar's + (NewTask.vue): a dropdown menu of every project with its tasks. One project shows its tasks inline;
// several nest each project as a submenu. plusMenu(ui) opens it and returns its top rows' labels; plusMenu(ui, project)
// makes a new task of that project (its New Task row); plusMenu(ui, project, task) opens that task again (a closed one)
// or shows it (an open one).
const labelsIn = (ui: UI, scope: string) => ui(`[...(${scope})?.querySelectorAll(':scope > [role="menuitem"]') ?? []].map((r) => r.querySelector('.label')?.textContent ?? '')`);
async function plusMenu(ui: UI, project?: string, task?: string) {
  if (!(await ui(`!!document.querySelector('.menu[data-state="open"]')`))) await ui(`document.getElementById('newTask').click()`);
  await waitFor(() => ui(`!!document.querySelector('.menu[data-state="open"]')`));
  if (project === undefined) return labelsIn(ui, `document.querySelector('.menu[data-state="open"]')`);
  // Several projects: the project is a submenu to open first (its subtrigger opens on the pointer, so click until it
  // does, as the tab's project submenu); one project: its tasks and New Task are the top menu's own.
  const trigger = `[...document.querySelectorAll('.menu[data-state="open"] [role="menuitem"]')].find((r) => r.querySelector('.label')?.textContent === ${JSON.stringify(project)} && r.getAttribute('aria-haspopup'))`;
  const sub = await ui(`!!(${trigger})`);
  if (sub) await waitFor(async () => { await ui(`(${trigger})?.click()`); return (await ui(`document.querySelectorAll('.menu[data-state="open"]').length`)) >= 2; });
  const scope = sub ? `[...document.querySelectorAll('.menu[data-state="open"]')].at(-1)` : `document.querySelector('.menu[data-state="open"]')`;
  const label = task ?? 'New Task';
  // Its row once there: a project just opened again lists its tasks a moment after its menu opens.
  const row = `[...(${scope}).querySelectorAll('[role="menuitem"]')].find((r) => r.querySelector('.label')?.textContent === ${JSON.stringify(label)})`;
  await waitFor(() => ui(`!!(${row})`), 5000, () => labelsIn(ui, scope));
  await ui(`(${row}).click()`);
}
// The + menu's rows for one project (its tasks, then New Task): the submenu when several projects are open, the top
// menu's own rows when only one. Opens the menu, reads the rows and closes it again.
async function plusRows(ui: UI, project: string) {
  await plusMenu(ui);
  const sub = `[...document.querySelectorAll('.menu[data-state="open"] [role="menuitem"]')].find((r) => r.querySelector('.label')?.textContent === ${JSON.stringify(project)} && r.getAttribute('aria-haspopup'))`;
  const multi = await ui(`!!(${sub})`);
  // Several projects: the project is a submenu to open; its subtrigger opens on the pointer, so click until it does.
  if (multi) await waitFor(async () => { await ui(`(${sub})?.click()`); return (await ui(`document.querySelectorAll('.menu[data-state="open"]').length`)) >= 2; });
  const rows = await labelsIn(ui, multi ? `[...document.querySelectorAll('.menu[data-state="open"]')].at(-1)` : `document.querySelector('.menu[data-state="open"]')`);
  await closeBoard(ui);
  return rows;
}
// Close the + menu (or any open menu): Escape, as a click away would.
const closeBoard = async (ui: UI) => {
  if (await ui(`!!document.querySelector('.menu[data-state="open"]')`)) await ui(`document.querySelector('.menu[data-state="open"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(async () => !(await ui(`!!document.querySelector('.menu[data-state="open"]')`)));
};
// The shown task's tab's right-click menu, where its profiles are: its rows (menuRows).
const taskMenu = async (ui: UI) => {
  await rightClick(ui, '#taskbar .tasktab.active .name');
  return menuRows(ui);
};
// Settings → Profiles: the shown task's tab's menu, then Manage Profiles…; once its window shows the page.
const manageProfiles = async ({ ui, sui }: Pick<Ctx, 'ui' | 'sui'>) => {
  await taskMenu(ui);
  await choose(ui, 'Manage Profiles…');
  await waitFor(() => sui(`!!document.getElementById('prconfig')?.checkVisibility()`));
};
// Settings closed as the human does it with Esc (its window: settings-window.ts), what was typed saved; its window gone,
// the keyboard back in the task's window, the window's and its page's (a menu opened there before it comes closes as the
// window gets it; on a loaded machine the window manager's focus comes after the page's). The Esc's script is
// not waited for: its page asks for the window to close before its result is back, and a script whose window closes
// first never answers (Electron drops the reply).
const closeSettings = async (ctx: Pick<Ctx, 'shell' | 'ui' | 'sui'>) => {
  await ctx.sui('0'); // its window open and its page loaded
  void ctx.shell.settings.win.webContents.executeJavaScript(`dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`).catch(() => {});
  await settingsClosed(ctx);
};
// However it closed (Esc, the OS's ×).
const settingsClosed = async ({ shell, ui }: Pick<Ctx, 'shell' | 'ui'>) => {
  await waitFor(() => !shell.settings);
  // Not focused in time: which window is, and the windows there are, said.
  await waitFor(async () => shell.win.isFocused() && await ui(`document.hasFocus()`)).catch(async (e: Error) => {
    const all = electron.BaseWindow.getAllWindows().map((w) => `${w.getTitle()}${w.isVisible() ? '' : ' (hidden)'}${w.isFocused() ? ' (focused)' : ''}`);
    const keys = electron.webContents.getFocusedWebContents(), page = shell.win.webContents;
    throw new Error(`${e.message}; windows: ${all.join(', ')}; the keyboard in: ${keys === page ? "the window's page" : keys?.getURL() ?? 'none'};`
      + ` page focused ${page.isFocused()}, its active element ${await ui(`document.activeElement?.tagName + '.' + document.activeElement?.className`)}`);
  });
};
// A profile in Settings' tree chosen (a click), its page shown.
const chooseProfile = async (sui: UI, name: string) => {
  const id = idOf(name);
  await waitFor(() => sui(`!!document.querySelector('#pjlist [data-profile="${id}"]')`)); // the profiles come as it opens
  await sui(`document.querySelector('#pjlist [data-profile="${id}"]').click()`);
  await waitFor(() => sui(`document.querySelector('#pjlist [data-profile="${id}"]')?.ariaSelected === 'true' && document.getElementById('profilepage')?.checkVisibility()`));
};
// A field of Settings → Profiles typed and left (saved on change).
const setProfileField = (ui: UI, id: string, value: string) => ui(`(() => { const f = document.getElementById('${id}'); f.value = ${JSON.stringify(value)};
  f.dispatchEvent(new Event('input')); f.dispatchEvent(new Event('change')); })()`);
// A right-click on an element of the window, at its middle: the press (it closes a menu open elsewhere), then the
// menu's event, as a mouse sends them on Linux.
const rightClick = (ui: UI, sel: string) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)}), r = e.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, button: 2, buttons: 2, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  e.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerType: 'mouse', isPrimary: true }));
  e.dispatchEvent(new MouseEvent('contextmenu', at)); })()`);

// The window given the keyboard, as the human's click gives it, once its page has it. On a loaded machine the
// window manager focuses the window, and its page learns it later: a key sent then reaches Kulisa, but the page's
// focus, coming after, goes back to where it had been, over what the key had focused.
const focusWindow = async (win: { focus(): void; webContents: { focus(): void } }, ui: UI) => {
  // On macOS a click also brings the app to the front, and only the front app's windows take the keyboard.
  if (MAC) electron.app.focus({ steal: true });
  win.focus(); win.webContents.focus();
  // macOS makes the window key a moment later and gives the keyboard back to the view that had it (a profile's page),
  // over this: given again until the page has it, as the click into it would.
  await waitFor(async () => { if (await ui(`document.hasFocus()`)) return true; win.webContents.focus(); return false; });
};

// shown: what there was instead, said when it times out (a flaky wait on CI is read from its log alone).
async function waitFor(cond: () => unknown, ms = 5000, shown?: () => unknown) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await cond()) return;
  throw new Error(`waitFor timed out: ${cond}${shown ? `\n      shown: ${JSON.stringify(await shown())}` : ''}`);
}

const who = async (ctx: Pick<Ctx, 'call'>, profile: string) => (await ctx.call('browser_snapshot', { profile })).text.match(/Signed (in as \w+|out)/)?.[0];

// The window is a grid of peer panels (dockview): a pane per profile and the terminal. A profile's page is a
// native view laid over its pane's .content box, so after any change in the grid it must follow the box.
const box = (ui: UI, sel: string) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.isConnected || !e.offsetWidth) return null;
  const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
const pageBox = (ui: UI, name: string) => box(ui, `.pane[data-profile="${idOf(name)}"] .content`);
// The box is in CSS pixels of the window's page; the view is placed in window pixels (times the Kulisa zoom).
const viewOn = async (shell: Shell, ui: UI, name: string) => {
  const t = shell.profiles.get(idOf(name)).get();
  const b = await pageBox(ui, name);
  const z = shell.win.webContents.getZoomFactor();
  const scaled = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round((v as number) * z)]));
  return !!b && t.view.getVisible() && JSON.stringify(t.view.getBounds()) === JSON.stringify(scaled);
};
const dock = (ui: UI, js: string) => ui(`(() => { const api = window.__dock; ${js} })()`);
// The Resources island's height (its group in the grid: lib/grid.ts), on screen and as the task's grid is saved
// (dockview keeps a panel's size along its column: under the terminal in the preset "grid").
const resourcesHeight = (ui: UI) => ui(`Math.round(document.getElementById('resources').closest('.dv-groupview').getBoundingClientRect().height)`);
type GridNode = { type: string; size: number; data: { views: string[] } & GridNode[] };
const savedResourcesHeight = () => {
  const leaf = (n: GridNode): GridNode | undefined => (n.type === 'leaf' ? (n.data.views.includes('resources') ? n : undefined) : n.data.map(leaf).find(Boolean));
  return leaf(JSON.parse(fs.readFileSync(pfile('layout.json'), 'utf8')).grid.root)?.size;
};

// A key with modifiers ('control', 'shift', 'alt') into a webContents, as the keyboard sends it there; Ctrl + a key
// with the keyboard put there first (zoom keys).
const press = (wc: WebContents, keyCode: string, ...modifiers: ('control' | 'shift' | 'alt' | 'meta')[]) => { for (const type of ['keyDown', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode, modifiers }); };
// Kulisa's keys that are ⌘ on macOS and Ctrl elsewhere (CommandOrControl in keys.ts); Ctrl+` and Ctrl+Tab are Ctrl's
// everywhere, and in the terminal Ctrl is the agent's.
const MAC = process.platform === 'darwin';
const CMD = MAC ? 'meta' : 'control';
// What Windows does its own way: the user's shell is PowerShell (src/terminal), a right-click's menu opens on the
// release, the terminal copies and pastes with Ctrl+C / V.
const WIN = process.platform === 'win32';
// An attribute's value in a selector, as a CSS string: a Windows path's backslashes are CSS escapes.
const attr = (name: string, value: string) => `[${name}=${JSON.stringify(value)}]`;
const ctrl = (wc: WebContents, keyCode: string) => { wc.focus(); press(wc, keyCode, CMD); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
// A sandboxed page: its preload's world (999, contextIsolation's) has no Node's process (Electron's tutorial/sandbox.md).
const noNode = async (wc: WebContents) => await wc.executeJavaScriptInIsolatedWorld(999, [{ code: 'typeof process' }]) === 'undefined';

export type { UI };
export { resourcesHeight, savedResourcesHeight, MAC, CMD, WIN, attr, canShoot, NO_SHOT, shot, tid, taskAt, isNth, focusWindow, MENU, SUBMENU, noNode, hooksOf, plusMenu, plusRows, closeBoard, assert, root, userData, project, pid, tkey, named, pfile, idOf, savedTabs, savedActive, savedWindows, panel, SITE, PORT, sleep, waitFor, who, menuRows, choose, projectTabs, projectTab, showProject, closeProject, manageProfiles, closeSettings, settingsClosed, chooseProfile, setProfileField, menuOpen, closeMenu, rightClick, taskMenu,
  click,
  box, pageBox, viewOn, dock, press, ctrl, near };
