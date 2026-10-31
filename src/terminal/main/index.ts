// xterm.js in the renderer, node-pty here running the agent CLI unchanged. A task's terminals (tasks.ts) are
// "<task key>#<id>". The window shows the shown task's, the others keep running (and the window keeps their output).
import { handle, on } from '../../main/ipc.ts';
import { log } from '../../main/log.ts';
import { terminalKeys } from '../ipc.ts';
import type { TerminalEvents } from '../ipc.ts';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pty from 'node-pty';
import type { IPty } from 'node-pty';
import xterm from '@xterm/headless';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import type { Terminal } from '@xterm/headless';
import { quotePaths, shellLine, executionLine } from './shell-quote.ts';

interface Size { cols: number; rows: number }
// A terminal's process, with what Kulisa keeps of it.
type Pty = IPty & { spawnSize: Size; spawnArgs: string[]; key: string; shell: string; screen?: Terminal; stopped?: boolean; typed: Promise<void> };
// How a terminal starts (startTerminal).
interface TerminalConfig {
  command?: string | null; args?: string[]; cwd?: string; env?: Record<string, string | undefined>;
  shell?: { command: string; args?: string[] } | false | null; line?: string; execute?: string; size?: Size | null; sizeOf?: string;
  pinned?: Record<string, string>; screen?: number;
}
type TerminalOutput = (channel: 'pty:out', data: TerminalEvents['pty:out']) => void;
interface Term { pty: Pty | null; size: Size | null; firstSize: Promise<void>; sized: () => void; sizeOf?: string; fixed?: Size | null }

// The terminal's size as the window measures it, per terminal and per task (its panel's, which all its terminals
// share: one is shown at a time). An agent starts only once its size is known: Claude Code draws its prompt for the
// size it starts with and does not fully redraw on the first resize. However long the window takes to lay the panel
// out: a loaded machine lays it out slower than any fixed wait would allow for.
// The size comes: a task loads its terminals when it is first shown (docs/tasks.md). Listening from require time, so
// a size sent while the window loads is not missed.
const terms = new Map<string, Term>(); // key -> { pty, size, sized (resolves the first size) }
const termOf = (key: string) => {
  if (!terms.has(key)) {
    let sized!: () => void;
    const firstSize = new Promise<void>((r) => (sized = r));
    terms.set(key, { pty: null, size: null, firstSize, sized });
  }
  return terms.get(key)!;
};
on('pty:resize', (_e, { task, cols, rows }) => {
  const t = termOf(task), size = t.fixed || { cols, rows };
  t.size = size; t.sized();
  if (t.sizeOf) { const panel = termOf(t.sizeOf); panel.size = size; panel.sized(); }
  try { t.pty?.resize(size.cols, size.rows); t.pty?.screen?.resize(size.cols, size.rows); } catch {}
});
// Every terminal's process until it has exited (stopAllTerminals).
const running = new Map<Pty, Promise<void>>();
// Esc typed by the human into a terminal (its key): what it means is the caller's (an agent's turn ended: tasks.ts).
const escapes: ((key: string) => void)[] = [];
const onEscape = (fn: (key: string) => void) => { escapes.push(fn); };
on('pty:in', (_e, { task, data }) => {
  terms.get(task)?.pty?.write(data);
  if (data === '\x1b') for (const fn of escapes) fn(task);
});

handle('pty:quote-paths', (_e, { task, paths }) => {
  const p = terms.get(task)?.pty;
  if (!p || p.stopped) return null;
  log.info(`[terminal] ${task} file drop (${paths.length} paths)`);
  return quotePaths(p.shell, paths);
});

// The user's shell as a terminal app starts it (login shell on macOS, as Terminal and VS Code do). An app started
// from the Dock or a menu may have no SHELL; the account's shell is the same then. Windows: PowerShell, as Windows
// Terminal opens it: PowerShell 7 when installed, else the system's Windows PowerShell.
const userShell = () => (process.platform === 'win32' ? { command: programPath('pwsh') || 'powershell.exe', args: ['-NoLogo'] }
  : { command: process.env.SHELL || os.userInfo().shell || '/bin/sh', args: process.platform === 'darwin' ? ['-l'] : [] });

// A program by name, found in PATH as Windows' shells find it, by the extensions of PATHEXT (node-pty takes a name
// only with its extension: `claude` is claude.exe or claude.cmd); a path, or a name not found, as it is. Elsewhere
// the name as it is: the system finds it.
function programPath(name: string, env: Record<string, string | undefined> = process.env) {
  if (process.platform !== 'win32' || path.isAbsolute(name) || /[\\/]/.test(name)) return name;
  const exts = path.extname(name) ? [''] : (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';');
  for (const dir of (env.PATH || env.Path || '').split(';').filter(Boolean)) {
    for (const ext of exts) { const f = path.join(dir, name + ext); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  }
  return null;
}

// cfg: { command, args, cwd, env, shell, line, size, sizeOf }. The agent is typed into the user's shell started in cwd, as if the human
// opened a terminal in the project and ran it: the shell's startup sets the project's environment (direnv's .envrc,
// nvm, mise …), which Kulisa's own environment (where Kulisa was started) is not. When the agent exits, the shell
// stays. shell: { command, args } instead of the user's, or false to start the agent directly (a sign-in's).
// pinned: variables of env the shell's startup must not change, typed before the command too (`VAR=… cmd`: bash, zsh,
// fish 3.1+; PowerShell's $env:VAR=…): the task's account, which a project's .envrc setting CLAUDE_CONFIG_DIR would replace.
// line: a command line typed into the shell as it is (a shell's; none: the shell alone). size:
// start at it rather than wait for the window's; sizeOf: or at that key's (the task's terminals' panel: a terminal behind another
// tab has none of its own), whichever comes first. screen: its last lines kept for the agent to read (a shell's). key: the terminal's; the window sends its input and size, and gets
// its output, under it. send(channel, data): to the task's window, whichever it is then.
async function startTerminal(send: TerminalOutput, cfg: TerminalConfig, key: string): Promise<Pty> {
  const t = termOf(key), like = cfg.sizeOf ? termOf(cfg.sizeOf) : null;
  t.sizeOf = cfg.sizeOf;
  if (t.size && like) { like.size = t.size; like.sized(); }
  if (!cfg.size) await Promise.race([t.firstSize, ...(like ? [like.firstSize] : [])]);
  const { cols, rows } = (t.size || cfg.size || like?.size)!; // one of them: given, or waited for
  const sh = cfg.shell === false ? null : cfg.shell || userShell();
  const env = { ...process.env, COLORTERM: 'truecolor', ...(cfg.env || {}) };
  const program = sh ? sh.command : cfg.command || userShell().command;
  const p = pty.spawn(programPath(program, env) || program, sh ? sh.args || [] : cfg.args || [], {
    name: 'xterm-256color', cols, rows, cwd: cfg.cwd || process.cwd(), env,
  }) as Pty;
  p.typed = Promise.resolve();
  if (cfg.execute && sh) p.typed = typeWhenReady(p, ` ${executionLine(sh.command, cfg.execute)}\r`);
  else if (cfg.line) p.typed = typeWhenReady(p, `${cfg.line}\r`);
  else if (sh && cfg.command) p.typed = typeWhenReady(p, ` ${shellLine(sh.command, cfg.command, cfg.args || [], cfg.pinned)}\r`);
  p.spawnSize = { cols: p.cols, rows: p.rows };
  p.spawnArgs = cfg.args || [];
  p.key = key;
  p.shell = sh?.command || userShell().command;
  // An agent that was replaced says nothing more in the window.
  if (cfg.screen) {
    p.screen = new xterm.Terminal({ cols: p.cols, rows: p.rows, scrollback: cfg.screen, allowProposedApi: true });
    p.screen.loadAddon(new Unicode11Addon());
    p.screen.unicode.activeVersion = '11';
  }
  const out = (data: string) => { p.screen?.write(data); if (t.pty === p) send('pty:out', { task: key, data, cols: p.cols, rows: p.rows }); };
  p.onData(out);
  p.onExit(({ exitCode }) => { log.info(`[terminal] ${key} exited ${exitCode}`); out(`\r\n[process exited ${exitCode}]\r\n`); });
  running.set(p, new Promise((r) => p.onExit(() => { running.delete(p); r(); })));
  t.pty = p;
  return p;
}

// Type the agent's command once the shell reads its input line, or it shows twice (the terminal echoes what comes
// before, then the shell shows it again). A shell reading a line turns bracketed paste on (bash, zsh, fish); for
// other shells, once the output has been quiet for a moment. A leading space keeps it out of the shell's history
// (bash's default ignorespace). Once typed, the promise: what is sent to the agent comes after it (sendToPrompt).
const typeWhenReady = (p: IPty & { stopped?: boolean }, line: string) => readsLine(p).then(() => { if (!p.stopped) p.write(line); });
// Once the shell reads its input line again (above).
function readsLine(p: IPty) {
  return new Promise<void>((resolve) => {
    let done = false, quiet: NodeJS.Timeout | undefined;
    const ready = () => { if (done) return; done = true; sub.dispose(); clearTimeout(quiet); clearTimeout(limit); resolve(); };
    const sub = p.onData((d) => {
      if (d.includes('\x1b[?2004h')) return ready();
      clearTimeout(quiet); quiet = setTimeout(ready, 500);
    });
    const limit = setTimeout(ready, 5000);
  });
}

// Stop the agent; its output no longer reaches the window. The terminal's size is kept for the next agent there.
function stopTerminal(p: Pty, { keepScreen = false }: { keepScreen?: boolean } = {}) {
  p.stopped = true;
  const t = terms.get(p.key);
  if (t?.pty === p) t.pty = null;
  try { p.kill(); } catch {}
  if (!keepScreen) { p.screen?.dispose(); p.screen = undefined; }
}

// Every terminal stopped, as Kulisa quits, and their processes waited for, 3 s at most: on Windows node-pty ends a
// ConPTY on threads and a helper process of its own, and an app exiting before they are done may end with an uncaught
// C++ exception.
async function stopAllTerminals() {
  const exits = [...running].map(([p, exited]) => { stopTerminal(p); return exited; });
  await Promise.race([Promise.all(exits), new Promise((r) => setTimeout(r, 3000))]);
}

// A terminal closed, or its task gone (its project closed, a task deleted): its size too. Opened again, the window
// measures it anew.
const forgetTerminal = (key: string) => terms.delete(key);

// Flush xterm's queued parser before an interactive screen is inspected.
async function terminalScreen(p: Pty, lines: number, screenOnly = false) {
  const term = p.screen;
  if (!term) return '';
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000);
    term.write('', () => { clearTimeout(timer); resolve(); });
  });
  if (p.screen !== term) return '';
  if (!screenOnly) return terminalTail(p, lines);
  const b = term.buffer.active;
  return Array.from({ length: term.rows }, (_, i) => b.getLine(b.baseY + i)?.translateToString(true) || '').join('\n').trimEnd();
}
function setTerminalSize(key: string, size: Size | null) {
  const t = termOf(key);
  t.fixed = size;
  if (!size) return;
  t.size = size; t.sized();
  try { t.pty?.resize(size.cols, size.rows); t.pty?.screen?.resize(size.cols, size.rows); } catch {}
}

// The last lines of a shell as plain text, as its screen shows them; a line the screen wrapped at its width is one.
function terminalTail(p: Pty, lines: number) {
  const buffer = p.screen?.buffer.active, rows: string[] = [];
  for (let y = 0; buffer && y < buffer.length; y++) {
    const line = buffer.getLine(y)!, text = line.translateToString();
    if (line.isWrapped && rows.length) rows[rows.length - 1] += text; else rows.push(text);
  }
  return rows.map((l) => l.trimEnd()).join('\n').trimEnd().split('\n').slice(-lines).join('\n');
}

// Ctrl+C, as the human would press it: what runs there stops, the shell stays. What is typed next waits until the shell
// reads its line again: Windows' console drops the input that comes before (PowerShell lost a command typed at once).
function interrupt(p: Pty) {
  const back = readsLine(p);
  p.write('\x03');
  p.typed = p.typed.then(() => back);
}
// A command line typed into the shell and run, as the human would type it; after what is being typed already.
const typeLine = (p: Pty, line: string) => { p.typed = p.typed.then(() => p.write(`${line}\r`)); };

function pressTerminalKey(p: Pty, key: string) {
  let data = terminalKeys[key];
  if (typeof data !== 'string') return false;
  if (/^(Arrow|Home$|End$)/.test(key) && p.screen?.modes.applicationCursorKeysMode) data = data.replace('\x1b[', '\x1bO');
  p.write(data);
  return true;
}
function pasteTerminal(p: Pty, text: string, paste: boolean) {
  const data = text.replace(/\x1b/g, '').replace(/\r?\n/g, '\r');
  p.write(paste && p.screen?.modes.bracketedPasteMode ? `\x1b[200~${data}\x1b[201~` : data);
}

// Put text into the agent's prompt as a paste (bracketed: one block, nothing in it is taken as a key), not sent.
function typeIntoPrompt(p: IPty, text: string) {
  p.write(`\x1b[200~${text}\x1b[201~`);
}
// Delete the last n characters before the cursor in the agent's prompt, as Backspace does.
const eraseInPrompt = (p: IPty, n: number) => p.write('\x7f'.repeat(n));

// What a terminal shows, without its escape codes and spaces: the words an agent's UI draws are split by moves of the
// cursor, which take the spaces' place.
const plain = (s: string) => s.replace(/\x1b\[[0-9;?<>=]*[a-zA-Z~]|\x1b\][^\x07]*\x07/g, '').replace(/\s+/g, '');
// Whether the output shows what test looks for within ms.
const outputShows = (p: IPty, test: (seen: string) => boolean, ms: number) => new Promise<boolean>((resolve) => {
  let seen = '';
  const sub = p.onData((d) => { seen += d; if (test(plain(seen))) end(true); });
  const limit = setTimeout(() => end(false), ms);
  function end(ok: boolean) { sub.dispose(); clearTimeout(limit); resolve(ok); }
});
// A line sent to the agent as the human would: pasted, then Enter once the agent has drawn it. confirm: the words of the
// question the agent asks then (Claude Code's /add-dir: whether to add the folder), answered with Enter, its first
// choice; nothing when it does not come. Not before the agent's command is typed into its shell: sent before, the line
// went to the shell (a repository added as the task opened; macOS's bash 3.2, without bracketed paste, waits for quiet).
async function sendToPrompt(p: Pty, text: string, confirm?: string) {
  await p.typed;
  const drawn = outputShows(p, (s) => s.length > 0, 1000);
  typeIntoPrompt(p, text);
  await drawn;
  const asked = confirm ? outputShows(p, (s) => s.includes(plain(confirm)), 10_000) : null;
  p.write('\r');
  if (asked && await asked) p.write('\r');
}

export type { Pty, TerminalConfig, TerminalOutput };
export { startTerminal, stopTerminal, stopAllTerminals, forgetTerminal, terminalTail, typeIntoPrompt, eraseInPrompt, sendToPrompt, interrupt, typeLine, onEscape, terminalScreen, setTerminalSize, pressTerminalKey, pasteTerminal };

export { quotePaths } from './shell-quote.ts';
