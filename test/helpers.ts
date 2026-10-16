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

// A file of the test project's own data, of its first task (or of task n) (store.ts; the project's id is its folder's name).
const pfile = (f: string, task = 1) => path.join(userData, 'projects', 'project', String(task), f);
// The tabs saved for a profile (in its folder).
const savedTabs = (id: string, task = 1): string[] => {
  const { folder } = JSON.parse(fs.readFileSync(pfile('profiles.json', task), 'utf8')).find((p: { id: string }) => p.id === id);
  return JSON.parse(fs.readFileSync(pfile(path.join(folder, 'Kulisa Tabs.json'), task), 'utf8'));
};
// The id of a profile's panel in the grid (its folder: stable across renames).
const panel = (shell: Shell, id: string) => `profile:${(shell.profiles.get(id) || shell.closed.get(id)?.cfg).folder}`;
// The test site: the run's own (start.ts gives each run a free port), else 4417.
const SITE = process.env.KULISA_TEST_SITE || 'http://127.0.0.1:4417';
const PORT = new URL(SITE).port;
// The windows as settings.json keeps them for the next start: each one's tabs and the one shown.
const savedWindows = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).windows.map(({ tabs, shown }: { tabs: string[]; shown: string | null }) => ({ tabs, shown }));
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
  return ui(`(() => { const row = (r) => r.matches('[role="separator"]') ? '-' : r.matches('.heading') ? '# ' + r.textContent : r.matches('.note') ? '~ ' + r.textContent
    : r.matches('.zoomrow') ? 'zoom' : r.matches('.themerow') ? 'theme' : r.matches('.barrow') ? 'bar' : r.matches('.arrange') ? 'arrange: ' + [...r.querySelectorAll('span')].map((s) => s.textContent).join(', ')
    : r.matches('[role="group"]') ? [...r.children].map(row)
    : (r.matches('.inset') ? '  ' : '') + r.querySelector('.label').textContent + ((r.matches('.item') ? r : r.querySelector('.item')).matches('[data-disabled]') ? ' (off)' : '');
  return [...${menu}.children].flatMap(row); })()`);
};
const closeMenu = async (ui: UI) => {
  await ui(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`);
  await waitFor(async () => !(await ui(`!!document.querySelector('[data-state="open"]:is(.menu, [role="listbox"])')`)));
};
// The tasks' bar's tabs (one per open task): each its project's id, the shown one with ' *'.
const projectTabs = (ui: UI) => ui(`[...document.querySelectorAll('#projectTabs .tasktab')].map((t) => t.dataset.project + (t.classList.contains('active') ? ' *' : ''))`);
// A project's first tab in the bar.
const projectTab = (id: string) => `document.querySelector('#projectTabs .tasktab[data-project="${id}"]')`;
// A click as the mouse makes it (the press, the release, the click) on an element: tabs are chosen on the press
// (Reka's Tabs, as a browser's).
const click = (ui: UI, el: string) => ui(`(() => { const e = ${el}, r = e.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { ...at, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(t) ? 1 : 0 })); })()`);
// A project shown again as the human does it: a click on its first tab in the bar.
// Once its tab is drawn: the bar is drawn again as projects load (seen after a restart, on a slow screen).
const showProject = async (ui: UI, id: string) => {
  const tab = projectTab(id);
  await waitFor(() => ui(`!!${tab}`));
  return click(ui, tab);
};
// A project's open tasks closed as the human does it: the middle button on each tab (its menu has Close and Close
// All Tasks too).
const closeProject = (ui: UI, id: string) => ui(`for (const t of document.querySelectorAll('#projectTabs .tasktab[data-project="${id}"]')) t.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true })); 0`);
const choose = (ui: UI, label: string, menu = MENU) => ui(`[...${menu}.querySelectorAll('.item')].find((b) => b.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
// The bar's + (NewTask.vue), its menu opened with a click: plusMenu(ui) its rows (menuRows: a project by its name, its
// closed tasks under it as '  name'); plusMenu(ui, project) a new task of that project (by its name); plusMenu(ui,
// project, task) its closed task of that name opened again.
async function plusMenu(ui: UI, project?: string, task?: string) {
  await ui(`document.getElementById('newTask').click()`);
  const rows = await menuRows(ui);
  if (project === undefined) return rows;
  await ui(`(() => { const items = [...${MENU}.querySelectorAll('.item')], label = (r) => r.querySelector('.label').textContent;
    const at = items.findIndex((r) => !r.matches('.inset') && label(r) === ${JSON.stringify(project)}), own = [];
    for (const r of items.slice(at + 1)) { if (!r.matches('.inset')) break; own.push(r); }
    (${JSON.stringify(task ?? null)} === null ? items[at] : own.find((r) => label(r) === ${JSON.stringify(task)})).click(); })()`);
  await waitFor(async () => !(await menuOpen(ui)));
}
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
// the keyboard back in the task's window, the window's and its page's (a menu opened there before it came closed as the
// window got it; on GitHub's runner the window manager's focus came after the page's, 2026-10-16). The Esc's script is
// not waited for: its page asks for the window to close before its result is back, and a script whose window closes
// first never answers (Electron drops the reply: a test hung for its 30 s on GitHub's runner, 2026-10-16).
const closeSettings = async (ctx: Pick<Ctx, 'shell' | 'ui' | 'sui'>) => {
  await ctx.sui('0'); // its window open and its page loaded
  void ctx.shell.settings.win.webContents.executeJavaScript(`dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`).catch(() => {});
  await settingsClosed(ctx);
};
// However it closed (Esc, the OS's ×).
const settingsClosed = async ({ shell, ui }: Pick<Ctx, 'shell' | 'ui'>) => {
  await waitFor(() => !shell.settings);
  await waitFor(async () => shell.win.isFocused() && await ui(`document.hasFocus()`));
};
// A profile in Settings' tree chosen (a click), its page shown.
const chooseProfile = async (sui: UI, id: string) => {
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

// The window given the keyboard, as the human's click gives it, once its page has it. On a loaded machine (GitHub's
// runner, 2026-10-12) the window manager focuses the window, and its page learns it later: a key sent then reached
// Kulisa, but the page's focus, coming after, went back to where it had been, over what the key had focused.
const focusWindow = async (win: { focus(): void; webContents: { focus(): void } }, ui: UI) => {
  win.focus(); win.webContents.focus();
  await waitFor(() => ui(`document.hasFocus()`));
};

async function waitFor(cond: () => unknown, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await cond()) return;
  throw new Error(`waitFor timed out: ${cond}`);
}

const who = async (ctx: Pick<Ctx, 'call'>, profile: string) => (await ctx.call('browser_snapshot', { profile })).text.match(/Signed (in as \w+|out)/)?.[0];

// The window is a grid of peer panels (dockview): a pane per profile and the terminal. A profile's page is a
// native view laid over its pane's .content box, so after any change in the grid it must follow the box.
const box = (ui: UI, sel: string) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.isConnected || !e.offsetWidth) return null;
  const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
const pageBox = (ui: UI, id: string) => box(ui, `.pane[data-profile="${id}"] .content`);
// The box is in CSS pixels of the window's page; the view is placed in window pixels (times the Kulisa zoom).
const viewOn = async (shell: Shell, ui: UI, id: string) => {
  const t = shell.profiles.get(id).get();
  const b = await pageBox(ui, id);
  const z = shell.win.webContents.getZoomFactor();
  const scaled = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round((v as number) * z)]));
  return !!b && t.view.getVisible() && JSON.stringify(t.view.getBounds()) === JSON.stringify(scaled);
};
const dock = (ui: UI, js: string) => ui(`(() => { const api = window.__dock; ${js} })()`);

// A key with modifiers ('control', 'shift', 'alt') into a webContents, as the keyboard sends it there; Ctrl + a key
// with the keyboard put there first (zoom keys).
const press = (wc: WebContents, keyCode: string, ...modifiers: ('control' | 'shift' | 'alt' | 'meta')[]) => { for (const type of ['keyDown', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode, modifiers }); };
// Kulisa's keys that are ⌘ on macOS and Ctrl elsewhere (CommandOrControl in keys.ts); Ctrl+` and Ctrl+Tab are Ctrl's
// everywhere, and in the terminal Ctrl is the agent's.
const MAC = process.platform === 'darwin';
const CMD = MAC ? 'meta' : 'control';
const ctrl = (wc: WebContents, keyCode: string) => { wc.focus(); press(wc, keyCode, CMD); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
// A sandboxed page: its preload's world (999, contextIsolation's) has no Node's process (Electron's tutorial/sandbox.md).
const noNode = async (wc: WebContents) => await wc.executeJavaScriptInIsolatedWorld(999, [{ code: 'typeof process' }]) === 'undefined';

export type { UI };
export { MAC, CMD, canShoot, NO_SHOT, shot, focusWindow, MENU, SUBMENU, noNode, hooksOf, plusMenu, assert, root, userData, project, pfile, savedTabs, savedWindows, panel, SITE, PORT, sleep, waitFor, who, menuRows, choose, projectTabs, projectTab, showProject, closeProject, manageProfiles, closeSettings, settingsClosed, chooseProfile, setProfileField, menuOpen, closeMenu, rightClick, taskMenu,
  click,
  box, pageBox, viewOn, dock, press, ctrl, near };
