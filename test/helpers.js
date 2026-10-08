// What the test files share: the test folder, the test site, waiting, and driving the window like the human.
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');

const root = path.join(os.tmpdir(), 'kulisa-test');
const userData = path.join(root, 'data');
const project = path.join(root, 'project');

// A file of the test project's own data, of its main workspace (store.js; the project's id is its folder's name).
const pfile = (f, ws = 1) => path.join(userData, 'projects', 'project', String(ws), f);
// The tabs saved for a profile (in its folder).
const savedTabs = (id, ws = 1) => {
  const { folder } = JSON.parse(fs.readFileSync(pfile('profiles.json', ws), 'utf8')).find((p) => p.id === id);
  return JSON.parse(fs.readFileSync(pfile(path.join(folder, 'Kulisa Tabs.json'), ws), 'utf8'));
};
// The id of a profile's panel in the grid (its folder: stable across renames).
const panel = (shell, id) => `profile:${(shell.profiles.get(id) || shell.closed.get(id)?.cfg).folder}`;
const SITE = 'http://127.0.0.1:4417';
// The windows as settings.json keeps them for the next start: each one's tabs and the one shown.
const savedWindows = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).windows.map(({ tabs, shown }) => ({ tabs, shown }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kulisa's menus (menu.js): wait for the open one and get its rows ('-' a line, '# …' a heading,
// 'zoom' the zoom row; an item: its label, '(off)' when disabled); choose one by its label.
const menuRows = async (ui) => {
  await waitFor(() => ui(`document.getElementById('menu').matches(':popover-open')`));
  return ui(`[...document.getElementById('menu').children].map((r) => r.matches('hr') ? '-' : r.matches('.heading') ? '# ' + r.textContent
    : r.matches('.zoomrow') ? 'zoom' : r.matches('.themerow') ? 'theme' : r.matches('.barrow') ? 'bar' : r.matches('.arrange') ? 'arrange: ' + [...r.querySelectorAll('span')].map((s) => s.textContent).join(', ')
    : r.querySelector('.label').textContent + (r.disabled ? ' (off)' : ''))`);
};
// The open projects in the projects' bar (their islands): their names, the shown one with ' *'.
const projectTabs = (ui) => ui(`[...document.querySelectorAll('#projectTabs .pisland')].map((t) => t.querySelector('.plabel .name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const projectTab = (id) => `document.querySelector('#projectTabs [data-project="${id}"]')`;
// A project shown again as the human does it: a click on the workspace it shows, in its island.
const showProject = (ui, id) => ui(`${projectTab(id)}.querySelector('.wstab.selected').click()`);
// A project closed as the human does it: the middle button on its label (its right-click menu has Close Project too).
const closeProject = (ui, id) => ui(`${projectTab(id)}.querySelector('.plabel').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))`);
const choose = (ui, label) => ui(`[...document.querySelectorAll('#menu .item')].find((b) => b.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
// The profile editor: Profiles ▾, then Manage Profiles….
const manageProfiles = async (ui) => {
  await ui(`document.getElementById('openProfiles').click()`);
  await menuRows(ui);
  await choose(ui, 'Manage Profiles…');
};
const menuOpen = (ui) => ui(`document.getElementById('menu').matches(':popover-open')`);
// A right-click on an element of the window, at its middle.
const rightClick = (ui, sel) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)}), r = e.getBoundingClientRect();
  e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); })()`);

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

// Ctrl + a key in a webContents (zoom keys).
const ctrl = (wc, keyCode) => {
  wc.focus();
  for (const type of ['keyDown', 'keyUp']) wc.sendInputEvent({ type, keyCode, modifiers: ['control'] });
};
const near = (a, b) => Math.abs(a - b) < 1e-6;

module.exports = { assert, root, userData, project, pfile, savedTabs, savedWindows, panel, SITE, sleep, waitFor, who, menuRows, choose, projectTabs, projectTab, showProject, closeProject, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near };
