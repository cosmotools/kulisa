// Kulisa window UI: the top bar, the profile editor, and a grid of peer panels (dockview): one pane per profile
// (tab strip, address bar; the page itself is a WebContentsView laid over .content by the main process) and the
// terminal. Panels can be dragged, stacked as tabs and resized; the grid is saved (layout.json) and restored.
const panes = new Map(); // profile key (its partition; stable across renames) -> { el, tabEl, profile }
let state = [];
let closedProfiles = []; // closed by the human: { key, id, name, color, tabs (how many) }; shown in the editor only
let gridReady = null;
// A copy of a <template> of index.html.
const tpl = (id) => document.getElementById(id).content.firstElementChild.cloneNode(true);

kulisa.on('state', async (s) => {
  state = s;
  const first = !gridReady;
  await (gridReady ??= restoreGrid());
  render();
  if (first) reveal();
});
// Until the grid is built and the pages have their places, the window shows no grid and the main process keeps the
// pages hidden (html.loading): nothing jumps while the window loads, e.g. when another project is opened.
function reveal() {
  requestAnimationFrame(() => requestAnimationFrame(() => { // after sendLayout's frame
    document.documentElement.classList.remove('loading');
    kulisa.invoke('views:hidden', viewsCovered());
  }));
}

// ---------- profiles ----------
// The profile editor: add, rename, delete. A modal <dialog>; the profiles' views are native and would cover it,
// so they are hidden while it is open.
const editor = document.getElementById('profiles');
const plist = document.getElementById('plist');
const newProfile = document.getElementById('newProfile');
const rows = new Map(); // profile key -> row element
function openEditor() {
  kulisa.invoke('views:hidden', true);
  renderEditor(); editor.showModal(); newProfile.focus();
}
// The close event comes in a later task; the editor may be open again by then.
// The pages stay hidden while a dialog is open or the grid is not laid out yet (html.loading).
const viewsCovered = () => document.querySelector('dialog[open]') !== null || document.documentElement.classList.contains('loading');
editor.addEventListener('close', () => kulisa.invoke('views:hidden', viewsCovered()));
// The Profiles button: a menu of the project's profiles, as the project button's. An open one: its pane comes to the
// front (it may be stacked behind another); a closed one opens. The editor (Manage Profiles…) for the rest.
const openProfiles = document.getElementById('openProfiles');
openProfiles.onclick = () => openMenu([
  ...state.map((p) => ({ label: p.name, sub: `${p.tabs.length} tab${p.tabs.length === 1 ? '' : 's'}`, color: p.color,
    run: () => api.getPanel(panelId(p.key))?.api.setActive() })),
  ...closedProfiles.map((p) => ({ label: p.name, sub: 'closed · click to open', color: p.color,
    run: () => kulisa.invoke('profile:open', { profile: p.id }) })),
  ...(state.length || closedProfiles.length ? ['-'] : []),
  { label: 'Manage Profiles…', run: openEditor },
], openProfiles);
document.getElementById('padd').onsubmit = async (e) => {
  e.preventDefault();
  const name = newProfile.value.trim();
  if (!name) return newProfile.focus();
  newProfile.value = '';
  await kulisa.invoke('profile:new', { name });
  newProfile.focus();
};

kulisa.on('closed-profiles', (list) => { closedProfiles = list; if (editor.open) renderEditor(); });
function renderEditor() {
  const all = [...state, ...closedProfiles.map((p) => ({ ...p, closed: true }))];
  for (const [key, row] of rows) if (!all.some((p) => p.key === key)) { row.remove(); rows.delete(key); }
  for (const p of all) {
    const row = rows.get(p.key) || createRow(p);
    row.profile = p;
    row.style.setProperty('--color', p.color);
    const name = row.querySelector('.name');
    if (document.activeElement !== name) name.value = p.name;
    row.querySelector('.pid').textContent = p.id;
    const n = p.closed ? p.tabs : p.tabs.length;
    row.querySelector('.ntabs').textContent = `${p.closed ? 'closed · ' : ''}${n} tab${n === 1 ? '' : 's'}`;
    row.querySelector('.open').hidden = !p.closed;
    plist.append(row); // keeps the order of state
  }
}

function createRow(p) {
  const row = tpl('tpl-prow');
  rows.set(p.key, row);
  const name = row.querySelector('.name');
  const rename = () => {
    const v = name.value.trim();
    if (v && v !== row.profile.name) kulisa.invoke('profile:rename', { profile: row.profile.id, name: v });
    else name.value = row.profile.name;
  };
  name.addEventListener('change', rename);
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); name.value = row.profile.name; name.blur(); }
  });
  row.querySelector('.open').onclick = () => kulisa.invoke('profile:open', { profile: row.profile.id });
  row.querySelector('.del').onclick = () => deleteProfile(row.profile);
  return row;
}
// After the human confirms in a native question.
async function deleteProfile(p) {
  const ok = await kulisa.invoke('confirm', { message: `Delete the profile ${p.name}?`, ok: 'Delete',
    detail: 'Its sign-ins, cookies, storage and tabs are removed for good.' });
  if (ok) kulisa.invoke('profile:delete', { profile: p.id });
}

function render() {
  if (editor.open) renderEditor();
  syncGrid();
  for (const p of state) {
    const pane = panes.get(p.key);
    pane.profile = p;
    pane.el.dataset.profile = p.id;
    renderTabs(pane, p);
    pane.tabEl.querySelector('.pname').textContent = p.name;
    const cap = pane.tabEl.querySelector('.caption');
    if (p.signinMode) { cap.textContent = '🔒 Sign-in page — agent paused'; pane.signinShown = true; }
    else if (pane.signinShown) { cap.textContent = ''; pane.signinShown = false; }
    const active = p.tabs.find((t) => t.id === p.active);
    pane.el.querySelector('.back').disabled = !active?.canBack;
    pane.el.querySelector('.fwd').disabled = !active?.canFwd;
    // The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it.
    const zoom = pane.el.querySelector('.zoom');
    zoom.hidden = !active || active.zoom === 1;
    if (active) zoom.textContent = `${Math.round(active.zoom * 100)}%`;
    const addr = pane.el.querySelector('.addr');
    if (document.activeElement !== addr) addr.value = active ? active.url : '';
  }
  scheduleLayout();
}

// The tab strip; clicks are handled for the whole strip in createPane.
function renderTabs(pane, p) {
  const strip = pane.el.querySelector('.tabs');
  strip.replaceChildren(...p.tabs.map((t) => {
    const el = tpl('tpl-tab');
    el.dataset.tab = t.id;
    el.classList.toggle('active', t.id === p.active);
    el.title = t.url;
    const img = el.querySelector('img');
    if (t.favicon) { img.src = t.favicon; img.hidden = false; }
    el.querySelector('.title').textContent = (t.loading ? '⟳ ' : '') + (t.title || t.url || 'New tab');
    return el;
  }), pane.add);
}

// A pane: its panel content (el) and its header in the grid (tabEl: color, name, the agent's caption).
function createPane(p) {
  const el = tpl('tpl-pane');
  const tabEl = tpl('tpl-ptab');
  tabEl.dataset.panel = panelId(p.key);
  tabEl.style.setProperty('--color', p.color);
  const pane = { el, tabEl, profile: p, add: el.querySelector('.tabs .add') };
  panes.set(p.key, pane);
  const id = () => pane.profile.id;
  const tab = () => pane.profile.active;
  el.querySelector('.tabs').onclick = (e) => {
    const t = e.target.closest('.tab')?.dataset.tab;
    if (e.target.closest('.add')) kulisa.invoke('tab:new', { profile: id() });
    else if (t && e.target.closest('.x')) kulisa.invoke('tab:close', { profile: id(), tab: t });
    else if (t) kulisa.invoke('tab:activate', { profile: id(), tab: t });
  };
  el.querySelector('.back').onclick = () => kulisa.invoke('tab:back', { profile: id(), tab: tab() });
  el.querySelector('.fwd').onclick = () => kulisa.invoke('tab:forward', { profile: id(), tab: tab() });
  el.querySelector('.reload').onclick = () => kulisa.invoke('tab:reload', { profile: id(), tab: tab() });
  el.querySelector('.addr').onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    kulisa.invoke('tab:navigate', { profile: id(), tab: tab(), url: e.target.value });
    e.target.blur();
  };
  el.querySelector('.zoom').onclick = () => kulisa.invoke('tab:zoom', { profile: id(), tab: tab(), dir: 0 });
  el.querySelector('.pick').onclick = (e) => (e.currentTarget.classList.contains('active') ? kulisa.invoke('pick:cancel', { profile: id() }) : startPick(id()));
  el.querySelector('.devtools').onclick = () => kulisa.invoke('tab:devtools', { profile: id(), tab: tab() });
  const pname = tabEl.querySelector('.pname');
  pname.ondblclick = () => renameProfile(pane, pname);
  tabEl.querySelector('.close').onclick = () => kulisa.invoke('profile:close', { profile: id() });
  new ResizeObserver(scheduleLayout).observe(el.querySelector('.content'));
  return pane;
}

function renameProfile(pane, pname) {
  const input = Object.assign(document.createElement('input'), { value: pane.profile.name, size: 24 });
  pname.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    input.replaceWith(pname);
    const name = input.value.trim();
    if (save && name && name !== pane.profile.name) kulisa.invoke('profile:rename', { profile: pane.profile.id, name });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(false));
}

// ---------- projects ----------
// A project is a folder with its own profiles, grid and agent; one is open at a time. Opening another one rebuilds the
// grid in place (project:closing below, then that project's state).
const projDialog = document.getElementById('projects');
const projlist = document.getElementById('projlist');
const newProject = document.getElementById('newProject');
// The open project, from the URL (app.js), before the first paint.
const showProject = ({ name, color }) => {
  document.getElementById('projectName').textContent = name;
  document.documentElement.style.setProperty('--project', color);
};
const fromUrl = new URLSearchParams(location.search).get('project');
if (fromUrl) showProject(JSON.parse(fromUrl));
function showProjects({ current, projects }) {
  const open = projects.find((p) => p.id === current);
  if (open) showProject(open);
  projlist.replaceChildren(...projects.map((p) => {
    const row = tpl('tpl-projrow');
    row.dataset.project = p.id;
    row.style.setProperty('--color', p.color);
    row.classList.toggle('current', p.id === current);
    row.querySelector('.name').textContent = p.name;
    const folder = row.querySelector('.folder');
    folder.textContent = folder.title = p.folder;
    row.querySelector('.open').onclick = () => kulisa.invoke('project:open', { id: p.id });
    return row;
  }));
}
kulisa.on('projects', showProjects); // when the project is open
// The project button: a menu of the projects, as in JetBrains; the dialog (Manage Projects…) for the rest.
const openProjects = document.getElementById('openProjects');
openProjects.onclick = async () => {
  const { current, projects } = await kulisa.invoke('projects:list');
  openMenu([
    ...projects.map((p) => (p.id === current ? { label: p.name, sub: p.folder, color: p.color, keys: '✓' }
      : { label: p.name, sub: p.folder, color: p.color, run: () => kulisa.invoke('project:open', { id: p.id }) })),
    '-',
    { label: 'Open Folder…', run: () => kulisa.invoke('project:open-folder') },
    { label: 'Manage Projects…', run: manageProjects },
  ], openProjects);
};
async function manageProjects() {
  kulisa.invoke('views:hidden', true);
  projDialog.showModal(); // first: the closing menu shows the pages again unless a dialog is open
  showProjects(await kulisa.invoke('projects:list'));
}
projDialog.addEventListener('close', () => kulisa.invoke('views:hidden', viewsCovered()));
document.getElementById('openFolder').onclick = () => kulisa.invoke('project:open-folder');
document.getElementById('projnew').onsubmit = (e) => {
  e.preventDefault();
  const name = newProject.value.trim();
  if (!name) return newProject.focus();
  kulisa.invoke('project:new', { name });
};

// ---------- the grid ----------
// dockview lays out HTML; each profile's page is a native view, so after any change the main process gets where
// each pane's .content box is, or that it is not on screen (stacked behind another pane in a group).
const { createDockview, themeAbyssSpaced } = window['dockview-core'];
const panelId = (key) => `profile:${key}`;
const paneOf = (id) => panes.get(id.slice('profile:'.length));
const termEl = document.getElementById('term');
const terminalTab = Object.assign(document.createElement('div'), { className: 'ptab', innerHTML: '<b>Terminal</b>' });
const api = createDockview(document.getElementById('dock'), {
  theme: { ...themeAbyssSpaced, name: 'kulisa', gap: 8 }, // --gap in styles.css
  disableFloatingGroups: true,
  singleTabMode: 'fullwidth',
  createComponent: ({ id }) => ({ element: id === 'terminal' ? termEl : paneOf(id).el, init() {} }),
  createTabComponent: ({ id }) => ({ element: id === 'terminal' ? terminalTab : paneOf(id).tabEl, init() {} }),
});
window.__dock = api; // for tests

let layoutFrame = 0;
function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(sendLayout); }
function sendLayout() {
  const rects = {};
  for (const pane of panes.values()) {
    const panel = api.getPanel(panelId(pane.profile.key));
    const c = pane.el.querySelector('.content');
    if (!panel || !panel.api.isVisible || !c.isConnected || !c.offsetWidth) { rects[pane.profile.id] = { shown: false }; continue; }
    const r = c.getBoundingClientRect();
    rects[pane.profile.id] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  kulisa.send('layout', rects);
}
let saveTimer = 0;
api.onDidLayoutChange(() => {
  scheduleLayout();
  clearTimeout(saveTimer);
  if (!document.documentElement.classList.contains('loading')) saveTimer = setTimeout(() => kulisa.send('layout:save', api.toJSON()), 300); // not a grid being taken down or built
});
api.onDidActivePanelChange(scheduleLayout);

const addProfilePanel = (p, position, extra = {}) =>
  api.addPanel({ id: panelId(p.key), component: 'profile', tabComponent: 'profile', title: p.name, position, ...extra });
const addTerminal = (position) => api.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always', position });

// Ready-made arrangements; after one, panels move freely again.
const presets = {
  columns() {
    state.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(state[i - 1].key), direction: 'right' } : undefined));
    addTerminal({ direction: 'below' });
    return { height: 0.35 };
  },
  grid() {
    state.forEach((p, i) => addProfilePanel(p, i === 0 ? undefined
      : i === 1 ? { referencePanel: panelId(state[0].key), direction: 'right' }
        : { referencePanel: panelId(state[i - 2].key), direction: 'below' }));
    addTerminal({ direction: 'right' });
    return { width: 0.35 };
  },
  focus() {
    state.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(state[0].key), direction: 'within' } : undefined, { inactive: i > 0 }));
    addTerminal({ direction: 'below' });
    return { height: 0.35 };
  },
};
function applyPreset(name) {
  for (const p of state) if (!panes.has(p.key)) createPane(p);
  api.clear();
  const share = presets[name]();
  // The terminal's share of the window, once the grid has a size (at first start the window may have none yet).
  const dockEl = document.getElementById('dock');
  const size = () => {
    if (dockEl.clientHeight < 100) return false;
    api.layout(dockEl.clientWidth, dockEl.clientHeight);
    api.getPanel('terminal').group.api.setSize(share.height ? { height: Math.round(dockEl.clientHeight * share.height) }
      : { width: Math.round(dockEl.clientWidth * share.width) });
    return true;
  };
  if (!size()) { const ro = new ResizeObserver(() => size() && ro.disconnect()); ro.observe(dockEl); }
  scheduleLayout();
}
window.__layoutPreset = applyPreset; // for tests

// Another project is being opened: the grid goes (hidden at once, so nothing half-built shows) and is built again on
// that project's first state. The title bar stays; the terminal panel too, cleared for the next agent.
kulisa.on('project:closing', () => {
  document.documentElement.classList.add('loading');
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  clearTimeout(saveTimer);
  api.clear();
  panes.clear();
  state = [];
  gridReady = null;
  term.reset();
});

async function restoreGrid() {
  for (const p of state) createPane(p);
  const saved = await kulisa.invoke('layout:load');
  // A saved grid may name profiles deleted since; dockview needs a component for every panel in it.
  const known = (id) => id === 'terminal' || panes.has(id.slice('profile:'.length));
  const ok = saved && Object.keys(saved.panels || {}).every(known);
  if (ok) {
    try { api.fromJSON(saved); } catch (e) { console.warn('[layout] saved grid not restored:', e.message); api.clear(); }
  }
  if (!api.getPanel('terminal')) applyPreset('columns');
}

// Panels follow the profiles: a new profile goes next to the last profile pane (or above the terminal), a
// deleted one goes away.
function syncGrid() {
  for (const [key, pane] of panes) {
    if (state.some((p) => p.key === key)) continue;
    const panel = api.getPanel(panelId(key));
    if (panel) api.removePanel(panel);
    panes.delete(key);
  }
  for (const p of state) {
    if (!panes.has(p.key)) createPane(p);
    if (api.getPanel(panelId(p.key))) continue;
    const last = api.panels.filter((x) => x.id !== 'terminal').at(-1);
    addProfilePanel(p, last ? { referencePanel: last.id, direction: 'right' } : { referencePanel: 'terminal', direction: 'above' });
  }
}

// Dragging a panel (drop targets are HTML) or a menu: the pages are native views above the window's HTML, so
// meanwhile they become pictures of themselves.
let frozen = null;
function freeze() {
  return frozen ??= kulisa.invoke('views:hidden', true, { snapshots: true }).then((pics) => {
    for (const pane of panes.values()) {
      const src = pics[pane.profile.id];
      if (src) pane.el.querySelector('.content').append(Object.assign(document.createElement('img'), { className: 'snapshot', src }));
    }
  });
}
async function unfreeze() {
  if (!frozen) return;
  const f = frozen; frozen = null;
  await f;
  if (frozen) return; // a new drag began meanwhile
  for (const img of document.querySelectorAll('.pane .content img.snapshot')) img.remove();
  await kulisa.invoke('views:hidden', viewsCovered());
  scheduleLayout();
}
Object.assign(menuCover, { cover: freeze, uncover: unfreeze }); // menu.js
api.onWillDragPanel(freeze);
api.onWillDragGroup(freeze);
api.onDidDrop(unfreeze);
document.addEventListener('dragend', unfreeze, true);
document.addEventListener('drop', () => setTimeout(unfreeze), true);

// ---------- the window's menu (⋮) and zoom ----------
// The Kulisa zoom (the main process zooms this page and the profiles' pages with it). Shown in the top bar only when
// it is not 100%, as Chrome does; a click there resets it.
const zoomReset = document.getElementById('zoomReset');
let uiZoom = 1;
const showZoom = (z) => {
  uiZoom = z; zoomReset.hidden = z === 1;
  for (const el of [zoomReset, document.querySelector('#menu .zoomrow output')]) if (el) el.textContent = `${Math.round(z * 100)}%`;
};
kulisa.invoke('zoom:get').then(showZoom);
kulisa.on('zoom', (z) => { showZoom(z); scheduleLayout(); });
zoomReset.onclick = () => kulisa.invoke('zoom:ui', 0);
const windowMenu = document.getElementById('windowMenu');
// ⋮, as Chrome's: the zoom row (stays open while you click − and +), then the ready-made arrangements.
windowMenu.onclick = () => {
  const zoom = tpl('tpl-menuzoom');
  zoom.querySelector('output').textContent = `${Math.round(uiZoom * 100)}%`;
  zoom.querySelector('.in').onclick = () => kulisa.invoke('zoom:ui', 1);
  zoom.querySelector('.out').onclick = () => kulisa.invoke('zoom:ui', -1);
  openMenu([
    { element: zoom },
    '-',
    { heading: 'Arrange panels' },
    { label: 'Profiles in columns, terminal below', run: () => applyPreset('columns') },
    { label: 'Profiles two by two, terminal right', run: () => applyPreset('grid') },
    { label: 'One profile at a time, terminal below', run: () => applyPreset('focus') },
  ], windowMenu);
};

// ---------- context menus ----------
// Right-click on a pane's header, a tab, the terminal.
document.addEventListener('contextmenu', (e) => {
  const header = e.target.closest('.ptab[data-panel^="profile:"]');
  const tab = e.target.closest('.tabs .tab');
  const items = header ? paneMenu(paneOf(header.dataset.panel)) : tab ? tabMenu(e.target.closest('.pane').dataset.profile, tab.dataset.tab)
    : e.target.closest('#term') ? terminalMenu() : null;
  if (!items) return;
  e.preventDefault();
  openMenu(items, e);
});
function paneMenu(pane) {
  const p = pane.profile;
  return [
    { label: 'New tab', run: () => kulisa.invoke('tab:new', { profile: p.id }) },
    { label: 'Rename', keys: 'Double-click', run: () => renameProfile(pane, pane.tabEl.querySelector('.pname')) },
    { label: 'Close profile', run: () => kulisa.invoke('profile:close', { profile: p.id }) },
    '-',
    { label: 'Delete profile…', run: () => deleteProfile(p) },
  ];
}
function tabMenu(profile, tab) {
  const p = state.find((x) => x.id === profile), t = p.tabs.find((x) => x.id === tab);
  return [
    { label: 'Reload', run: () => kulisa.invoke('tab:reload', { profile, tab }) },
    { label: 'Duplicate', run: () => kulisa.invoke('tab:new', { profile, url: t.url }) },
    '-',
    { label: 'Close tab', run: () => kulisa.invoke('tab:close', { profile, tab }) },
    { label: 'Close other tabs', enabled: p.tabs.length > 1,
      run: () => { for (const x of p.tabs) if (x.id !== tab) kulisa.invoke('tab:close', { profile, tab: x.id }); } },
  ];
}
function terminalMenu() {
  return [
    { label: 'Copy', keys: 'Ctrl+Shift+C', enabled: term.hasSelection(), run: () => navigator.clipboard.writeText(term.getSelection()) },
    { label: 'Paste', keys: 'Ctrl+Shift+V', run: () => navigator.clipboard.readText().then((t) => term.paste(t)) },
    { label: 'Select all', run: () => term.selectAll() },
    '-',
    { label: 'Clear', run: () => term.clear() },
  ];
}

// ---------- agent activity: caption over the pane (the cursor itself is drawn inside the page, see ghost.js) ----------
kulisa.on('agent', (a) => {
  const pane = [...panes.values()].find((x) => x.profile.id === a.profile);
  if (!pane || pane.profile.signinMode) return;
  const cap = pane.tabEl.querySelector('.caption');
  cap.textContent = a.caption ? `↖ agent: ${a.caption}` : '';
  clearTimeout(pane.capTimer);
  // A sticky caption (what highlighted elements are) stays until the next one.
  if (!a.sticky) pane.capTimer = setTimeout(() => { if (!pane.profile.signinMode) cap.textContent = ''; }, 4000);
});

// ---------- point and tell ----------
// ⌖ Pick, then click an element: a reference to it lands in the agent's prompt (not sent), and the terminal gets
// the focus, so the human writes what is wrong around it. Picks in several panes go into one message.
// Pick again or Esc in the page cancels.
async function startPick(profile) {
  const pane = [...panes.values()].find((x) => x.profile.id === profile);
  const cap = pane.tabEl.querySelector('.caption');
  const button = pane.el.querySelector('.pick');
  cap.textContent = '⌖ click an element on the page · Esc to cancel';
  button.classList.add('active');
  const res = await kulisa.invoke('pick:start', { profile });
  button.classList.remove('active');
  cap.textContent = res && res.error ? `Pick failed: ${res.error}` : '';
}

// ---------- terminal ----------
// xterm.js set up as VS Code does: Unicode 11 character widths (Claude Code draws ✅ ⏵ ✻ and the like; with the
// default Unicode 6 widths the cursor and the input line drift off the text), the WebGL renderer, and a bundled
// font so it looks and measures the same on every OS.
// The UI's text size (--font in styles.css), so the terminal matches the rest.
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fontSize = parseFloat(css('--font')) || 14;
const term = new Terminal({ fontSize, fontFamily: '"JetBrains Mono", monospace', cursorBlink: true,
  allowProposedApi: true, theme: { background: css('--island'), foreground: css('--text') } }); // the panels' colors
term.loadAddon(new Unicode11Addon.Unicode11Addon());
term.unicode.activeVersion = '11';
const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
// Open once the font is loaded: xterm measures the cell size at open. Output written before is kept.
Promise.all([`${fontSize}px`, `bold ${fontSize}px`].map((f) => document.fonts.load(`${f} "JetBrains Mono"`))).catch(() => {}).then(() => {
  term.open(termEl);
  window.__termRenderer = 'dom';
  try {
    const webgl = new WebglAddon.WebglAddon();
    webgl.onContextLoss(() => { webgl.dispose(); window.__termRenderer = 'dom'; }); // back to the DOM renderer
    term.loadAddon(webgl);
    window.__termRenderer = 'webgl';
  } catch (e) { console.warn('[terminal] WebGL renderer unavailable:', e.message); }
  fitTerminal();
});
// Only once the terminal is in its panel and the grid has settled: the agent starts at the first size sent
// (terminal.js) and draws its prompt for it.
let fitTimer = 0;
window.__ptySizes = []; // for tests
const fitTerminal = () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    if (!term.element || !termEl.closest('#dock')) return;
    try { fit.fit(); } catch { return; }
    const size = { cols: term.cols, rows: term.rows };
    window.__ptySizes.push(size);
    kulisa.send('pty:resize', size);
  }, 100);
};
new ResizeObserver(fitTerminal).observe(termEl);
term.onData((d) => kulisa.send('pty:in', d));
kulisa.on('pty:out', (d) => term.write(d));
kulisa.on('terminal:focus', () => term.focus());
// Ctrl+Shift+C copies the selection, Ctrl+Shift+V pastes (terminal convention); Ctrl+C stays SIGINT.
term.attachCustomKeyEventHandler((e) => {
  if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') { navigator.clipboard.writeText(term.getSelection()); return false; }
  if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyV') { navigator.clipboard.readText().then((t) => term.paste(t)); return false; }
  return true;
});
window.__term = term; // for tests
