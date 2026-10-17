// A terminal as Kulisa draws it, in any of its windows (docs/window.md, The terminal): an xterm per terminal, keyed as
// in the main process, its output from its pty and its keys to it. A tasks' window's own (the shown task's front
// terminal, links into its profiles, terminals moving between windows): terminals.ts. Settings' window has a sign-in's
// (AccountSignIn.vue). An xterm lives as long as its terminal, not the element showing it: a panel or a dialog adopts its
// element (termHost).
// Set up as VS Code does: Unicode 11 character widths (Claude Code draws ✅ ⏵ ✻ and the like; with the default Unicode 6
// widths the cursor and the input line drift off the text), the WebGL renderer, and a bundled font so it looks and
// measures the same on every OS.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface Entry { term: Terminal; el: HTMLElement; fit: FitAddon; serialize: SerializeAddon; opened: boolean; renderer?: 'dom' | 'webgl' }
const terminals = new Map<string, Entry>(); // terminal key -> its xterm
const hosts = new Map<string, HTMLElement>(); // terminal key -> its element, which a panel or a dialog holds
export const xtermOf = (key: string) => terminals.get(key);
export const xtermKeys = () => terminals.keys();
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const termFontSize = parseFloat(css('--font')) || 14;
// xterm measures the cell size when it opens: once the font is loaded. Output written before is kept.
const termFont = Promise.all([`${termFontSize}px`, `bold ${termFontSize}px`].map((f) => document.fonts.load(`${f} "JetBrains Mono"`))).catch(() => {});

// The panels' colors (tokens.css), set again when the theme changes. The programs' own colors (ANSI) stay xterm's: it
// makes them readable on either background (minimumContrastRatio, WCAG AA; VS Code does the same). A token is
// light-dark(…): its color as now shown is read through an element that uses it.
const probe = Object.assign(document.createElement('i'), { hidden: true });
document.body.append(probe);
const shown = (v: string) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
const termTheme = () => ({ background: shown('--island'), foreground: shown('--text'), cursor: shown('--text'), cursorAccent: shown('--island'),
  selectionBackground: shown('--selection') });
function themeTerminals() { for (const { term: t } of terminals.values()) t.options.theme = termTheme(); }
// After the theme changed (☰), also when the OS changes its own (System). The root's data-theme first.
kulisa.on('theme', () => requestAnimationFrame(themeTerminals));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeTerminals);

// What a window adds: where a link opens (a tasks' window asks: one of its profiles or the browser), and a terminal
// fitted to a size (the tests read the shown one's). By default a link opens in the user's browser on Ctrl+click (⌘ on
// macOS), http and https only, its address shown on hover.
export const termHooks: { open: (e: MouseEvent, uri: string) => void; fitted?: (key: string, size: { cols: number; rows: number }) => void } = {
  open: (_e, uri) => { window.open(uri); },
};
export const termLinks = {
  activate(e: MouseEvent, uri: string) {
    if (!(kulisa.platform === 'darwin' ? e.metaKey : e.ctrlKey) || !/^https?:\/\//i.test(uri)) return;
    termHooks.open(e, uri);
  },
  hover(e: MouseEvent, uri: string) { (e.target as HTMLElement).title = uri; },
  leave(e: MouseEvent) { (e.target as HTMLElement).title = ''; },
};

// size: { cols, rows } to start with (a terminal coming from another window: its contents are laid out for it).
export function makeTerminal(key: string, size?: { cols: number; rows: number }): Entry {
  const el = Object.assign(document.createElement('div'), { className: 'xterm-host' });
  termHost(key).append(el);
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
  terminals.set(key, entry);
  void termFont.then(() => {
    if (terminals.get(key) !== entry) return; // forgotten meanwhile
    t.open(el);
    entry.renderer = 'dom';
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => { webgl.dispose(); entry.renderer = 'dom'; }); // back to the DOM renderer
      t.loadAddon(webgl);
      entry.renderer = 'webgl';
    } catch (e) { console.warn('[terminal] WebGL renderer unavailable:', (e as Error).message); }
    entry.opened = true;
    fitTerminal(key);
  });
  t.onData((data) => kulisa.send('pty:in', { task: key, data }));
  t.attachCustomKeyEventHandler((e) => {
    const does = e.type === 'keydown' && clipboardKey(e, kulisa.platform, t.hasSelection());
    if (does === 'copy') { termCopy(t); if (kulisa.platform === 'win32') t.clearSelection(); }
    return !does; // a paste is the page's own (Chromium's Ctrl+V, Ctrl+Shift+V), which xterm takes: pasting here too doubled it
  });
  return entry;
}
const terminalOf = (key: string) => terminals.get(key) || makeTerminal(key);

// A terminal's element, sized to where it is whenever that changes (behind another tab it has no size: fitted once it
// comes to the front). Made with its xterm, or before it (a sign-in's terminal: AccountSignIn.vue).
export function termHost(key: string) {
  if (!hosts.has(key)) {
    const el = Object.assign(document.createElement('div'), { className: 'term' });
    new ResizeObserver(() => fitTerminal(key)).observe(el);
    hosts.set(key, el);
    if (!terminals.has(key)) makeTerminal(key);
  }
  return hosts.get(key)!;
}
// Terminals gone: of tasks gone (their project closed or moved, a task deleted: their keys), or closed (a terminal's
// key).
export function forgetTerminals(keys: string[]) {
  const all = new Set([...terminals.keys(), ...hosts.keys()].filter((k) => keys.some((key) => k === key || k.startsWith(`${key}#`))));
  for (const key of all) {
    const e = terminals.get(key);
    if (e) { e.term.dispose(); terminals.delete(key); }
    hosts.get(key)?.remove();
    hosts.delete(key);
  }
}

// Its size sent once it is on screen, laid out: an agent starts at the first size sent for its task (main/terminal.ts)
// and draws its prompt for it. Not yet measured (xterm has not measured its characters, or the panel is not laid
// out): again a moment later, so the agent gets its real size, never xterm's default.
const fitTimers = new Map<string, number>();
function fitTerminal(key: string, tries = 50) {
  clearTimeout(fitTimers.get(key));
  fitTimers.set(key, window.setTimeout(() => {
    fitTimers.delete(key);
    const e = terminals.get(key);
    if (!e?.opened || !e.el.offsetWidth) return; // not on screen: fitted when it comes
    if (!e.fit.proposeDimensions()?.cols) return tries && fitTerminal(key, tries - 1);
    try { e.fit.fit(); } catch { return; }
    const size = { cols: e.term.cols, rows: e.term.rows };
    termHooks.fitted?.(key, size);
    kulisa.send('pty:resize', { task: key, ...size });
  }, 100));
}
kulisa.on('pty:out', ({ task, data }) => terminalOf(task).term.write(data));
// The keyboard to a terminal, once its xterm is open (a new one opens when its font is there).
export const termFocus = (key: string) => termFont.then(() => terminals.get(key)?.term.focus());

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
export function termCopy(t: Terminal) { if (t.hasSelection()) void navigator.clipboard.writeText(t.getSelection()); }
export function termPaste(t: Terminal) { void navigator.clipboard.readText().then((text) => t.paste(text)); }
