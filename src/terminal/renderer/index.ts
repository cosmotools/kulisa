// Terminals as Kulisa draws them, in any of its windows (docs/window.md, The terminal): a buffer per terminal, keyed as
// in the main process, its output from its pty; and a shown xterm (View) for each place that shows one, its keys to
// that terminal's pty. A tasks' window's island: terminals.ts. Settings' window and New Project have a sign-in's
// (AccountSignIn.vue).
// Set up as VS Code does: Unicode 11 character widths (Claude Code draws ✅ ⏵ ✻ and the like; with the default Unicode 6
// widths the cursor and the input line drift off the text), the WebGL renderer, and a bundled font so it looks and
// measures the same on every OS.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebLinksAddon } from '@xterm/addon-web-links';

// A terminal's buffer is an xterm never opened: its text, scrollback and modes with no renderer, every pty's output
// written into it. A place that shows terminals (the island, an account's sign-in) has one shown xterm, a View, the
// only one with a renderer (WebGL), links and the theme: showing another terminal there writes that one's buffer into
// it (ROADMAP, "One xterm a window": each xterm's renderer cost 15-30 MB, and Chromium keeps 16 WebGL contexts a page).
interface Buffer { term: Terminal; serialize: SerializeAddon; modes: Map<number, boolean>; scroll?: number }
const buffers = new Map<string, Buffer>(); // terminal key -> its buffer
const views = new Set<View>();
export const xtermKeys = () => buffers.keys();
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
function themeTerminals() { for (const v of views) v.term.options.theme = termTheme(); }
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

// Modes serializing leaves out, followed in each buffer and written with it, each with its value whether set or not:
// the shown xterm's reset() leaves a hidden cursor hidden. The cursor shown or hidden, and the mouse's encoding (SGR:
// Claude Code's clicks in its fullscreen), by default shown and none. xterm still handles them (false: not taken).
const KEPT_MODES: Record<number, boolean> = { 25: true, 1006: false, 1015: false, 1016: false };
function bufferOf(key: string, size?: { cols: number; rows: number }): Buffer {
  let b = buffers.get(key);
  if (b) return b;
  const term = new Terminal({ ...size, allowProposedApi: true });
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = '11';
  const serialize = new SerializeAddon();
  term.loadAddon(serialize);
  const modes = new Map<number, boolean>();
  for (const [final, on] of [['h', true], ['l', false]] as const) {
    term.parser.registerCsiHandler({ prefix: '?', final }, (params) => {
      for (const p of params) if (typeof p === 'number' && p in KEPT_MODES) modes.set(p, on);
      return false;
    });
  }
  buffers.set(key, b = { term, serialize, modes });
  return b;
}
// What another xterm is given to show the same: the serialized buffer and the modes it leaves out.
export function serialized(key: string) {
  const b = buffers.get(key);
  if (!b) return null;
  // Those off first: turning one of the mouse's encodings off sets the default encoding, whichever was on.
  const modes = Object.entries(KEPT_MODES).map(([m, on]) => [m, b.modes.get(+m) ?? on] as const).sort(([, a], [, b]) => +a - +b)
    .map(([m, on]) => `\x1b[?${m}${on ? 'h' : 'l'}`).join('');
  return { data: b.serialize.serialize() + modes, cols: b.term.cols, rows: b.term.rows };
}

// The xterm a place shows its terminal in. show(key) puts that terminal's buffer into it.
export class View {
  term: Terminal;
  el = Object.assign(document.createElement('div'), { className: 'term' });
  key: string | null = null;
  renderer?: 'dom' | 'webgl';
  private host = Object.assign(document.createElement('div'), { className: 'xterm-host' });
  private fit = new FitAddon();
  private opened = false;
  private pending: string[] | null = null; // output that came while the buffer was being put in
  constructor() {
    this.el.append(this.host);
    const t = this.term = new Terminal({ fontSize: termFontSize, fontFamily: '"JetBrains Mono", monospace', cursorBlink: true,
      allowProposedApi: true, theme: termTheme(), minimumContrastRatio: 4.5, linkHandler: termLinks });
    t.loadAddon(new Unicode11Addon());
    t.unicode.activeVersion = '11';
    t.loadAddon(this.fit);
    t.loadAddon(new WebLinksAddon(termLinks.activate, termLinks));
    views.add(this);
    new ResizeObserver(() => this.fitSoon()).observe(this.el);
    void termFont.then(() => {
      if (!views.has(this)) return; // disposed meanwhile
      t.open(this.host);
      this.renderer = 'dom';
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => { webgl.dispose(); this.renderer = 'dom'; }); // back to the DOM renderer
        t.loadAddon(webgl);
        this.renderer = 'webgl';
      } catch (e) { console.warn('[terminal] WebGL renderer unavailable:', (e as Error).message); }
      this.opened = true;
      this.fitSoon();
    });
    t.onData((data) => { if (this.key) kulisa.send('pty:in', { task: this.key, data }); });
    t.attachCustomKeyEventHandler((e) => {
      const does = e.type === 'keydown' && clipboardKey(e, kulisa.platform, t.hasSelection());
      if (does === 'copy') { termCopy(t); if (kulisa.platform === 'win32') t.clearSelection(); }
      return !does; // a paste is the page's own (Chromium's Ctrl+V, Ctrl+Shift+V), which xterm takes: pasting here too doubled it
    });
  }
  show(key: string | null) {
    if (key === this.key) return;
    const was = this.key && buffers.get(this.key), at = this.term.buffer.active;
    if (was) was.scroll = at.viewportY === at.baseY ? undefined : at.viewportY; // at the end: kept at the end
    this.key = key;
    this.term.reset();
    if (!key) return;
    const b = bufferOf(key, this.size() ?? undefined);
    // The buffer's own writes are queued: what is queued is parsed first, so the buffer is all its output so far.
    // Output coming meanwhile goes to the buffer after that mark, and here after it (pending).
    const pending: string[] = this.pending = [];
    b.term.write('', () => {
      if (this.key !== key || this.pending !== pending) return; // another shown meanwhile
      const size = this.size();
      if (size && (size.cols !== b.term.cols || size.rows !== b.term.rows)) b.term.resize(size.cols, size.rows);
      this.term.resize(b.term.cols, b.term.rows);
      this.term.write(serialized(key)!.data + pending.join(''), () => {
        if (b.scroll !== undefined) this.term.scrollToLine(b.scroll);
      });
      this.pending = null;
      this.fitSoon();
    });
  }
  write(key: string, data: string) {
    if (key !== this.key) return;
    if (this.pending) this.pending.push(data);
    else this.term.write(data);
  }
  dispose() { views.delete(this); this.term.dispose(); this.el.remove(); }
  // The size it has room for, once it is on screen and xterm has measured its characters.
  private size() {
    if (!this.opened || !this.el.offsetWidth) return null;
    const d = this.fit.proposeDimensions();
    return d?.cols ? { cols: d.cols, rows: d.rows } : null;
  }
  // Its size sent once it is on screen, laid out: an agent starts at the first size sent for its terminal
  // (main/index.ts) and draws its prompt for it. Not yet measured (xterm has not measured its characters, or the
  // panel is not laid out): again a moment later, so the agent gets its real size, never xterm's default.
  private fitTimer = 0;
  private fitSoon(tries = 50) {
    clearTimeout(this.fitTimer);
    this.fitTimer = window.setTimeout(() => {
      const key = this.key;
      if (!key || this.pending || !this.opened || !this.el.offsetWidth) return; // not on screen: fitted when it comes
      const size = this.size();
      if (!size) return tries && this.fitSoon(tries - 1);
      try { this.fit.fit(); } catch { return; }
      const b = bufferOf(key, size);
      if (b.term.cols !== size.cols || b.term.rows !== size.rows) b.term.resize(size.cols, size.rows);
      termHooks.fitted?.(key, size);
      kulisa.send('pty:resize', { task: key, ...size });
    }, 100);
  }
}

// A terminal coming from another window: its buffer at the size it had there, and its contents (serialized()).
export function restoreTerminal(key: string, { data, cols, rows }: { data: string; cols: number; rows: number }) {
  output(key, data, { cols, rows });
}
function output(key: string, data: string, size?: { cols: number; rows: number }) {
  bufferOf(key, size).term.write(data);
  for (const v of views) v.write(key, data);
}
// Terminals gone: of tasks gone (their project closed or moved, a task deleted: their keys), or closed (a terminal's
// key).
export function forgetTerminals(keys: string[]) {
  for (const key of [...buffers.keys()].filter((k) => keys.some((key) => k === key || k.startsWith(`${key}#`)))) {
    for (const v of views) if (v.key === key) v.show(null);
    buffers.get(key)!.term.dispose();
    buffers.delete(key);
  }
}
kulisa.on('pty:out', ({ task, data }) => output(task, data));
// The keyboard to a terminal shown somewhere, once its xterm is open (a new one opens when its font is there).
export const termFocus = (key: string) => termFont.then(() => { for (const v of views) if (v.key === key) v.term.focus(); });

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
