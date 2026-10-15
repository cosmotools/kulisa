// xterm.js in the renderer, node-pty here running the agent CLI unchanged. A task's terminals (tasks.ts) are
// "<task key>#<id>". The window shows the shown task's, the others keep running (and the window keeps their output).
import { on } from './ipc.ts';
import type { Events } from '../shared/ipc.ts';
import os from 'os';
import pty from 'node-pty';
import type { IPty } from 'node-pty';
import xterm from '@xterm/headless';
import type { Terminal } from '@xterm/headless';
import { READ_MAX } from './mcp-server.ts';


interface Size { cols: number; rows: number }
// A terminal's process, with what Kulisa keeps of it.
type Pty = IPty & { spawnSize: Size; spawnArgs: string[]; key: string; screen?: Terminal; stopped?: boolean };
// How a terminal starts (startTerminal).
interface TerminalConfig {
  command?: string | null; args?: string[]; cwd?: string; env?: Record<string, string | undefined>;
  shell?: { command: string; args?: string[] } | false | null; line?: string; size?: Size | null; sizeOf?: string;
  pinned?: Record<string, string>; screen?: boolean;
}
type Send = (channel: 'pty:out', data: Events['pty:out']) => void;
interface Term { pty: Pty | null; size: Size | null; firstSize: Promise<void>; sized: () => void }

// The terminal's size as the window measures it, per terminal and per task (its island's, which all its terminals
// share: one is shown at a time). An agent starts only once its size is known: Claude Code draws its prompt for the
// size it starts with and does not fully redraw on the first resize. However long the window takes to lay the island
// out: a default size after 5 s (120×30, until 2026-10-15) is what GitHub's runner got, its window slower than that.
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
  const t = termOf(task), island = termOf(task.split('#')[0]!);
  t.size = island.size = { cols, rows }; t.sized(); island.sized();
  try { t.pty?.resize(cols, rows); t.pty?.screen?.resize(cols, rows); } catch {}
});
on('pty:in', (_e, { task, data }) => terms.get(task)?.pty?.write(data));

// The user's shell as a terminal app starts it (login shell on macOS, as Terminal and VS Code do). An app started
// from the Dock or a menu may have no SHELL; the account's shell is the same then.
const userShell = () => (process.platform === 'win32' ? null
  : { command: process.env.SHELL || os.userInfo().shell || '/bin/sh', args: process.platform === 'darwin' ? ['-l'] : [] });
const shQuote = (a: string) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

// cfg: { command, args, cwd, env, shell, line, size, sizeOf }. The agent is typed into the user's shell started in cwd, as if the human
// opened a terminal in the project and ran it: the shell's startup sets the project's environment (direnv's .envrc,
// nvm, mise …), which Kulisa's own environment (where Kulisa was started) is not. When the agent exits, the shell
// stays. shell: { command, args } instead of the user's, or false to start the agent directly (as on Windows).
// pinned: variables of env the shell's startup must not change, typed before the command too (`VAR=… cmd`: bash, zsh,
// fish 3.1+): the task's account, which a project's .envrc setting CLAUDE_CONFIG_DIR replaced (2026-10-12).
// line: a command line typed into the shell as it is (a shell's; none: the shell alone), on Windows into cmd. size:
// start at it rather than wait for the window's; sizeOf: or at that key's (the task's island: a terminal behind another
// tab has none of its own), whichever comes first. screen: kept for the agent to read (a shell's). key: the terminal's; the window sends its input and size, and gets
// its output, under it. send(channel, data): to the task's window, whichever it is then.
async function startTerminal(send: Send, cfg: TerminalConfig, key: string): Promise<Pty> {
  const t = termOf(key), like = cfg.sizeOf ? termOf(cfg.sizeOf) : null;
  if (!cfg.size) await Promise.race([t.firstSize, ...(like ? [like.firstSize] : [])]);
  const { cols, rows } = (t.size || cfg.size || like?.size)!; // one of them: given, or waited for
  const sh: { command: string; args?: string[] } | null = cfg.shell === false ? null : cfg.shell || userShell() || (cfg.line !== undefined ? { command: process.env.COMSPEC || 'cmd.exe' } : null);
  const command = cfg.command || (process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : process.env.SHELL || 'bash');
  const p = pty.spawn(sh ? sh.command : command, sh ? sh.args || [] : cfg.args || [], {
    name: 'xterm-256color', cols, rows, cwd: cfg.cwd || process.cwd(),
    env: { ...process.env, COLORTERM: 'truecolor', ...(cfg.env || {}) },
  }) as Pty;
  if (cfg.line) typeWhenReady(p, `${cfg.line}\r`);
  else if (sh && cfg.command) {
    const vars = Object.entries(cfg.pinned || {}).map(([k, v]) => `${k}=${shQuote(v)}`);
    typeWhenReady(p, ` ${[...vars, ...[cfg.command, ...(cfg.args || [])].map(shQuote)].join(' ')}\r`);
  }
  p.spawnSize = { cols: p.cols, rows: p.rows };
  p.spawnArgs = cfg.args || [];
  p.key = key;
  // An agent that was replaced says nothing more in the window.
  if (cfg.screen) p.screen = new xterm.Terminal({ cols: p.cols, rows: p.rows, scrollback: READ_MAX, allowProposedApi: true });
  const out = (data: string) => { p.screen?.write(data); if (t.pty === p) send('pty:out', { task: key, data }); };
  p.onData(out);
  p.onExit(({ exitCode }) => out(`\r\n[process exited ${exitCode}]\r\n`));
  t.pty = p;
  return p;
}

// Type the agent's command once the shell reads its input line, or it shows twice (the terminal echoes what comes
// before, then the shell shows it again). A shell reading a line turns bracketed paste on (bash, zsh, fish); for
// other shells, once the output has been quiet for a moment. A leading space keeps it out of the shell's history
// (bash's default ignorespace).
function typeWhenReady(p: IPty, line: string) {
  let done = false, quiet: NodeJS.Timeout | undefined;
  const type = () => { if (done) return; done = true; sub.dispose(); clearTimeout(quiet); clearTimeout(limit); p.write(line); };
  const sub = p.onData((d) => {
    if (d.includes('\x1b[?2004h')) return type();
    clearTimeout(quiet); quiet = setTimeout(type, 500);
  });
  const limit = setTimeout(type, 5000);
}

// Stop the agent; its output no longer reaches the window. The terminal's size is kept for the next agent there.
function stopTerminal(p: Pty) {
  p.stopped = true;
  const t = terms.get(p.key);
  if (t?.pty === p) t.pty = null;
  try { p.kill(); } catch {}
  p.screen?.dispose(); p.screen = undefined;
}

// A terminal closed, or its task gone (its project closed, a task deleted): its size too. Opened again, the window
// measures it anew.
const forgetTerminal = (key: string) => terms.delete(key);

// The last lines of a shell as plain text, as its screen shows them; a line the screen wrapped at its width is one.
function terminalTail(p: Pty, lines: number) {
  const buffer = p.screen?.buffer.active, rows: string[] = [];
  for (let y = 0; buffer && y < buffer.length; y++) {
    const line = buffer.getLine(y)!, text = line.translateToString();
    if (line.isWrapped && rows.length) rows[rows.length - 1] += text; else rows.push(text);
  }
  return rows.map((l) => l.trimEnd()).join('\n').trimEnd().split('\n').slice(-lines).join('\n');
}

// Put text into the agent's prompt as a paste (bracketed: one block, nothing in it is taken as a key), not sent.
function typeIntoPrompt(p: IPty, text: string) {
  p.write(`\x1b[200~${text}\x1b[201~`);
}

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
// choice; nothing when it does not come.
async function sendToPrompt(p: IPty, text: string, confirm?: string) {
  const drawn = outputShows(p, (s) => s.length > 0, 1000);
  typeIntoPrompt(p, text);
  await drawn;
  const asked = confirm ? outputShows(p, (s) => s.includes(plain(confirm)), 10_000) : null;
  p.write('\r');
  if (asked && await asked) p.write('\r');
}

export type { Pty };
export { startTerminal, stopTerminal, forgetTerminal, terminalTail, typeIntoPrompt, sendToPrompt };
