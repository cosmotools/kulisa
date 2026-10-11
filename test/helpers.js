// What the test files share: the test folder, the test site, waiting, and driving the window like the human.
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');

// The test folder: each group of files its own (start.js), else kulisa-test.
const root = process.env.KULISA_TEST_ROOT || path.join(os.tmpdir(), 'kulisa-test');
const userData = path.join(root, 'data');
const project = path.join(root, 'project');

// A file of the test project's own data, of its first task (or of task n) (store.js; the project's id is its folder's name).
const pfile = (f, task = 1) => path.join(userData, 'projects', 'project', String(task), f);
// The tabs saved for a profile (in its folder).
const savedTabs = (id, task = 1) => {
  const { folder } = JSON.parse(fs.readFileSync(pfile('profiles.json', task), 'utf8')).find((p) => p.id === id);
  return JSON.parse(fs.readFileSync(pfile(path.join(folder, 'Kulisa Tabs.json'), task), 'utf8'));
};
// The id of a profile's panel in the grid (its folder: stable across renames).
const panel = (shell, id) => `profile:${(shell.profiles.get(id) || shell.closed.get(id)?.cfg).folder}`;
const SITE = 'http://127.0.0.1:4417';
// The windows as settings.json keeps them for the next start: each one's tabs and the one shown.
const savedWindows = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).windows.map(({ tabs, shown }) => ({ tabs, shown }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kulisa's menus (Reka's, docs/ui.md, Menus): the open one, once it is shown (the pages under it are pictures);
// its rows ('-' a line, '# …' a heading, '~ …' a note, 'zoom' the zoom row; an item: its label, '(off)' when
// disabled); choose one by its label; close it as Esc does.
const MENU = `document.querySelector('.menu[data-state="open"]')`;
const menuOpen = (ui) => ui(`!!document.querySelector('.menu[data-state="open"].ready')`);
const menuRows = async (ui) => {
  await waitFor(() => menuOpen(ui));
  // A project's group panel (GroupPanel.vue) is read as a menu: its rows, not its name, colors and icons on top.
  return ui(`(() => { const row = (r) => r.matches('.gphead') ? [] : r.matches('[role="separator"]') ? '-' : r.matches('.heading') ? '# ' + r.textContent : r.matches('.note') ? '~ ' + r.textContent
    : r.matches('.zoomrow') ? 'zoom' : r.matches('.themerow') ? 'theme' : r.matches('.barrow') ? 'bar' : r.matches('.arrange') ? 'arrange: ' + [...r.querySelectorAll('span')].map((s) => s.textContent).join(', ')
    : r.matches('[role="group"]') ? [...r.children].map(row)
    : r.querySelector('.label').textContent + ((r.matches('.item') ? r : r.querySelector('.item')).matches('[data-disabled]') ? ' (off)' : '');
  return [...${MENU}.children].flatMap(row); })()`);
};
const closeMenu = async (ui) => {
  await ui(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`);
  await waitFor(async () => !(await ui(`!!document.querySelector('[data-state="open"]:is(.menu, [role="listbox"])')`)));
};
// The open projects in the projects' bar (their islands): their names, the shown one with ' *'.
const projectTabs = (ui) => ui(`[...document.querySelectorAll('#projectTabs .pisland')].map((t) => t.querySelector('.plabel .name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const projectTab = (id) => `document.querySelector('#projectTabs [data-project="${id}"]')`;
// A click as the mouse makes it (the press, the release, the click) on an element: tabs are chosen on the press
// (Reka's Tabs, as a browser's).
const click = (ui, el) => ui(`(() => { const e = ${el}, r = e.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { ...at, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(t) ? 1 : 0 })); })()`);
// A project shown again as the human does it: a click on the task it shows, in its island.
// Once its island is drawn: the bar is drawn again as projects load (seen after a restart, on a slow screen).
const showProject = async (ui, id) => {
  const tab = `${projectTab(id)}?.querySelector('.tasktab.selected')`;
  await waitFor(() => ui(`!!${tab}`));
  return click(ui, tab);
};
// Kulisa's selects (SelectBox.vue, Reka's Select): the chosen value; the values to choose from; one chosen as the mouse
// does (the list opens on the press) and a row chosen with Enter (the release over a row chooses only once the pointer
// has moved from the press).
const chosen = (ui, id) => ui(`document.getElementById(${JSON.stringify(id)}).dataset.value`);
const openSelect = async (ui, id) => {
  await ui(`document.getElementById(${JSON.stringify(id)}).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }))`);
  await waitFor(() => ui(`!!document.querySelector('[role="listbox"][data-state="open"]')`));
};
const selectValues = async (ui, id) => {
  await openSelect(ui, id);
  const values = await ui(`[...document.querySelectorAll('[role="listbox"] .item')].map((o) => o.dataset.value)`);
  await closeMenu(ui);
  return values;
};
const select = async (ui, id, value) => {
  await openSelect(ui, id);
  await ui(`document.querySelector('[role="listbox"] .item[data-value=${JSON.stringify(value)}]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
  await waitFor(async () => (await chosen(ui, id)) === value);
};
// A project closed as the human does it: the middle button on its label (its right-click menu has Close Project too).
const closeProject = (ui, id) => ui(`${projectTab(id)}.querySelector('.plabel').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))`);
const choose = (ui, label) => ui(`[...${MENU}.querySelectorAll('.item')].find((b) => b.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
// The profile editor: the profiles' chip (👥), then Manage Profiles….
const manageProfiles = async (ui) => {
  await ui(`document.getElementById('openProfiles').click()`);
  await menuRows(ui);
  await choose(ui, 'Manage Profiles…');
};
// A right-click on an element of the window, at its middle: the press (it closes a menu open elsewhere), then the
// menu's event, as a mouse sends them on Linux.
const rightClick = (ui, sel) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)}), r = e.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, button: 2, buttons: 2, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  e.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerType: 'mouse', isPrimary: true }));
  e.dispatchEvent(new MouseEvent('contextmenu', at)); })()`);

async function waitFor(cond, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await cond()) return;
  throw new Error(`waitFor timed out: ${cond}`);
}

const who = async (ctx, profile) => (await ctx.call('browser_snapshot', { profile })).text.match(/Signed (in as \w+|out)/)?.[0];

// The window is a grid of peer panels (dockview): a pane per profile and the terminal. A profile's page is a
// native view laid over its pane's .content box, so after any change in the grid it must follow the box.
const box = (ui, sel) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.isConnected || !e.offsetWidth) return null;
  const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
const pageBox = (ui, id) => box(ui, `.pane[data-profile="${id}"] .content`);
// The box is in CSS pixels of the window's page; the view is placed in window pixels (times the Kulisa zoom).
const viewOn = async (shell, ui, id) => {
  const t = shell.profiles.get(id).get();
  const b = await pageBox(ui, id);
  const z = shell.win.webContents.getZoomFactor();
  const scaled = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * z)]));
  return !!b && t.view.getVisible() && JSON.stringify(t.view.getBounds()) === JSON.stringify(scaled);
};
const dock = (ui, js) => ui(`(() => { const api = window.__dock; ${js} })()`);

// A key with modifiers ('control', 'shift', 'alt') into a webContents, as the keyboard sends it there; Ctrl + a key
// with the keyboard put there first (zoom keys).
const press = (wc, keyCode, ...modifiers) => { for (const type of ['keyDown', 'keyUp']) wc.sendInputEvent({ type, keyCode, modifiers }); };
const ctrl = (wc, keyCode) => { wc.focus(); press(wc, keyCode, 'control'); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

module.exports = { assert, root, userData, project, pfile, savedTabs, savedWindows, panel, SITE, sleep, waitFor, who, menuRows, choose, projectTabs, projectTab, showProject, closeProject, manageProfiles, menuOpen, closeMenu, rightClick,
  click, chosen, selectValues, select,
  box, pageBox, viewOn, dock, press, ctrl, near };
