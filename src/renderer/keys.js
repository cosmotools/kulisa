// Keyboard shortcuts in the window (main/keys.js has the table and takes the keys; docs/window.md, Keys). The main
// process has to know where the keyboard is in this page to know whose a key is: the terminal's agent gets all but a
// few, a pane (its address bar, its toolbar) gets Chrome's keys for that profile, a dialog keeps its own. It sends
// the commands back here, with the profile and tab they act on.
(() => {
  let zone = 'window';
  let lastPane = null; // the profile whose page or pane had the keyboard last: where Ctrl+` goes back to
  const zoneOf = (el) => {
    if (document.querySelector('dialog:modal')) return 'dialog'; // its keys are its own, wherever its focus is (none, at first)
    if (!el || el === document.body) return 'window';
    if (el.closest('.xterm')) return 'terminal';
    const pane = el.closest('.pane');
    return pane ? `pane:${pane.dataset.profile}` : 'window';
  };
  const report = () => {
    const z = zoneOf(document.activeElement);
    if (z.startsWith('pane:')) lastPane = z.slice('pane:'.length);
    if (z !== zone) { zone = z; kulisa.send('keys:zone', z); }
  };
  document.addEventListener('focusin', report);
  document.addEventListener('focusout', () => setTimeout(report)); // where it went is known after the event
  new MutationObserver(report).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] }); // a dialog opened or closed

  // A workspace's tab in the projects' bar shown, as a click on it does (workspaces.js).
  const showWs = (tab) => { if (tab && tab.dataset.ws !== workspaces.current) kulisa.invoke('ws:show', tab.dataset.ws); };
  // What each command does. page: the key was typed in the profile's page, so the keyboard stays in its pages.
  const run = {
    'terminal.focus': () => (zone === 'terminal' && lastPane ? focusPage(lastPane) : term?.focus()),
    'terminal.new': () => act('terminal:open'),
    'workspace.n': ({ n }) => showWs(document.querySelectorAll('#wslist .wstab')[n - 1]),
    'workspace.next': () => stepWs(1),
    'workspace.previous': () => stepWs(-1),
    'workspace.new': () => { const add = document.getElementById('wsadd'); if (!add.classList.contains('off')) add.click(); },
    shortcuts: async () => (await import('./shortcuts.js')).showShortcuts(),
    'tab.new': ({ pane }) => newTab(pane),
    'tab.close': ({ p, tab, page }) => act('tab:close', { profile: p.id, tab, focus: page }),
    'tab.reopen': ({ p }) => act('tab:reopen', { profile: p.id }),
    'tab.address': ({ pane }) => { const addr = pane.el.querySelector('.addr'); addr.focus(); addr.select(); },
    'tab.reload': ({ p, tab }) => act('tab:reload', { profile: p.id, tab }),
    'tab.reloadAll': ({ p, tab }) => act('tab:reload', { profile: p.id, tab, ignoreCache: true }),
    'tab.back': ({ p, tab }) => act('tab:back', { profile: p.id, tab }),
    'tab.forward': ({ p, tab }) => act('tab:forward', { profile: p.id, tab }),
    'tab.next': (c) => toTab(c, (i, n) => (i + 1) % n),
    'tab.previous': (c) => toTab(c, (i, n) => (i - 1 + n) % n),
    'tab.n': (c) => toTab(c, (_i, n) => (c.n <= n ? c.n - 1 : -1)),
    'tab.last': (c) => toTab(c, (_i, n) => n - 1),
    pick: ({ pane }) => pane.el.querySelector('.pick').click(), // again: cancels, as the button does
  };
  // Every open project's workspaces, in the bar's order.
  function stepWs(dir) {
    const all = [...document.querySelectorAll('#projectTabs .wstab')];
    const i = all.findIndex((t) => t.dataset.ws === workspaces.current);
    if (all.length > 1) showWs(all[(i + dir + all.length) % all.length]);
  }
  function toTab({ p, tab, page }, to) {
    const i = to(p.tabs.findIndex((t) => t.id === tab), p.tabs.length);
    if (p.tabs[i] && p.tabs[i].id !== tab) act('tab:activate', { profile: p.id, tab: p.tabs[i].id, focus: page });
  }
  const focusPage = (id) => { const p = paneOfProfile(id)?.profile; if (p) act('tab:focus', { profile: id, tab: p.active }); };

  kulisa.on('command', ({ id, n, profile, tab, ws, page }) => {
    if (ws !== workspaces.current || !run[id]) return; // a key typed as another workspace was coming
    const pane = profile && paneOfProfile(profile);
    if (profile && !pane) return;
    if (page) lastPane = profile;
    run[id]({ n, page, pane, p: pane?.profile, tab: tab || pane?.profile.active });
  });
})();
