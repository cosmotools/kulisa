// The terminal panel: each workspace's agent CLI in an xterm.js of its own, the panel showing the shown workspace's
// (the others keep their output while in the background). Set up as VS Code does: Unicode 11 character widths
// (Claude Code draws ✅ ⏵ ✻ and the like; with the default Unicode 6 widths the cursor and the input line drift off
// the text), the WebGL renderer, and a bundled font so it looks and measures the same on every OS. The UI's text size
// (--font in styles.css), so the terminal matches the rest.
//   termEl              the panel's element (renderer.js puts it in its panel)
//   term                the shown workspace's terminal
//   showTerminal(ws)    show a workspace's terminal (made the first time)
//   resetTerminals()    forget them all (another project: its workspaces are numbered anew)
//   terminalMenu()      its right-click menu (menu.js items)
const termEl = document.getElementById('term');
const terminals = new Map(); // workspace number -> { term, el, fit, opened }
let term = null, shownTerminal = null;
Object.defineProperty(window, '__term', { get: () => term }); // for tests
window.__ptySizes = []; // for tests: the sizes sent for the shown workspace
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const termFontSize = parseFloat(css('--font')) || 14;
// xterm measures the cell size when it opens: once the font is loaded. Output written before is kept.
const termFont = Promise.all([`${termFontSize}px`, `bold ${termFontSize}px`].map((f) => document.fonts.load(`${f} "JetBrains Mono"`))).catch(() => {});

function makeTerminal(ws) {
  const el = Object.assign(document.createElement('div'), { className: 'xterm-host', hidden: true });
  termEl.append(el);
  const t = new Terminal({ fontSize: termFontSize, fontFamily: '"JetBrains Mono", monospace', cursorBlink: true,
    allowProposedApi: true, theme: { background: css('--island'), foreground: css('--text') } }); // the panels' colors
  t.loadAddon(new Unicode11Addon.Unicode11Addon());
  t.unicode.activeVersion = '11';
  const fit = new FitAddon.FitAddon();
  t.loadAddon(fit);
  const entry = { term: t, el, fit, opened: false };
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
  // Ctrl+Shift+C copies the selection, Ctrl+Shift+V pastes (terminal convention); Ctrl+C stays SIGINT.
  t.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey) return true;
    if (e.code === 'KeyC') { termCopy(); return false; }
    if (e.code === 'KeyV') { termPaste(); return false; }
    return true;
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
function resetTerminals() {
  for (const e of terminals.values()) { e.term.dispose(); e.el.remove(); }
  terminals.clear();
  term = null; shownTerminal = null;
}

// Only once the terminal is in its panel and the grid has settled: an agent starts at the first size sent for its
// workspace (main/terminal.js) and draws its prompt for it.
let fitTimer = 0;
function fitTerminal() {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    const ws = shownTerminal, e = terminals.get(ws);
    if (!e?.opened || !termEl.closest('#dock')) return;
    try { e.fit.fit(); } catch { return; }
    const size = { cols: e.term.cols, rows: e.term.rows };
    window.__ptySizes.push(size);
    kulisa.send('pty:resize', { ws, ...size });
  }, 100);
}
new ResizeObserver(fitTerminal).observe(termEl);
kulisa.on('pty:out', ({ ws, data }) => terminalOf(ws).term.write(data));
kulisa.on('terminal:focus', () => term?.focus());
kulisa.on('terminal:reset', ({ ws }) => terminals.get(ws)?.term.reset()); // another agent starts there

function termCopy() { navigator.clipboard.writeText(term.getSelection()); }
function termPaste() { navigator.clipboard.readText().then((t) => term.paste(t)); }
function terminalMenu() {
  return [
    { label: 'Copy', keys: 'Ctrl+Shift+C', enabled: term.hasSelection(), run: termCopy },
    { label: 'Paste', keys: 'Ctrl+Shift+V', run: termPaste },
    { label: 'Select all', run: () => term.selectAll() },
    '-',
    { label: 'Clear', run: () => term.clear() },
    '-',
    { label: 'Change agent…', run: () => kulisa.invoke('agent:change') },
  ];
}
