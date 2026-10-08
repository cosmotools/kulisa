// Kulisa window UI: wires the parts (common.js, menu.js, terminal.js, projects.js, workspaces.js, profile-editor.js)
// to a grid of peer panels (dockview) of the shown workspace: one pane per profile (tab strip, address bar; the page
// itself is a WebContentsView laid over .content by the main process) and the terminal. Panels can be dragged,
// stacked as tabs and resized; each workspace's grid is saved (its layout.json) and restored. Also the ☰ menu,
// right-click menus, the agent's captions and point-and-tell.
const panes = new Map(); // profile key (its folder; stable across renames) -> { el, tabEl, profile }
let state = []; // the open profiles of the shown workspace, as the main process sends them
let gridReady = null;
let leaving = null; // the grid being taken down, before the next one is built
let sliding = null; // a workspace switch as a view transition: { transition, built } until the next grid is built
const pictures = new Map(); // workspace key -> { profile id: data URL }: its pages when it was left, for sliding in
const dockEl = document.getElementById('dock');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

kulisa.on('state', async (s) => {
  await leaving; // the grid on screen goes first (it clears the state)
  state = s;
  const first = !gridReady;
  await (gridReady ??= restoreGrid());
  render();
  if (first) reveal();
});
// Until the grid is built and the pages have their places, the window shows no grid and the main process keeps the
// pages hidden (html.loading): nothing jumps while the window loads, e.g. when another project is opened. A workspace
// shown from the strip slides in with pictures of its pages (grid:closing), then the pages themselves come.
function reveal() {
  if (sliding) {
    const { transition, built } = sliding; sliding = null;
    document.documentElement.classList.remove('loading');
    showPictures(pictures.get(workspaces.current) || {});
    built(); // the transition's new state: it slides in
    transition.finished.then(() => {
      for (const img of document.querySelectorAll('.pane .content img.snapshot')) img.remove();
      sendLayout();
      kulisa.invoke('views:hidden', viewsCovered());
    });
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { // after sendLayout's frame
    document.documentElement.classList.remove('loading');
    kulisa.invoke('views:hidden', viewsCovered());
  }));
}
// Pictures of the pages in their panes (by profile id), standing in for the native views (hidden meanwhile).
function showPictures(pics) {
  for (const pane of panes.values()) {
    const src = pics[pane.profile.id];
    if (src) pane.el.querySelector('.content').append(Object.assign(document.createElement('img'), { className: 'snapshot', src }));
  }
}

// ---------- panes ----------
profileEditor.showPane = (key) => api.getPanel(panelId(key))?.api.setActive();

function render() {
  profileEditor.update(state);
  syncGrid();
  for (const p of state) {
    const pane = panes.get(p.key);
    pane.profile = p;
    pane.el.dataset.profile = p.id;
    renderTabs(pane, p);
    pane.tabEl.querySelector('.pname').textContent = p.name;
    pane.tabEl.querySelector('.pname').title = `${p.description ? `${p.description}\n\n` : ''}Double-click to rename`;
    pane.tabEl.querySelector('.avatar').src = avatarSrc(p.avatar);
    const cap = pane.tabEl.querySelector('.caption');
    if (p.signinMode) { cap.textContent = '🔒 Sign-in page — agent paused'; pane.signinShown = true; }
    else if (pane.signinShown) { cap.textContent = ''; pane.signinShown = false; }
    const active = p.tabs.find((t) => t.id === p.active);
    pane.el.querySelector('.back').disabled = !active?.canBack;
    pane.el.querySelector('.fwd').disabled = !active?.canFwd;
    // Pick needs a page to point at: off on an empty tab (about:blank), unless picking already.
    const pick = pane.el.querySelector('.pick');
    pick.disabled = !pick.classList.contains('active') && (!active?.url || active.url === 'about:blank');
    // The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it.
    const zoom = pane.el.querySelector('.zoom');
    zoom.hidden = !active || active.zoom === 1;
    if (active) zoom.textContent = `${Math.round(active.zoom * 100)}%`;
    const addr = pane.el.querySelector('.addr');
    if (document.activeElement !== addr) addr.value = active ? shortUrl(active.url) : '';
    // A tab the human opened (+, New tab): the address gets the focus once the tab is the active one, as in Chrome.
    if (pane.typeInto && pane.typeInto === p.active) { pane.typeInto = null; addr.focus(); }
  }
  scheduleLayout();
}

// The tab strip; clicks are handled for the whole strip in createPane. Kept by tab id: a tab's element stays, and one
// opened in a strip already shown grows in from the left, as Chrome's (window.css, .tab.opening).
function renderTabs(pane, p) {
  const strip = pane.el.querySelector('.tabs .strip');
  const els = (pane.tabEls ??= new Map());
  const shown = els.size > 0;
  for (const id of els.keys()) if (!p.tabs.some((t) => t.id === id)) { els.get(id).remove(); els.delete(id); }
  p.tabs.forEach((t, i) => {
    let el = els.get(t.id);
    if (!el) {
      el = tpl('tpl-tab'); el.dataset.tab = t.id; els.set(t.id, el);
      if (shown) {
        el.classList.add('opening');
        el.addEventListener('animationend', () => { el.classList.remove('opening'); activeInSight(strip); }, { once: true }); // grown: in sight again
      }
    }
    if (strip.children[i] !== el) strip.insertBefore(el, strip.children[i] || null); // moved only when out of place
    el.classList.toggle('active', t.id === p.active);
    el.title = t.url;
    const img = el.querySelector('img');
    if (t.favicon) { if (img.getAttribute('src') !== t.favicon) img.src = t.favicon; img.hidden = false; } else img.hidden = true;
    el.querySelector('.title').textContent = (t.loading ? '⟳ ' : '') + (t.title || t.url || 'New tab');
  });
  activeInSight(strip);
}
// The active tab in sight, as Chrome scrolls to it.
function activeInSight(strip) {
  const a = strip.querySelector('.tab.active')?.getBoundingClientRect();
  if (!a) return;
  const { left: start, right: end } = strip.getBoundingClientRect();
  if (a.left < start) strip.scrollLeft -= start - a.left;
  else if (a.right > end) strip.scrollLeft += a.right - end;
}

// A pane: its panel content (el) and its header in the grid (tabEl: picture, name, the agent's caption).
function createPane(p) {
  const el = tpl('tpl-pane');
  const tabEl = tpl('tpl-ptab');
  tabEl.dataset.panel = panelId(p.key);
  const pane = { el, tabEl, profile: p, add: el.querySelector('.tabs .add') };
  panes.set(p.key, pane);
  const id = () => pane.profile.id;
  const tab = () => pane.profile.active;
  el.querySelector('.tabs .strip').onwheel = (e) => { if (!e.deltaX) e.currentTarget.scrollLeft += e.deltaY; };
  el.querySelector('.tabs').onclick = (e) => {
    const t = e.target.closest('.tab')?.dataset.tab;
    if (e.target.closest('.add')) newTab(pane);
    else if (t && e.target.closest('.x')) act('tab:close', { profile: id(), tab: t });
    else if (t) act('tab:activate', { profile: id(), tab: t });
  };
  el.querySelector('.back').onclick = () => act('tab:back', { profile: id(), tab: tab() });
  el.querySelector('.fwd').onclick = () => act('tab:forward', { profile: id(), tab: tab() });
  el.querySelector('.reload').onclick = () => act('tab:reload', { profile: id(), tab: tab() });
  const addr = el.querySelector('.addr');
  addr.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    act('tab:navigate', { profile: id(), tab: tab(), url: e.target.value });
    e.target.blur();
  };
  // As Chrome's: shown without https:// and www. (shortUrl); getting the focus shows the whole address, selected; a
  // click while editing places the caret, a drag selects.
  const url = () => { const u = pane.profile.tabs.find((t) => t.id === tab())?.url || ''; return u === 'about:blank' ? '' : u; };
  let clickedIn = false;
  addr.onfocus = () => { addr.value = url(); addr.select(); };
  addr.onblur = () => { addr.value = shortUrl(url()); };
  addr.onmousedown = () => { clickedIn = document.activeElement !== addr; };
  addr.onmouseup = (e) => {
    if (clickedIn && addr.selectionStart === addr.selectionEnd) { e.preventDefault(); addr.select(); }
    clickedIn = false;
  };
  el.querySelector('.zoom').onclick = () => act('tab:zoom', { profile: id(), tab: tab(), dir: 0 });
  el.querySelector('.pick').onclick = (e) => (e.currentTarget.classList.contains('active') ? kulisa.invoke('pick:cancel', { profile: id() }) : startPick(id()));
  // ⋮ at the end of the bar, as Chrome's: what a pane does less often.
  const more = el.querySelector('.more');
  more.onclick = () => openMenu([
    { label: 'DevTools', keys: 'F12', run: () => act('tab:devtools', { profile: id(), tab: tab() }) },
  ], more);
  const pname = tabEl.querySelector('.pname');
  pname.ondblclick = () => renameProfile(pane, pname);
  tabEl.querySelector('.close').onclick = () => act('profile:close', { profile: id() });
  new ResizeObserver(scheduleLayout).observe(el.querySelector('.content'));
  return pane;
}

// An address as Chrome shows it in the omnibox when not editing: no http(s)://, no www., no lone trailing /.
const shortUrl = (u) => (u === 'about:blank' ? '' : u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^([^/?#]+)\/$/, '$1');

const newTab = async (pane) => { pane.typeInto = await act('tab:new', { profile: pane.profile.id }); render(); };

function renameProfile(pane, pname) {
  const input = Object.assign(document.createElement('input'), { value: pane.profile.name, size: 24, maxLength: 64 });
  input.dataset.name = ''; // only the characters names may have (common.js)
  pname.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    input.replaceWith(pname);
    const name = input.value.trim();
    if (save && name && name !== pane.profile.name) act('profile:rename', { profile: pane.profile.id, name });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(false));
}

// ---------- the grid ----------
// dockview lays out HTML; each profile's page is a native view, so after any change the main process gets where
// each pane's .content box is, or that it is not on screen (stacked behind another pane in a group).
const { createDockview, themeAbyssSpaced } = window['dockview-core'];
const panelId = (key) => `profile:${key}`;
const paneOf = (id) => panes.get(id.slice('profile:'.length));
const terminalTab = Object.assign(document.createElement('div'), { className: 'ptab', innerHTML: '<b>Terminal</b>' });
const api = createDockview(document.getElementById('dock'), {
  theme: { ...themeAbyssSpaced, name: 'kulisa', gap: 8 }, // --gap in tokens.css
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
  kulisa.send('layout', { ws: workspaces.current, rects });
}
let saveTimer = 0;
api.onDidLayoutChange(() => {
  scheduleLayout();
  clearTimeout(saveTimer);
  if (!document.documentElement.classList.contains('loading')) saveTimer = setTimeout(() => kulisa.send('layout:save', { ws: workspaces.current, layout: api.toJSON() }), 300); // not a grid being taken down or built
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
  // The terminal's share of the window, once the grid has a size (at first start the window may have none yet). The
  // grid's room is #dock less its padding (the gaps at the window's edges): laid out to clientWidth, it was that much
  // wider and taller than its room, the right and bottom cut off until the window was resized.
  const size = () => {
    const s = getComputedStyle(dockEl);
    const w = dockEl.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    const h = dockEl.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
    if (h < 100) return false;
    api.layout(w, h);
    api.getPanel('terminal').group.api.setSize(share.height ? { height: Math.round(h * share.height) } : { width: Math.round(w * share.width) });
    return true;
  };
  if (!size()) { const ro = new ResizeObserver(() => size() && ro.disconnect()); ro.observe(dockEl); }
  scheduleLayout();
}
window.__layoutPreset = applyPreset; // for tests

// Another workspace is being shown, or another project (dir: where it is in the projects' bar; 0: none, the window
// is left with no project; level: 'workspace' or 'project'): the grid goes and is built again on the next state, as a
// view transition (window.css): Chromium takes a picture of the grid on screen, with pictures of its pages (the main
// process sends them; kept for when it comes back), and shows it while the next grid is built (reveal). Another
// project's grid slides in as macOS desktops do, the one left out and the next one in at once; another workspace's
// replaces it at once. Not with reduced motion: then the grid is hidden at once, so nothing half-built shows. The
// title bar and the projects' bar stay; the terminal panel too, showing the next workspace's terminal (workspaces.js).
kulisa.on('grid:closing', ({ dir, level, ws, pics }) => {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  clearTimeout(saveTimer);
  if (pics) pictures.set(ws, pics);
  const takeDown = () => {
    document.documentElement.classList.add('loading');
    frozen = null;
    api.clear();
    panes.clear();
    state = [];
    gridReady = null;
  };
  sliding = null;
  if (!dir || reducedMotion.matches || !gridReady) { takeDown(); leaving = null; return; }
  showPictures(pics || {});
  let cleared, built;
  leaving = new Promise((r) => (cleared = r));
  const next = new Promise((r) => (built = r));
  // While the next grid is built (the callback), Chromium shows the picture of this one and draws no frames: the
  // building must not wait for one (reveal).
  const transition = document.startViewTransition({ update: () => { takeDown(); cleared(); return next; }, types: [level, dir > 0 ? 'next' : 'previous'] });
  sliding = { transition, built };
});

// Workspaces gone (their project closed, a fork deleted): their terminals and pictures too; a workspace opened again
// later starts afresh.
kulisa.on('workspaces:closed', (keys) => {
  for (const key of keys) pictures.delete(key);
  forgetTerminals(keys);
});

async function restoreGrid() {
  for (const p of state) createPane(p);
  const saved = await act('layout:load');
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
  return frozen ??= kulisa.invoke('views:hidden', true, { snapshots: true }).then(showPictures);
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

// ---------- the window's menu (☰) and zoom ----------
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
// The theme of Kulisa's own UI (app.js): Dark, Light or System, chosen in ☰; the first one came in the URL
// (index.html). CSS does the rest (tokens.css: color-scheme, light-dark()); the terminal takes its colors again, also
// when the OS changes its own (System).
const root = document.documentElement;
const showTheme = () => { for (const b of document.querySelectorAll('#menu .themerow [data-theme]')) b.ariaPressed = String(b.dataset.theme === root.dataset.theme); };
kulisa.on('theme', (theme) => { root.dataset.theme = theme; themeTerminals(); showTheme(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeTerminals);
// Where the projects' bar is (app.js: top or bottom), chosen in ☰ as the theme; the grid gets the room left.
kulisa.on('bar', (bar) => { root.dataset.bar = bar; scheduleLayout(); });
const windowMenu = document.getElementById('windowMenu');
// ☰, as Chrome's ⋮: the zoom row (stays open while you click − and +), the theme row and the projects' bar's (open
// too), then the ready-made arrangements, each a picture of itself (seen at a glance, as Windows' snap layouts), its
// words in the tooltip; Agents… (agents.js); Exit, as Chrome's, where the OS has no menu bar with Quit (not macOS:
// Cmd+Q there). Each row with its icon at the start.
windowMenu.onclick = () => {
  const zoom = tpl('tpl-menuzoom');
  zoom.querySelector('output').textContent = `${Math.round(uiZoom * 100)}%`;
  zoom.querySelector('.in').onclick = () => kulisa.invoke('zoom:ui', 1);
  zoom.querySelector('.out').onclick = () => kulisa.invoke('zoom:ui', -1);
  const themes = tpl('tpl-menutheme');
  themes.onclick = (e) => { const t = e.target.closest('[data-theme]')?.dataset.theme; if (t) kulisa.invoke('theme:set', t); };
  for (const b of themes.querySelectorAll('[data-theme]')) b.ariaPressed = String(b.dataset.theme === root.dataset.theme);
  const bar = tpl('tpl-menubar');
  bar.onclick = (e) => {
    const b = e.target.closest('[data-bar]');
    if (!b) return;
    kulisa.invoke('bar:set', b.dataset.bar);
    for (const o of bar.querySelectorAll('[data-bar]')) o.ariaPressed = String(o === b);
  };
  for (const b of bar.querySelectorAll('[data-bar]')) b.ariaPressed = String(b.dataset.bar === root.dataset.bar);
  const arrange = tpl('tpl-menuarrange');
  arrange.onclick = (e) => {
    const preset = e.target.closest('[data-preset]')?.dataset.preset;
    if (!preset) return;
    document.getElementById('menu').hidePopover();
    applyPreset(preset);
  };
  openMenu([{ element: zoom }, { element: themes }, { element: bar }, '-', { heading: 'Arrange panels', icon: 'i-arrange' }, { element: arrange }, '-',
    { label: 'Agents…', icon: 'i-agent', run: async () => (await import('./agents.js')).showAgents() },
    ...(kulisa.platform === 'darwin' ? [] : ['-', { label: 'Exit', icon: 'i-exit', run: () => kulisa.invoke('app:quit') }])], windowMenu);
};

// ---------- context menus ----------
// Right-click on a pane's header, a tab, the terminal (terminal.js).
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
    { label: 'New tab', run: () => newTab(pane) },
    { label: 'Rename', keys: 'Double-click', run: () => renameProfile(pane, pane.tabEl.querySelector('.pname')) },
    { label: 'About this profile…', run: () => profileEditor.about(p.key) },
    { label: 'Close profile', run: () => act('profile:close', { profile: p.id }) },
    '-',
    { label: 'Delete profile…', run: () => deleteProfile(p) },
  ];
}
function tabMenu(profile, tab) {
  const p = state.find((x) => x.id === profile), t = p.tabs.find((x) => x.id === tab);
  return [
    { label: 'Reload', run: () => act('tab:reload', { profile, tab }) },
    { label: 'Duplicate', run: () => act('tab:new', { profile, url: t.url }) },
    '-',
    { label: 'Close tab', run: () => act('tab:close', { profile, tab }) },
    { label: 'Close other tabs', enabled: p.tabs.length > 1,
      run: () => { for (const x of p.tabs) if (x.id !== tab) act('tab:close', { profile, tab: x.id }); } },
  ];
}

// ---------- agent activity: caption over the pane (the cursor itself is drawn inside the page, see ghost.js) ----------
kulisa.on('agent', (a) => {
  if (a.ws !== workspaces.current) return; // a workspace in the background
  const pane = [...panes.values()].find((x) => x.profile.id === a.profile);
  if (!pane || pane.profile.signinMode) return;
  const cap = pane.tabEl.querySelector('.caption');
  cap.textContent = a.caption ? `↖ agent: ${a.caption}` : '';
  clearTimeout(pane.capTimer);
  // A sticky caption (what highlighted elements are) stays until the next one.
  if (!a.sticky) pane.capTimer = setTimeout(() => { if (!pane.profile.signinMode) cap.textContent = ''; }, 4000);
});

// ---------- point and tell ----------
// Pick, then click an element: a reference to it lands in the agent's prompt (not sent), and the terminal gets
// the focus, so the human writes what is wrong around it. Picks in several panes go into one message.
// Pick again or Esc in the page cancels.
async function startPick(profile) {
  const pane = [...panes.values()].find((x) => x.profile.id === profile);
  const cap = pane.tabEl.querySelector('.caption');
  const button = pane.el.querySelector('.pick');
  cap.textContent = 'Click an element on the page · Esc to cancel';
  button.classList.add('active');
  const res = await kulisa.invoke('pick:start', { profile });
  button.classList.remove('active');
  cap.textContent = res && res.error ? `Pick failed: ${res.error}` : '';
}

