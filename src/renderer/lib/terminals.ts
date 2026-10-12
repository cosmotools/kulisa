// The terminals' xterms (docs/window.md, The terminal), keyed "<task>#<id>" as in the main process. An xterm lives as
// long as its task, not its panel: the panels come and go with the grid, and adopt the terminals' elements (termEl,
// termHost).
// Set up as VS Code does: Unicode 11 character widths (Claude Code draws ✅ ⏵ ✻ and the like; with the default Unicode 6
// widths the cursor and the input line drift off the text), the WebGL renderer, and a bundled font so it looks and
// measures the same on every OS.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { act, store } from './store';
import { keyText } from './common';
import { menuAt, type MenuItem } from './menu';
import { whenLeft } from './grid';

interface Entry { term: Terminal; el: HTMLElement; fit: FitAddon; serialize: SerializeAddon; opened: boolean; renderer?: 'dom' | 'webgl' }
// The agent's terminals' place: in the agent's panel, or waiting outside the grid (no project open).
export const termEl = Object.assign(document.createElement('div'), { id: 'term' });
document.body.append(termEl);
const terminals = new Map<string, Entry>(); // terminal key -> its xterm
const hosts = new Map<string, { el: HTMLElement; observer: ResizeObserver }>(); // another terminal's key -> its panel's element
let term: Terminal | null = null, shownTerminal: string | null = null;
export const shownTerm = () => term;
const sizes: { cols: number; rows: number }[] = [];
Object.defineProperty(window, '__term', { get: () => term }); // for tests
Object.assign(window, { __ptySizes: sizes }); // for tests: the sizes sent for the shown task
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const termFontSize = parseFloat(css('--font')) || 14;
// xterm measures the cell size when it opens: once the font is loaded. Output written before is kept.
export const termFont = Promise.all([`${termFontSize}px`, `bold ${termFontSize}px`].map((f) => document.fonts.load(`${f} "JetBrains Mono"`))).catch(() => {});

// The panels' colors (tokens.css), set again when the theme changes. The programs' own colors (ANSI) stay xterm's: it
// makes them readable on either background (minimumContrastRatio, WCAG AA; VS Code does the same). A token is
// light-dark(…): its color as now shown is read through an element that uses it.
const probe = Object.assign(document.createElement('i'), { hidden: true });
document.body.append(probe);
const shown = (v: string) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
const termTheme = () => ({ background: shown('--island'), foreground: shown('--text'), cursor: shown('--text'), cursorAccent: shown('--island'),
  selectionBackground: shown('--selection') });
function themeTerminals() { for (const { term: t } of terminals.values()) t.options.theme = termTheme(); }
// After the theme changed (☰), also when the OS changes its own (System). The root's data-theme first (store.ts).
kulisa.on('theme', () => requestAnimationFrame(themeTerminals));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeTerminals);

// Links in the terminal: those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (the web-links
// addon). Ctrl+click (⌘ on macOS) asks where, in a menu at the pointer: a tab of one of the shown task's open
// profiles, or the user's browser. Always asked, so a link never opens somewhere unexpected (the author's choice:
// which profile a link belongs to cannot be told). http and https only; the address shows on hover.
export const termLinks = {
  activate(e: MouseEvent, uri: string) {
    if (!(kulisa.platform === 'darwin' ? e.metaKey : e.ctrlKey) || !/^https?:\/\//i.test(uri)) return;
    menuAt(e, [{ heading: uri }, ...store.profiles.map((p) => ({ label: `Open in ${p.name}`, avatar: p.avatar,
      run: () => act('tab:new', { profile: p.id, url: uri }) })),
    '-', { label: 'Open in your browser', run: () => { window.open(uri); } }]);
  },
  hover(_e: MouseEvent, uri: string) { termEl.title = uri; },
  leave() { termEl.title = ''; },
};

// size: { cols, rows } to start with (a terminal coming from another window: its contents are laid out for it).
function makeTerminal(task: string, size?: { cols: number; rows: number }): Entry {
  const other = task.includes('#');
  const el = Object.assign(document.createElement('div'), { className: 'xterm-host', hidden: !other });
  (other ? termHost(task) : termEl).append(el);
  const t = new Terminal({ ...size, fontSize: termFontSize, fontFamily: '"JetBrains Mono", monospace', cursorBlink: true,
    allowProposedApi: true, theme: termTheme(), minimumContrastRatio: 4.5, linkHandler: termLinks });
  t.loadAddon(new Unicode11Addon());
  t.unicode.activeVersion = '11';
  const fit = new FitAddon();
  t.loadAddon(fit);
  t.loadAddon(new WebLinksAddon(termLinks.activate, termLinks));
  const serialize = new SerializeAddon();
  t.loadAddon(serialize);
  const entry: Entry = { term: t, el, fit, serialize, opened: false };
  terminals.set(task, entry);
  termFont.then(() => {
    if (terminals.get(task) !== entry) return; // forgotten meanwhile
    t.open(el);
    entry.renderer = 'dom';
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => { webgl.dispose(); entry.renderer = 'dom'; }); // back to the DOM renderer
      t.loadAddon(webgl);
      entry.renderer = 'webgl';
    } catch (e) { console.warn('[terminal] WebGL renderer unavailable:', (e as Error).message); }
    entry.opened = true;
    if (shownTerminal === task) { Object.assign(window, { __termRenderer: entry.renderer }); fitTerminal(); }
    if (other) fitOther(task);
  });
  t.onData((data) => kulisa.send('pty:in', { task, data }));
  t.attachCustomKeyEventHandler((e) => {
    const does = e.type === 'keydown' && clipboardKey(e, kulisa.platform, t.hasSelection());
    if (does === 'copy') { termCopy(t); if (kulisa.platform === 'win32') t.clearSelection(); }
    return !does; // a paste is the page's own (Chromium's Ctrl+V, Ctrl+Shift+V), which xterm takes: pasting here too doubled it
  });
  return entry;
}
export const terminalOf = (task: string) => terminals.get(task) || makeTerminal(task);

// A task's terminal in the agent's panel (made the first time).
function showTerminal(task: string) {
  shownTerminal = task;
  const e = terminalOf(task);
  for (const x of terminals.values()) if (!x.el.parentElement || x.el.parentElement === termEl) x.el.hidden = x !== e;
  term = e.term;
  if (e.opened) Object.assign(window, { __termRenderer: e.renderer });
  fitTerminal();
}
// The shown task's terminal, once the grid on screen has gone.
kulisa.on<{ current: string | null }>('tasks', ({ current }) => {
  if (current !== null && (current !== shownTerminal || !term)) whenLeft().then(() => showTerminal(current));
});
// The terminals of tasks gone (their project closed or moved, a task deleted), with their other terminals, or other
// terminals closed.
export function forgetTerminals(keys: string[]) {
  const all = new Set([...terminals.keys(), ...hosts.keys()].filter((k) => keys.some((key) => k === key || k.startsWith(`${key}#`))));
  for (const key of all) {
    const e = terminals.get(key);
    if (e) { e.term.dispose(); e.el.remove(); terminals.delete(key); }
    hosts.get(key)?.observer.disconnect();
    hosts.delete(key);
    if (shownTerminal === key) { term = null; shownTerminal = null; }
  }
}

// The task's other terminals: "term:<id>" panels, keyed "<task>#<id>".
export const otherTermKey = (panel: string) => `${store.current}#${panel.slice('term:'.length)}`;
// Another terminal's element, sized to its panel whenever that changes (behind another panel it has no size: fitted
// once it comes to the front).
export function termHost(key: string) {
  if (!hosts.has(key)) {
    const el = Object.assign(document.createElement('div'), { className: 'term' });
    const observer = new ResizeObserver(() => fitOther(key));
    observer.observe(el);
    hosts.set(key, { el, observer });
  }
  return hosts.get(key)!.el;
}
function fitOther(key: string) {
  const e = terminals.get(key);
  if (!e?.opened || !e.el.isConnected || !e.fit.proposeDimensions()?.cols) return;
  try { e.fit.fit(); } catch { return; }
  kulisa.send('pty:resize', { task: key, cols: e.term.cols, rows: e.term.rows });
}

// Their contents as escape sequences (xterm's serialize addon, as VS Code keeps terminals across reloads), which
// another window writes into new terminals: a project moving there keeps what its agents showed. Each with its size:
// written into a terminal of another size (xterm's default before it fits its panel), the lines of an agent's screen
// would be cut and its prompt drawn in pieces.
export const terminalsOf = (project: string) => Object.fromEntries([...terminals].filter(([key]) => key.startsWith(`${project}/`))
  .map(([key, e]) => [key, { data: e.serialize.serialize(), cols: e.term.cols, rows: e.term.rows }]));
kulisa.on<Record<string, { data: string; cols: number; rows: number }>>('terminals:restore', (list) => {
  for (const [key, { data, cols, rows }] of Object.entries(list)) (terminals.get(key)?.term || makeTerminal(key, { cols, rows }).term).write(data);
});

// Only once the terminal is in its panel and the grid has settled: an agent starts at the first size sent for its
// task (main/terminal.ts) and draws its prompt for it.
let fitTimer = 0;
export function fitTerminal(tries = 50) {
  clearTimeout(fitTimer);
  fitTimer = window.setTimeout(() => {
    const task = shownTerminal, e = task && terminals.get(task);
    if (!e || !e.opened || !termEl.closest('#dock')) return;
    // No size yet (xterm has not measured its characters, or the panel is not laid out): again a moment later, so the
    // agent gets its real size, never xterm's default.
    if (!e.fit.proposeDimensions()?.cols) return tries && fitTerminal(tries - 1);
    try { e.fit.fit(); } catch { return; }
    const size = { cols: e.term.cols, rows: e.term.rows };
    sizes.push(size);
    kulisa.send('pty:resize', { task, ...size });
  }, 100);
}
new ResizeObserver(() => fitTerminal()).observe(termEl);
kulisa.on<{ task: string; data: string }>('pty:out', ({ task, data }) => terminalOf(task).term.write(data));
kulisa.on('terminal:focus', () => term?.focus());
kulisa.on<{ task: string }>('terminal:reset', ({ task }) => terminals.get(task)?.term.reset()); // another agent starts there

// Copy and paste as the OS's own terminal does, so hands need nothing new (xterm leaves the keys to the app, as VS Code
// sets its own): Ctrl+Shift+C / V everywhere (GNOME Terminal, Konsole); on Windows also Ctrl+V, and Ctrl+C copies a
// selection, else interrupts (Windows Terminal). On macOS ⌘C / ⌘V are the app menu's Copy and Paste, which xterm takes
// as the page's copy and paste events. Otherwise Ctrl+C and Ctrl+V go to the agent (Claude Code pastes an image). The
// keys as shown (menus, Keyboard Shortcuts) are main/keys.ts's. The key by its place (code) or, when an input method
// leaves that out (ibus with a Cyrillic layout), by keyCode, which Chromium gives as on a Latin layout.
const isKey = (e: KeyboardEvent, letter: string) => e.code === `Key${letter}` || e.keyCode === letter.charCodeAt(0);
export function clipboardKey(e: KeyboardEvent, platform: string, selected: boolean) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null;
  const win = platform === 'win32';
  if (isKey(e, 'C') && (e.shiftKey || win && selected)) return 'copy';
  if (isKey(e, 'V') && (e.shiftKey || win)) return 'paste';
  return null;
}
// Nothing selected, nothing copied: the clipboard keeps what is there (an agent selecting with its own mouse, as
// Claude Code does, puts its text there itself), as GNOME Terminal does.
function termCopy(t: Terminal) { if (t.hasSelection()) navigator.clipboard.writeText(t.getSelection()); }
function termPaste(t: Terminal) { navigator.clipboard.readText().then((text) => t.paste(text)); }
// The right-click menu of the terminal at el: the agent's ends with Change agent…, another with Close.
export function terminalMenu(el: Element): MenuItem[] | null {
  const host = el.closest('.term'), key = host && [...hosts].find(([, h]) => h.el === host)?.[0];
  const t = key ? terminals.get(key)?.term : term;
  if (!t) return null;
  return [
    { label: 'Copy', keys: keyText('terminal.copy'), enabled: t.hasSelection(), run: () => termCopy(t) },
    { label: 'Paste', keys: keyText('terminal.paste'), run: () => termPaste(t) },
    { label: 'Select all', run: () => t.selectAll() },
    '-',
    { label: 'Clear', run: () => t.clear() },
    '-',
    ...(key ? [{ label: 'Close', run: () => act('terminal:close', { id: Number(key.split('#')[1]) }) }]
      : [{ label: 'Change agent…', run: () => act('agent:change') }, { label: 'New Conversation', run: () => act('agent:new-conversation') }]),
  ];
}
