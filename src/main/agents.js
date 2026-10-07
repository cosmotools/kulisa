// The agent CLIs Kulisa knows (CLAUDE.md, "Not tied to one agent"; ROADMAP, "Choosing the agent"). Everything
// Kulisa needs to know about one agent is its entry here: who makes it and what it needs, how to find it, how to
// install it (its maker's own installer, run by Kulisa for the human), how to start it connected to Kulisa and how
// to continue a workspace's conversation. Each workspace has its own (agent.json).
//   id, name, maker, needs   shown in the window when the human chooses
//   site                     the maker's page of it (the Agents window links to it)
//   command                  the program; null: the user's shell only, no agent
//   install                  the maker's installer, a command line for sh (posix) and PowerShell (win32)
//   dirs                     where the installer puts the program (default ~/.local/bin, as the native installers)
//   args(ctx)                arguments that connect it to Kulisa; ctx: { env (the workspace's, workspaces.js), plugin }
//   resume(saved)            arguments that continue the conversation saved in agent.json, or nothing
//   prepare(ctx)             before it starts in a fork: ctx { folder, main: { folder, and main's agent.json } }
//   forget(ctx)              a fork is deleted: everything the agent keeps of its folder goes (conversations, the
//                            folder's trust, history); ctx { folder, saved (its agent.json), main (main's folder and
//                            agent.json) }
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { writeFileAtomic } = require('./store');

const AGENTS = [
  {
    id: 'claude', name: 'Claude Code', maker: 'Anthropic', command: 'claude', site: 'https://code.claude.com/docs',
    needs: 'A Claude plan (Pro, Max, Team, Enterprise) or an Anthropic API key',
    install: { posix: 'curl -fsSL https://claude.ai/install.sh | bash', win32: 'irm https://claude.ai/install.ps1 | iex' },
    // The Kulisa plugin: its MCP config (KULISA_MCP_URL), the profiles skill, the hooks.
    args: ({ plugin }) => ['--plugin-dir', plugin],
    resume: ({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && ['--resume', sessionId],
    // A fork's folder is the project's own code: trusted as main is, so Claude Code does not ask again.
    prepare: ({ folder, main }) => { if (main.transcript) trustLikeMain(claudeConfigOf(main.transcript), main.folder, folder); },
    forget: (ctx) => forgetClaude(ctx),
  },
  {
    id: 'codex', name: 'Codex', maker: 'OpenAI', command: 'codex', site: 'https://developers.openai.com/codex',
    needs: 'A ChatGPT plan (Plus, Pro, Business, Enterprise) or an OpenAI API key',
    install: { posix: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh', win32: 'irm https://chatgpt.com/codex/install.ps1 | iex' },
    // Kulisa's MCP server and hooks as config overrides (TOML values), not written into the user's ~/.codex/config.toml.
    args: ({ env }) => ['-c', `mcp_servers.kulisa.url="${env.KULISA_MCP_URL}"`, '-c', `hooks=${codexHooks()}`],
    // The conversation its SessionStart hook reported, else its last one in this folder (each workspace has its own).
    resume: ({ started, sessionId }) => started && ['resume', sessionId || '--last'],
    forget: ({ folder }) => forgetCodex(folder),
  },
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: "No agent: your shell in the workspace's folder" },
];

// Claude Code's own config file, as the session it reported tells it (<config dir>/projects/<folder>/<id>.jsonl, the
// config dir being CLAUDE_CONFIG_DIR or ~/.claude), so it is the one the project's environment chose (direnv …).
function claudeConfigOf(transcript) {
  const dir = path.dirname(path.dirname(path.dirname(transcript)));
  return path.basename(dir) === '.claude' && path.dirname(dir) === os.homedir() ? path.join(os.homedir(), '.claude.json') : path.join(dir, '.claude.json');
}
// Claude Code asks once per folder whether to trust it, and keeps the answer in its config file
// (projects[<folder>].hasTrustDialogAccepted). The fork's folder gets main's answer when it is yes. Not documented:
// when the file is not as expected, nothing is changed (Claude asks, as without Kulisa). Written whole at once, so
// Claude never reads it half-written.
function trustLikeMain(file, mainFolder, folder) {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const projects = config.projects;
    if (!projects || typeof projects !== 'object' || projects[mainFolder]?.hasTrustDialogAccepted !== true) return false;
    if (projects[folder]?.hasTrustDialogAccepted === true) return true;
    projects[folder] = { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
      hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false, ...projects[folder], hasTrustDialogAccepted: true };
    writeFileAtomic(file, JSON.stringify(config, null, 2), { mode: fs.statSync(file).mode });
    return true;
  } catch (e) { console.warn('[agents] trust:', e.message); return false; }
}

// What Claude Code keeps of a deleted fork's folder, all of it (undocumented layout, as of Claude Code 2.1; what is not
// found is skipped), in the config dir the sessions used (from the transcript the SessionStart hook reported, else
// main's: the same environment):
//   projects/<folder, non-alphanumerics as ->/   its conversations (<session>.jsonl, and a folder per session).
//                                                 Folders of other forks can map to the same name (kulisa@ыва and
//                                                 kulisa@фыв are both kulisa----): only the sessions whose recorded
//                                                 cwd is the fork's folder go
//   file-history/<session>, session-env/<session>, debug/<session>.txt, todos/<session>-*   per session
//   history.jsonl                                 the prompts typed, a line each with "project": <folder>
//   .claude.json (claudeConfigOf)                 projects[<folder>]: its trust and settings
// Never main's folder.
function forgetClaude({ folder, saved = {}, main = {} }) {
  const transcript = saved.transcript || main.transcript;
  if (!folder || !path.isAbsolute(folder) || folder === main.folder || !transcript) return false;
  const projects = path.dirname(path.dirname(transcript));
  if (path.basename(projects) !== 'projects') return false;
  const dir = path.dirname(projects);
  const conversations = path.join(projects, folder.replace(/[^a-zA-Z0-9]/g, '-'));
  const sessions = new Set([saved.sessionId, ...(fs.existsSync(conversations) ? fs.readdirSync(conversations) : [])
    .filter((f) => f.endsWith('.jsonl') && cwdOf(path.join(conversations, f)) === folder).map((f) => f.slice(0, -'.jsonl'.length))].filter(Boolean));
  for (const id of sessions) {
    fs.rmSync(path.join(conversations, `${id}.jsonl`), { force: true });
    fs.rmSync(path.join(conversations, id), { recursive: true, force: true });
  }
  try { fs.rmdirSync(conversations); } catch {} // when nothing of another folder is left in it
  for (const id of sessions) {
    for (const f of [['file-history', id], ['session-env', id], ['debug', `${id}.txt`]]) fs.rmSync(path.join(dir, ...f), { recursive: true, force: true });
    const todos = path.join(dir, 'todos');
    for (const f of fs.existsSync(todos) ? fs.readdirSync(todos) : []) if (f.startsWith(`${id}-`)) fs.rmSync(path.join(todos, f), { force: true });
  }
  rewriteLines(path.join(dir, 'history.jsonl'), (line) => JSON.parse(line).project !== folder);
  const config = claudeConfigOf(transcript);
  try {
    const json = JSON.parse(fs.readFileSync(config, 'utf8'));
    if (json.projects?.[folder]) {
      delete json.projects[folder];
      writeFileAtomic(config, JSON.stringify(json, null, 2), { mode: fs.statSync(config).mode });
    }
  } catch (e) { if (e.code !== 'ENOENT') console.warn('[agents] forget:', e.message); }
  return true;
}

// The folder a Claude Code transcript was made in: the cwd of its first line that has one.
function cwdOf(file) {
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(65536);
    const head = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, 0));
    fs.closeSync(fd);
    for (const line of head.split('\n')) {
      try { const cwd = JSON.parse(line).cwd; if (cwd) return cwd; } catch {}
    }
  } catch {}
  return null;
}

// Codex's hooks (its docs, learn.chatgpt.com/docs/hooks; not yet tried in a session, ROADMAP), each telling Kulisa an
// event of its own (agent-hooks.js) as Claude Code's plugin does. The command is the same for every workspace
// (KULISA_URL comes from the terminal's environment), so the human trusts them once in Codex's /hooks: Codex runs no
// hook it has not been told to trust, and Kulisa never passes --dangerously-bypass-hook-trust (it would run any
// project's hooks unreviewed too). SessionEnd hooks get at most 3 s.
const CODEX_HOOKS = { SessionStart: 'session-start', UserPromptSubmit: 'prompt', PermissionRequest: 'waiting', Stop: 'stop',
  Interrupt: 'interrupt', SessionEnd: 'session-end' };
const codexHooks = () => `{${Object.entries(CODEX_HOOKS).map(([event, to]) => {
  const t = event === 'SessionEnd' ? 1 : 3;
  return `${event}=[{hooks=[{type="command",timeout=${t + 1},command='curl -sf --max-time ${t} --data-binary @- "$KULISA_URL/hooks/${to}" || true'}]}]`;
}).join(',')}}`;

// What Codex keeps of a deleted fork's folder (undocumented layout, as of Codex 0.160), in CODEX_HOME (~/.codex):
//   sessions/…/rollout-*.jsonl, archived_sessions/…   its conversations: the first line's payload.cwd is the folder
//   config.toml                                       [projects."<folder>"]: its trust
// Its own databases (state_*.sqlite) are not touched: their format is Codex's alone.
function forgetCodex(folder) {
  if (!folder || !path.isAbsolute(folder)) return false;
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).flatMap((e) =>
    (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.jsonl') ? [path.join(d, e.name)] : []));
  for (const f of [...walk(path.join(home, 'sessions')), ...walk(path.join(home, 'archived_sessions'))]) {
    try {
      const fd = fs.openSync(f, 'r'), buf = Buffer.alloc(65536);
      const first = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, 0)).split('\n')[0];
      fs.closeSync(fd);
      const meta = JSON.parse(first);
      if ((meta.payload?.cwd ?? meta.cwd) === folder) fs.rmSync(f, { force: true });
    } catch {}
  }
  // The table of the folder, up to the next table.
  const key = (q) => `[projects.${q}${q === '"' ? folder.replace(/\\/g, '\\\\') : folder}${q}]`;
  const config = path.join(home, 'config.toml');
  let skipping = false;
  rewriteLines(config, (line) => {
    const t = line.trim();
    if (t.startsWith('[')) skipping = t === key('"') || t === key("'");
    return !skipping;
  });
  return true;
}

// A text file without the lines keep() refuses (a line it cannot read is kept); written whole at once, only when
// something goes.
function rewriteLines(file, keep) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  const lines = text.split('\n');
  const kept = lines.filter((l) => { try { return keep(l); } catch { return true; } });
  if (kept.length !== lines.length) writeFileAtomic(file, kept.join('\n'), { mode: fs.statSync(file).mode });
}

const run = (cmd, args, opts) => new Promise((resolve) =>
  execFile(cmd, args, { timeout: 8000, windowsHide: true, ...opts }, (e, out) => resolve(e ? null : String(out))));

// Where the agent's program is: { path, onPath }, or null when it is not installed. Looked up as the user's shell
// would (a login shell: Kulisa started from a menu may have a shorter PATH), then where its installer puts it, for a
// shell that has not picked up the installer's PATH change yet.
async function findAgent(agent, cwd) {
  if (!agent.command) return { path: null, onPath: true };
  if (agent.custom) return { path: agent.command, onPath: true };
  const win = process.platform === 'win32';
  const found = win ? await run('where.exe', [agent.command], { cwd })
    : await run(process.env.SHELL || os.userInfo().shell || '/bin/sh', ['-ilc', `command -v ${agent.command}`], { cwd });
  const line = found?.split(/\r?\n/).map((l) => l.trim()).reverse().find((l) => path.isAbsolute(l));
  if (line) return { path: line, onPath: true };
  const local = (agent.dirs || [path.join(os.homedir(), '.local', 'bin')]).map((d) => path.join(d, agent.command + (win ? '.exe' : ''))).find((f) => fs.existsSync(f));
  return local ? { path: local, onPath: false } : null;
}

// The version of an installed agent, as its --version says it ("2.1.289 (Claude Code)", "codex-cli 0.160.1"), or
// null. Its input is closed at once: a program that does not know --version must not wait for it.
function agentVersion(found) {
  if (!found?.path) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = execFile(found.path, ['--version'], { timeout: 5000, windowsHide: true }, (e, out) =>
      resolve(e ? null : String(out).match(/\d+\.\d+(\.\d+)?/)?.[0] ?? null));
    p.stdin?.end();
  });
}

// Run the maker's installer; its output goes to onData as it comes (without terminal colors). Resolves to the exit
// code.
function installAgent(agent, onData) {
  const line = installLine(agent);
  if (!line) return Promise.resolve(1);
  const p = process.platform === 'win32'
    ? spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', line], { windowsHide: true })
    : spawn('/bin/sh', ['-c', line]);
  const out = (d) => onData(String(d).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
  p.stdout.on('data', out); p.stderr.on('data', out);
  return new Promise((resolve) => { p.on('error', (e) => { out(`${e.message}\n`); resolve(1); }); p.on('close', (code) => resolve(code ?? 1)); });
}

// The command line the window shows before installing.
const installLine = (agent) => agent.install?.[process.platform === 'win32' ? 'win32' : 'posix'] || null;

module.exports = { AGENTS, findAgent, agentVersion, installAgent, installLine, trustLikeMain, claudeConfigOf };
