// The agent CLIs Kulisa knows (CLAUDE.md, "Not tied to one agent"; ROADMAP, "Choosing the agent"). Everything
// Kulisa needs to know about one agent is its entry here: who makes it and what it needs, how to find it, how to
// install it (its maker's own installer, run by Kulisa for the human), how to start it connected to Kulisa and how
// to continue a task's conversation. Each task has its own (agent.json).
//   id, name, maker, needs   shown in the window when the human chooses
//   site                     the maker's page of it (the Agents window links to it)
//   command                  the program; null: the user's shell only, no agent
//   install                  the maker's installer, a command line for sh (posix) and PowerShell (win32)
//   installDirs              where the installer puts the program (default ~/.local/bin, as the native installers)
//   args(ctx)                arguments that connect it to Kulisa; ctx: { env (the task's, tasks.ts), plugin }
//   resume(saved)            arguments that continue the conversation saved in agent.json, or nothing
//   dirs(folders)            the task's other folders (its copies of the project's other repositories): { args, env }
//                            that give them to it; without, it learns of them from the MCP server's instructions
//   addDir(folder)           what is typed into its prompt when the task gets a folder while it runs (the human sends
//                            it); without, a line saying so
//   prepare(ctx)             before it starts in a task's copy (a worktree): ctx { folder, project: { folder (the
//                            project's), and the task's agent.json } }
//   conversation(transcript) its transcript read as the task's history (transcripts.ts; task_history): { entries,
//                            plan, stopped, memory }; without, its runs give the history nothing but Kulisa's part
//   forget(ctx)              a task's copy is deleted: everything the agent keeps of its folder goes (conversations,
//                            the folder's trust, history); ctx { folder, saved (its agent.json), project (the
//                            project's folder, and an agent.json of one of its tasks with a transcript) }
//   config                   its accounts (accounts.ts): { env, home(), login(), status, email(out), logout }:
//                            the variable naming its config folder; the human's own folder (where it keeps its sign-in
//                            without that variable); the arguments of its own sign-in (run in a terminal, it ends when
//                            signed in), of its status (ends with 0 when signed in) and the email in what that says
//                            (none: not known), and of signing out (accountEmail, signOut)
//   voice                    dictation, when the agent has its own (the window's microphone button; none without):
//                            args  more arguments, which turn it on as the button needs it
//                            key, repeat  what is typed into its terminal again and again while it records, every
//                                  repeat ms, as a held key repeats (a terminal tells no key's release)
//                            languages  the languages it understands (codes)
//                            language(saved), setLanguage(saved, code)  the one it uses; saved: its agent.json
//                            note  what the human should know about the language, shown with it
import { execFile, spawn } from 'child_process';
import { stripVTControlCharacters } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeFileAtomic } from './store.ts';
import { claudeConversation } from './transcripts.ts';
import type { Conversation } from './transcripts.ts';

// The languages Claude Code's dictation understands (as of 2.1.294).
const CLAUDE_LANGUAGES = ['en', 'es', 'fr', 'ja', 'de', 'pt', 'it', 'ko', 'hi', 'id', 'ru', 'pl', 'tr', 'nl', 'uk', 'el', 'cs', 'da', 'sv', 'no'];

// A task's agent.json: its conversation as the agent's hooks reported it (agent-hooks.ts), and its account's folder.
interface Saved { sessionId?: string; transcript?: string; started?: boolean; configDir?: string | null }
// Where an agent's program is (findAgent).
interface Found { path: string | null; onPath: boolean }
// What a task tells its agent (tasks.ts): its environment, the Kulisa plugin.
interface ArgsContext { env: Record<string, string | undefined>; plugin: string }
interface ForgetContext { folder: string; saved?: Saved; project?: { folder?: string; transcript?: string }; configDir?: string | null }
interface Agent {
  id: string; name: string; maker: string; command: string | null; needs: string; site?: string; custom?: boolean;
  install?: { posix?: string; win32?: string };
  installDirs?: string[];
  args?: (ctx: ArgsContext) => string[];
  resume?: false | ((saved: Saved) => string[] | false | null | undefined | '');
  dirs?: (folders: string[]) => { args: string[]; env?: Record<string, string> };
  addDir?: (folder: string) => string;
  prepare?: (ctx: { folder: string; project: { folder: string; transcript?: string }; configDir?: string | null }) => void;
  forget?: (ctx: ForgetContext) => boolean;
  conversation?: (transcript: string) => Conversation;
  config?: { env: string; home: () => string; login: () => string[]; status: string[]; email: (out: string) => string | null; logout: string[] };
  voice?: {
    args?: string[]; key: string; repeat: number; note?: string; languages: string[];
    language: (saved: Saved) => string; setLanguage: (saved: Saved, code: string) => { language?: string; error?: string };
  };
  shell?: { command: string; args?: string[] };
}

const AGENTS: Agent[] = [
  {
    id: 'claude', name: 'Claude Code', maker: 'Anthropic', command: 'claude', site: 'https://code.claude.com/docs',
    needs: 'A Claude plan (Pro, Max, Team, Enterprise) or an Anthropic API key',
    install: { posix: 'curl -fsSL https://claude.ai/install.sh | bash', win32: 'irm https://claude.ai/install.ps1 | iex' },
    // The Kulisa plugin: its MCP config (KULISA_MCP_URL), the profiles skill, the hooks.
    args: ({ plugin }) => ['--plugin-dir', plugin],
    // Its own commands for its sign-in (checked with 2.1.296): `auth login` as its /login, `auth status --json` says the
    // email, `auth logout` also clears it from the macOS Keychain.
    config: { env: 'CLAUDE_CONFIG_DIR', home: () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
      login: () => ['auth', 'login'], status: ['auth', 'status', '--json'],
      email: (out) => { try { return JSON.parse(out).email || null; } catch { return null; } }, logout: ['auth', 'logout'] },
    resume: ({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && ['--resume', sessionId],
    // The task's other repositories, with their CLAUDE.md read as its own folder's (checked with 2.1.296).
    dirs: (folders) => ({ args: folders.flatMap((f) => ['--add-dir', f]), env: { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1' } }),
    addDir: (folder) => `/add-dir ${folder}`,
    // A task's folder is the project's own code: trusted as the project's folder is, so Claude Code does not ask again.
    prepare: ({ folder, project, configDir }) => {
      const file = configDir ? claudeConfigFile(configDir) : project.transcript && claudeConfigOf(project.transcript);
      if (file) trustLikeProject(file, project.folder, folder);
    },
    forget: (ctx) => forgetClaude(ctx),
    conversation: claudeConversation,
    // Its voice mode (needs a Claude.ai account), on for Kulisa's sessions only (not the user's settings): space held
    // (its repeats coming) records, the text put where the cursor is, also after text already there, and left in the
    // input for the human to send. Its tap mode (a tap starts, another stops) was tried first: it records only with
    // the input empty (checked in 2.1.294's code), so a second sentence could not be added. The language is its
    // `language` setting, which is also the one it answers in; read again at each recording, and the settings file is
    // read again when it changes, so a language set here holds from the next recording, in every session of the
    // human's.
    voice: {
      args: ['--settings', JSON.stringify({ voice: { enabled: true, mode: 'hold', autoSubmit: false } })],
      key: ' ', repeat: 33, // a keyboard's repeat rate; Claude Code takes it for held after a few, and let go after a pause
      note: 'Claude Code answers in it too: it is its language setting',
      languages: CLAUDE_LANGUAGES,
      language: (saved) => claudeLanguage(readJSON(claudeSettingsOf(saved))?.language),
      // saved: its agent.json, with the account's configDir (tasks.ts)
      setLanguage: (saved, code) => setClaudeLanguage(claudeSettingsOf(saved), code),
    },
  },
  {
    id: 'codex', name: 'Codex', maker: 'OpenAI', command: 'codex', site: 'https://developers.openai.com/codex',
    needs: 'A ChatGPT plan (Plus, Pro, Business, Enterprise) or an OpenAI API key',
    install: { posix: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh', win32: 'irm https://chatgpt.com/codex/install.ps1 | iex' },
    // Kulisa's MCP server and hooks as config overrides (TOML values), not written into the user's ~/.codex/config.toml.
    args: ({ env }) => ['-c', `mcp_servers.kulisa.url="${env.KULISA_MCP_URL}"`, '-c', `hooks=${codexHooks()}`],
    // Its own sign-in (0.160.1): `login`, `login status`, `logout`. Whether its status says the email is not known
    // yet (no Codex account to try it with): without it the account is shown by its id.
    config: { env: 'CODEX_HOME', home: () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
      login: () => ['login'], status: ['login', 'status'], email: () => null, logout: ['logout'] },
    // The conversation its SessionStart hook reported, else its last one in this folder (each task has its own).
    resume: ({ started, sessionId }) => started && ['resume', sessionId || '--last'],
    // The task's other repositories, writable as its own folder (checked with 0.160.1).
    dirs: (folders) => ({ args: folders.flatMap((f) => ['--add-dir', f]) }),
    forget: ({ folder, configDir }) => forgetCodex(folder, configDir ?? undefined),
  },
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: "No agent: your shell in the task's folder" },
];

// How Claude Code reads its `language` setting (as of 2.1.294): a code, or a language's name in English or in itself, or
// a code with a region (pt-BR); anything else, and none, is English.
const english = new Intl.DisplayNames(['en'], { type: 'language' });
function claudeLanguage(value: unknown) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CLAUDE_LANGUAGES.find((c) => v === c || v === english.of(c)!.toLowerCase()
    || v === new Intl.DisplayNames([c], { type: 'language' }).of(c)!.toLowerCase()) || CLAUDE_LANGUAGES.find((c) => v.split('-')[0] === c) || 'en';
}
// Claude Code's settings file: in the config dir its sessions use (as claudeConfigOf), else its account's
// (configDir), else CLAUDE_CONFIG_DIR or ~/.claude, where a first session will look.
function claudeSettingsOf({ transcript, configDir }: Saved = {}) {
  const dir = transcript ? path.dirname(path.dirname(path.dirname(transcript))) : configDir || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(dir, 'settings.json');
}
const readJSON = (file: string) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
// Its `language`, as its /config sets it (the language's name in English, which it answers in too); the rest of the file
// kept. A file that is there but not JSON is not touched.
function setClaudeLanguage(file: string, code: string) {
  if (!CLAUDE_LANGUAGES.includes(code)) return { error: `not a language it understands: ${code}` };
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    settings = readJSON(file);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { error: `${file} is not JSON: fix or remove it first` };
  } else fs.mkdirSync(path.dirname(file), { recursive: true });
  settings.language = english.of(code);
  writeFileAtomic(file, `${JSON.stringify(settings, null, 2)}\n`, fs.existsSync(file) ? { mode: fs.statSync(file).mode } : {});
  return { language: code };
}

// Claude Code's own config file, as the session it reported tells it (<config dir>/projects/<folder>/<id>.jsonl, the
// config dir being CLAUDE_CONFIG_DIR or ~/.claude), so it is the one the project's environment chose (direnv …).
function claudeConfigOf(transcript: string) { return claudeConfigFile(path.dirname(path.dirname(path.dirname(transcript)))); }
// The config file of a config dir: ~/.claude keeps it next to it (~/.claude.json), CLAUDE_CONFIG_DIR inside.
function claudeConfigFile(dir: string) {
  return path.basename(dir) === '.claude' && path.dirname(dir) === os.homedir() ? path.join(os.homedir(), '.claude.json') : path.join(dir, '.claude.json');
}
// Claude Code asks once per folder whether to trust it, and keeps the answer in its config file
// (projects[<folder>].hasTrustDialogAccepted). A task's folder gets the project folder's answer when it is yes. Not documented:
// when the file is not as expected, nothing is changed (Claude asks, as without Kulisa). Written whole at once, so
// Claude never reads it half-written.
function trustLikeProject(file: string, projectFolder: string, folder: string) {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const projects = config.projects;
    if (!projects || typeof projects !== 'object' || projects[projectFolder]?.hasTrustDialogAccepted !== true) return false;
    if (projects[folder]?.hasTrustDialogAccepted === true) return true;
    projects[folder] = { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
      hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false, ...projects[folder], hasTrustDialogAccepted: true };
    writeFileAtomic(file, JSON.stringify(config, null, 2), { mode: fs.statSync(file).mode });
    return true;
  } catch (e) { console.warn('[agents] trust:', (e as Error).message); return false; }
}

// What Claude Code keeps of a deleted task's folder, all of it (undocumented layout, as of Claude Code 2.1; what is not
// found is skipped), in the config dir the sessions used (from the transcript the SessionStart hook reported, else
// another task's of the project: the same environment):
//   projects/<folder, non-alphanumerics as ->/   its conversations (<session>.jsonl, and a folder per session).
//                                                 Folders of other tasks can map to the same name (kulisa@ыва and
//                                                 kulisa@фыв are both kulisa----): only the sessions whose recorded
//                                                 cwd is the task's folder go
//   file-history/<session>, session-env/<session>, debug/<session>.txt, todos/<session>-*   per session
//   history.jsonl                                 the prompts typed, a line each with "project": <folder>
//   .claude.json (claudeConfigOf)                 projects[<folder>]: its trust and settings
// Never the project's folder.
function forgetClaude({ folder, saved = {}, project = {} }: ForgetContext) {
  const transcript = saved.transcript || project.transcript;
  if (!folder || !path.isAbsolute(folder) || folder === project.folder || !transcript) return false;
  const projects = path.dirname(path.dirname(transcript));
  if (path.basename(projects) !== 'projects') return false;
  const dir = path.dirname(projects);
  const conversations = path.join(projects, folder.replace(/[^a-zA-Z0-9]/g, '-'));
  const sessions = new Set([saved.sessionId, ...(fs.existsSync(conversations) ? fs.readdirSync(conversations) : [])
    .filter((f) => f.endsWith('.jsonl') && cwdOf(path.join(conversations, f)) === folder).map((f) => f.slice(0, -'.jsonl'.length))].filter(Boolean));
  for (const id of sessions) {
    fs.rmSync(path.join(conversations, `${id}.jsonl`), { force: true });
    fs.rmSync(path.join(conversations, id!), { recursive: true, force: true });
  }
  try { fs.rmdirSync(conversations); } catch {} // when nothing of another folder is left in it
  for (const id of sessions) {
    for (const f of [['file-history', id!], ['session-env', id!], ['debug', `${id}.txt`]]) fs.rmSync(path.join(dir, ...f), { recursive: true, force: true });
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
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[agents] forget:', (e as Error).message); }
  return true;
}

// The first lines of a transcript (JSONL, its first 64 KB), parsed; one that is not JSON is null.
function headLines(file: string) {
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(65536);
    const head = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, 0));
    fs.closeSync(fd);
    return head.split('\n').map((line) => { try { return JSON.parse(line); } catch { return null; } });
  } catch { return []; }
}
// The folder a Claude Code transcript was made in: the cwd of its first line that has one.
const cwdOf = (file: string) => headLines(file).find((l) => l?.cwd)?.cwd ?? null;

// Codex's hooks (its docs, learn.chatgpt.com/docs/hooks; not yet tried in a session, ROADMAP), each telling Kulisa an
// event of its own (agent-hooks.ts) as Claude Code's plugin does. The command is the same for every task
// (KULISA_URL comes from the terminal's environment), so the human trusts them once in Codex's /hooks: Codex runs no
// hook it has not been told to trust, and Kulisa never passes --dangerously-bypass-hook-trust (it would run any
// project's hooks unreviewed too). SessionEnd hooks get at most 3 s.
const CODEX_HOOKS = { SessionStart: 'session-start', UserPromptSubmit: 'prompt', PermissionRequest: 'waiting', Stop: 'stop',
  Interrupt: 'interrupt', SessionEnd: 'session-end' };
const codexHooks = () => `{${Object.entries(CODEX_HOOKS).map(([event, to]) => {
  const t = event === 'SessionEnd' ? 1 : 3;
  return `${event}=[{hooks=[{type="command",timeout=${t + 1},command='curl -sf --max-time ${t} --data-binary @- "$KULISA_URL/hooks/${to}" || true'}]}]`;
}).join(',')}}`;

// What Codex keeps of a deleted task's folder (undocumented layout, as of Codex 0.160), in CODEX_HOME (~/.codex):
//   sessions/…/rollout-*.jsonl, archived_sessions/…   its conversations: the first line's payload.cwd is the folder
//   config.toml                                       [projects."<folder>"]: its trust
// Its own databases (state_*.sqlite) are not touched: their format is Codex's alone.
function forgetCodex(folder: string, home: string = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  if (!folder || !path.isAbsolute(folder)) return false;
  const walk = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true, withFileTypes: true }) : [])
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => path.join(e.parentPath, e.name));
  for (const f of [...walk(path.join(home, 'sessions')), ...walk(path.join(home, 'archived_sessions'))]) {
    const meta = headLines(f)[0];
    if (meta && (meta.payload?.cwd ?? meta.cwd) === folder) fs.rmSync(f, { force: true });
  }
  // The table of the folder, up to the next table.
  const key = (q: string) => `[projects.${q}${q === '"' ? folder.replace(/\\/g, '\\\\') : folder}${q}]`;
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
function rewriteLines(file: string, keep: (line: string) => boolean) {
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  const lines = text.split('\n');
  const kept = lines.filter((l) => { try { return keep(l); } catch { return true; } });
  if (kept.length !== lines.length) writeFileAtomic(file, kept.join('\n'), { mode: fs.statSync(file).mode });
}

const run = (cmd: string, args: string[], opts: { cwd?: string }) => new Promise<string | null>((resolve) =>
  execFile(cmd, args, { timeout: 8000, windowsHide: true, ...opts }, (e, out) => resolve(e ? null : String(out))));

// Where the agent's program is: { path, onPath }, or null when it is not installed. Looked up as the user's shell
// would (a login shell: Kulisa started from a menu may have a shorter PATH), then where its installer puts it, for a
// shell that has not picked up the installer's PATH change yet.
async function findAgent(agent: Agent, cwd: string): Promise<Found | null> {
  if (!agent.command) return { path: null, onPath: true };
  if (agent.custom) return { path: agent.command, onPath: true };
  const win = process.platform === 'win32';
  const found = win ? await run('where.exe', [agent.command], { cwd })
    : await run(process.env.SHELL || os.userInfo().shell || '/bin/sh', ['-ilc', `command -v ${agent.command}`], { cwd });
  const line = found?.split(/\r?\n/).map((l) => l.trim()).reverse().find((l) => path.isAbsolute(l));
  if (line) return { path: line, onPath: true };
  const local = (agent.installDirs || [path.join(os.homedir(), '.local', 'bin')]).map((d) => path.join(d, agent.command + (win ? '.exe' : ''))).find((f) => fs.existsSync(f));
  return local ? { path: local, onPath: false } : null;
}

// The version of an installed agent, as its --version says it ("2.1.289 (Claude Code)", "codex-cli 0.160.1"), or
// null. Its input is closed at once: a program that does not know --version must not wait for it.
function agentVersion(found: Found | null): Promise<string | null> {
  if (!found?.path) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = execFile(found.path!, ['--version'], { timeout: 5000, windowsHide: true }, (e, out) =>
      resolve(e ? null : String(out).match(/\d+\.\d+(\.\d+)?/)?.[0] ?? null));
    p.stdin?.end();
  });
}

// Run the maker's installer; its output goes to onData as it comes (without terminal colors). Resolves to the exit
// code.
function installAgent(agent: Agent, onData: (data: string) => void) {
  const line = installLine(agent);
  if (!line) return Promise.resolve(1);
  const p = process.platform === 'win32'
    ? spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', line], { windowsHide: true })
    : spawn('/bin/sh', ['-c', line]);
  const out = (d: unknown) => onData(stripVTControlCharacters(String(d)));
  p.stdout.on('data', out); p.stderr.on('data', out);
  return new Promise<number>((resolve) => { p.on('error', (e) => { out(`${e.message}\n`); resolve(1); }); p.on('close', (code) => resolve(code ?? 1)); });
}

// An account's sign-in, as its agent's own status says it, its config folder dir: { email } (null: signed in, the email
// not known), or null when not signed in. found: where the agent is (findAgent).
function accountEmail(agent: Agent, found: Found | null, dir: string): Promise<{ email: string | null } | null> {
  const config = agent.config;
  if (!found?.path || !config?.status) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = execFile(found.path!, config.status, { timeout: 20000, windowsHide: true, env: { ...process.env, [config.env]: dir } },
      (e, out) => resolve(e ? null : { email: config.email(String(out))?.toLowerCase() ?? null }));
    p.stdin?.end();
  });
}
// Signed out of an account before its folder goes, with the agent's own command: what it keeps outside the folder
// (Claude Code's Keychain entry on macOS) goes too.
function signOut(agent: Agent, found: Found | null, dir: string) {
  const config = agent.config;
  if (!found?.path || !config?.logout) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const p = execFile(found.path!, config.logout, { timeout: 20000, windowsHide: true, env: { ...process.env, [config.env]: dir } }, () => resolve());
    p.stdin?.end();
  });
}

// The command line the window shows before installing.
const installLine = (agent: Agent) => agent.install?.[process.platform === 'win32' ? 'win32' : 'posix'] || null;

export type { Agent, Found };
export { AGENTS, findAgent, agentVersion, accountEmail, signOut, installAgent, installLine, trustLikeProject, claudeConfigOf, claudeLanguage };
