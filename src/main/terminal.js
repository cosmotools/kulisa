// xterm.js in the renderer, node-pty here running the agent CLI unchanged. One terminal per workspace (its key); the
// window shows the shown workspace's, the others keep running (and the window keeps their output).
const { ipcMain } = require('electron');
const os = require('os');
const pty = require('node-pty');

// The terminal's size as the window measures it, per workspace. An agent starts only once its size is known: Claude
// Code draws its prompt for the size it starts with and does not fully redraw on the first resize. Listening from
// require time, so a size sent while the window loads is not missed.
const terms = new Map(); // key -> { pty, size, sized (resolves the first size) }
const termOf = (key) => {
  if (!terms.has(key)) { const t = { pty: null, size: null }; t.firstSize = new Promise((r) => (t.sized = r)); terms.set(key, t); }
  return terms.get(key);
};
ipcMain.on('pty:resize', (_e, { ws, cols, rows }) => {
  const t = termOf(ws);
  t.size = { cols, rows }; t.sized();
  try { t.pty?.resize(cols, rows); } catch {}
});
ipcMain.on('pty:in', (_e, { ws, data }) => terms.get(ws)?.pty?.write(data));

// The user's shell as a terminal app starts it (login shell on macOS, as Terminal and VS Code do). An app started
// from the Dock or a menu may have no SHELL; the account's shell is the same then.
const userShell = () => (process.platform === 'win32' ? null
  : { command: process.env.SHELL || os.userInfo().shell || '/bin/sh', args: process.platform === 'darwin' ? ['-l'] : [] });
const shQuote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

// cfg: { command, args, cwd, env, shell }. The agent is typed into the user's shell started in cwd, as if the human
// opened a terminal in the project and ran it: the shell's startup sets the project's environment (direnv's .envrc,
// nvm, mise …), which Kulisa's own environment (where Kulisa was started) is not. When the agent exits, the shell
// stays. shell: { command, args } instead of the user's, or false to start the agent directly (as on Windows).
// key: the workspace's; the window sends its input and size, and gets its output, under it. send(channel, data): to
// the workspace's window, whichever it is then.
async function startTerminal(send, cfg, key) {
  const t = termOf(key);
  await Promise.race([t.firstSize, new Promise((r) => setTimeout(r, 5000))]);
  const { cols, rows } = t.size || { cols: 120, rows: 30 };
  const sh = cfg.shell === false ? null : cfg.shell || userShell();
  const command = cfg.command || (process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : process.env.SHELL || 'bash');
  const p = pty.spawn(sh ? sh.command : command, sh ? sh.args || [] : cfg.args || [], {
    name: 'xterm-256color', cols, rows, cwd: cfg.cwd || process.cwd(),
    env: { ...process.env, COLORTERM: 'truecolor', ...(cfg.env || {}) },
  });
  if (sh && cfg.command) typeWhenReady(p, ` ${[cfg.command, ...(cfg.args || [])].map(shQuote).join(' ')}\r`);
  p.spawnSize = { cols: p.cols, rows: p.rows };
  p.spawnArgs = cfg.args || [];
  p.key = key;
  // An agent that was replaced says nothing more in the window.
  const out = (data) => { if (t.pty === p) send('pty:out', { ws: key, data }); };
  p.onData(out);
  p.onExit(({ exitCode }) => out(`\r\n[process exited ${exitCode}]\r\n`));
  t.pty = p;
  return p;
}

// Type the agent's command once the shell reads its input line, or it shows twice (the terminal echoes what comes
// before, then the shell shows it again). A shell reading a line turns bracketed paste on (bash, zsh, fish); for
// other shells, once the output has been quiet for a moment. A leading space keeps it out of the shell's history
// (bash's default ignorespace).
function typeWhenReady(p, line) {
  let done = false, quiet;
  const type = () => { if (done) return; done = true; sub.dispose(); clearTimeout(quiet); clearTimeout(limit); p.write(line); };
  const sub = p.onData((d) => {
    if (d.includes('\x1b[?2004h')) return type();
    clearTimeout(quiet); quiet = setTimeout(type, 500);
  });
  const limit = setTimeout(type, 5000);
}

// Stop the agent; its output no longer reaches the window. The terminal's size is kept for the next agent there.
function stopTerminal(p) {
  const t = terms.get(p.key);
  if (t?.pty === p) t.pty = null;
  try { p.kill(); } catch {}
}

// A workspace gone (its project closed, a fork deleted): its terminal's size too. Opened again, the window measures
// it anew.
const forgetTerminal = (key) => terms.delete(key);

// Put text into the agent's prompt as a paste (bracketed: one block, nothing in it is taken as a key), not sent.
function typeIntoPrompt(p, text) {
  p.write(`\x1b[200~${text}\x1b[201~`);
}

module.exports = { startTerminal, stopTerminal, forgetTerminal, typeIntoPrompt };
