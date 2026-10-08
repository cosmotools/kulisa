// The terminal panel: each workspace's agent CLI in an xterm.js of its own, the panel showing the shown workspace's
// (the others keep their output while in the background). Set up as VS Code does: Unicode 11 character widths
// (Claude Code draws ✅ ⏵ ✻ and the like; with the default Unicode 6 widths the cursor and the input line drift off
// the text), the WebGL renderer, and a bundled font so it looks and measures the same on every OS. The UI's text size
// (--font in tokens.css), so the terminal matches the rest.
//   termEl              the panel's element (renderer.js puts it in its panel)
//   term                the shown workspace's terminal
//   showTerminal(ws)    show a workspace's terminal (made the first time)
//   forgetTerminals(keys)  forget those of workspaces gone (their project closed or moved, a fork deleted)
//   terminalsOf(project)   what a project's terminals show, for the window it moves to (terminals:restore there)
//   terminalMenu()      its right-click menu (menu.js items)
//   themeTerminals()    the colors again, after the theme changed
const termEl = document.getElementById('term');
const terminals = new Map(); // workspace key -> { term, el, fit, opened }
let term = null, shownTerminal = null;
Object.defineProperty(window, '__term', { get: () => term }); // for tests
window.__ptySizes = []; // for tests: the sizes sent for the shown workspace
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const termFontSize = parseFloat(css('--font')) || 14;
// xterm measures the cell size when it opens: once the font is loaded. Output written before is kept.
const termFont = Promise.all([`${termFontSize}px`, `bold ${termFontSize}px`].map((f) => document.fonts.load(`${f} "JetBrains Mono"`))).catch(() => {});

// The panels' colors (tokens.css), set again when the theme changes (themeTerminals). The programs' own colors (ANSI)
// stay xterm's: it makes them readable on either background (minimumContrastRatio, WCAG AA; VS Code does the same).
// A token is light-dark(…): its color as now shown is read through an element that uses it.
const probe = Object.assign(document.createElement('i'), { hidden: true });
document.body.append(probe);
const shown = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
const termTheme = () => ({ background: shown('--island'), foreground: shown('--text'), cursor: shown('--text'), cursorAccent: shown('--island'),
  selectionBackground: shown('--selection') });
function themeTerminals() { for (const { term: t } of terminals.values()) t.options.theme = termTheme(); }

// Links in the terminal: those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (the web-links
// addon). Ctrl+click (⌘ on macOS) asks where, in a menu at the pointer: a tab of one of the shown workspace's open
// profiles, or the user's browser. Always asked, so a link never opens somewhere unexpected (the author's choice:
// which profile a link belongs to cannot be told). http and https only; the address shows on hover.
const termLinks = {
  activate(e, uri) {
    if (!(kulisa.platform === 'darwin' ? e.metaKey : e.ctrlKey) || !/^https?:\/\//i.test(uri)) return;
    openMenu([{ heading: uri }, ...state.map((p) => ({ label: `Open in ${p.name}`, avatar: p.avatar,
      run: () => act('tab:new', { profile: p.id, url: uri }) })),
    '-', { label: 'Open in your browser', run: () => window.open(uri) }], e);
  },
  hover(_e, uri) { termEl.title = uri; },
  leave() { termEl.title = ''; },
};

// size: { cols, rows } to start with (a terminal coming from another window: its contents are laid out for it).
function makeTerminal(ws, size) {
  const el = Object.assign(document.createElement('div'), { className: 'xterm-host', hidden: true });
  termEl.append(el);
  const t = new Terminal({ ...size, fontSize: termFontSize, fontFamily: '"JetBrains Mono", monospace', cursorBlink: true,
    allowProposedApi: true, theme: termTheme(), minimumContrastRatio: 4.5, linkHandler: termLinks });
  t.loadAddon(new Unicode11Addon.Unicode11Addon());
  t.unicode.activeVersion = '11';
  const fit = new FitAddon.FitAddon();
  t.loadAddon(fit);
  t.loadAddon(new WebLinksAddon.WebLinksAddon(termLinks.activate, termLinks));
  const serialize = new SerializeAddon.SerializeAddon();
  t.loadAddon(serialize);
  const entry = { term: t, el, fit, serialize, opened: false };
  terminals.set(ws, entry);
  termFont.then(() => {
    if (terminals.get(ws) !== entry) return; // forgotten meanwhile
    t.open(el);
    entry.renderer = 'dom';
    try {
      const webgl = new WebglAddon.WebglAddon();
      webgl.onContextLoss(() => { webgl.dispose(); entry.renderer = 'dom'; }); // back to the DOM renderer
      t.loadAddon(webgl);
      entry.renderer = 'webgl';
    } catch (e) { console.warn('[terminal] WebGL renderer unavailable:', e.message); }
    entry.opened = true;
    if (shownTerminal === ws) { window.__termRenderer = entry.renderer; fitTerminal(); }
  });
  t.onData((data) => kulisa.send('pty:in', { ws, data }));
  t.attachCustomKeyEventHandler((e) => {
    const does = e.type === 'keydown' && clipboardKey(e, kulisa.platform, t.hasSelection());
    if (does === 'copy') { termCopy(); if (kulisa.platform === 'win32') t.clearSelection(); }
    return !does; // a paste is the page's own (Chromium's Ctrl+V, Ctrl+Shift+V), which xterm takes: pasting here too doubled it
  });
  return entry;
}
const terminalOf = (ws) => terminals.get(ws) || makeTerminal(ws);

function showTerminal(ws) {
  shownTerminal = ws;
  const shown = terminalOf(ws);
  for (const e of terminals.values()) e.el.hidden = e !== shown;
  term = shown.term;
  if (shown.opened) window.__termRenderer = shown.renderer;
  fitTerminal();
}
function forgetTerminals(keys) {
  for (const key of keys) {
    const e = terminals.get(key);
    if (!e) continue;
    e.term.dispose(); e.el.remove(); terminals.delete(key);
    if (shownTerminal === key) { term = null; shownTerminal = null; }
  }
}

// Their contents as escape sequences (xterm's serialize addon, as VS Code keeps terminals across reloads), which
// another window writes into new terminals: a project moving there keeps what its agents showed.
// Each with its size: written into a terminal of another size (xterm's default before it fits its panel), the lines
// of an agent's screen would be cut and its prompt drawn in pieces.
const terminalsOf = (project) => Object.fromEntries([...terminals].filter(([key]) => key.startsWith(`${project}/`))
  .map(([key, e]) => [key, { data: e.serialize.serialize(), cols: e.term.cols, rows: e.term.rows }]));
kulisa.on('terminals:restore', (list) => {
  for (const [key, { data, cols, rows }] of Object.entries(list)) (terminals.get(key)?.term || makeTerminal(key, { cols, rows }).term).write(data);
});

// Only once the terminal is in its panel and the grid has settled: an agent starts at the first size sent for its
// workspace (main/terminal.js) and draws its prompt for it.
let fitTimer = 0;
function fitTerminal(tries = 50) {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    const ws = shownTerminal, e = terminals.get(ws);
    if (!e?.opened || !termEl.closest('#dock')) return;
    // No size yet (xterm has not measured its characters, or the panel is not laid out): again a moment later, so
    // the agent gets its real size, never xterm's default.
    if (!e.fit.proposeDimensions()?.cols) return tries && fitTerminal(tries - 1);
    try { e.fit.fit(); } catch { return; }
    const size = { cols: e.term.cols, rows: e.term.rows };
    window.__ptySizes.push(size);
    kulisa.send('pty:resize', { ws, ...size });
  }, 100);
}
new ResizeObserver(() => fitTerminal()).observe(termEl);
kulisa.on('pty:out', ({ ws, data }) => terminalOf(ws).term.write(data));
kulisa.on('terminal:focus', () => term?.focus());
kulisa.on('terminal:reset', ({ ws }) => terminals.get(ws)?.term.reset()); // another agent starts there

// Copy and paste as the OS's own terminal does, so hands need nothing new (xterm leaves the keys to the app, as VS Code
// sets its own): Ctrl+Shift+C / V everywhere (GNOME Terminal, Konsole); on Windows also Ctrl+V, and Ctrl+C copies a
// selection, else interrupts (Windows Terminal). On macOS ⌘C / ⌘V are the app menu's Copy and Paste, which xterm takes
// as the page's copy and paste events. Otherwise Ctrl+C and Ctrl+V go to the agent (Claude Code pastes an image).
const clipboardKeys = { darwin: ['⌘C', '⌘V'], win32: ['Ctrl+C', 'Ctrl+V'] }[kulisa.platform] || ['Ctrl+Shift+C', 'Ctrl+Shift+V'];
// The key by its place (code) or, when an input method leaves that out (ibus with a Cyrillic layout), by keyCode, which
// Chromium gives as on a Latin layout.
const isKey = (e, letter) => e.code === `Key${letter}` || e.keyCode === letter.charCodeAt(0);
function clipboardKey(e, platform, selected) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null;
  const win = platform === 'win32';
  if (isKey(e, 'C') && (e.shiftKey || win && selected)) return 'copy';
  if (isKey(e, 'V') && (e.shiftKey || win)) return 'paste';
  return null;
}
// Nothing selected, nothing copied: the clipboard keeps what is there (an agent selecting with its own mouse, as
// Claude Code does, puts its text there itself), as GNOME Terminal does.
function termCopy() { if (term.hasSelection()) navigator.clipboard.writeText(term.getSelection()); }
function termPaste() { navigator.clipboard.readText().then((t) => term.paste(t)); }
function terminalMenu() {
  return [
    { label: 'Copy', keys: clipboardKeys[0], enabled: term.hasSelection(), run: termCopy },
    { label: 'Paste', keys: clipboardKeys[1], run: termPaste },
    { label: 'Select all', run: () => term.selectAll() },
    '-',
    { label: 'Clear', run: () => term.clear() },
    '-',
    { label: 'Change agent…', run: () => act('agent:change') },
  ];
}
