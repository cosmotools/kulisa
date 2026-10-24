// Claude Code (Anthropic), as Kulisa runs it (agent.ts): the Kulisa plugin, its settings, its accounts, its trust of
// a folder, what it keeps of a task's folder, its transcript read as the task's history, its dictation.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeFileAtomic } from '../store.ts';
import { cut, ownTool, lines, tailLines } from '../kulisa-plugin/transcripts.ts';
import type { Conversation, Entry } from '../kulisa-plugin/transcripts.ts';
import { readJSON, headLines, rewriteLines, writeChanged } from './files.ts';
import { KULISA_ASKS, hookCommand, hookSeconds } from './agent.ts';
import type { Agent, Hook, Where, ForgetContext } from './agent.ts';

const CLAUDE_KULISA = 'mcp__plugin_kulisa_kulisa'; // the plugin's server, as Claude Code names its tools

// Its dictation's key held: space at a keyboard's repeat rate; Claude Code takes it for held after a few, and let go
// after a pause.
const CLAUDE_VOICE = { key: ' ', repeat: 33 };
// The languages Claude Code's dictation understands.
const CLAUDE_LANGUAGES = ['en', 'es', 'fr', 'ja', 'de', 'pt', 'it', 'ko', 'hi', 'id', 'ru', 'pl', 'tr', 'nl', 'uk', 'el', 'cs', 'da', 'sv', 'no'];

// Its hooks (docs/tasks.md, "Choosing the agent"): waiting when it asks for a
// permission or a question (Notification, not its idle_prompt, sent a minute after an answer: done says that already)
// or a turn ends with an API error (StopFailure: a limit, a sign-in). Given in --settings with the plugin (both are
// taken), so they run in Kulisa's sessions only.
const CLAUDE_HOOKS: Hook[] = [
  { on: 'SessionStart', sends: 'session-start' },
  { on: 'UserPromptSubmit', sends: 'prompt' },
  { on: 'Notification', sends: 'waiting', matcher: 'permission_prompt|elicitation_dialog|elicitation_url_dialog' },
  { on: 'PostToolUse', sends: 'tool-done' },
  { on: 'Stop', sends: 'stop' },
  { on: 'StopFailure', sends: 'waiting' },
  { on: 'SessionEnd', sends: 'session-end' },
];
// A path as Claude Code's permission rules take an absolute one, //path; on Windows its POSIX form (C:\a: //c/a).
const claudePath = (p: string) => (/^[a-z]:[\\/]/i.test(p) ? `//${p[0]!.toLowerCase()}${p.slice(2).replace(/\\/g, '/')}` : `/${p}`);
const claudeHooks = () => {
  const out: Record<string, object[]> = {};
  for (const h of CLAUDE_HOOKS) {
    (out[h.on] ||= []).push({ ...(h.matcher && { matcher: h.matcher }), hooks: [{ type: 'command', command: hookCommand(h.sends), timeout: hookSeconds(h.sends) + 1 }] });
  }
  return out;
};

const claude: Agent = {
  id: 'claude', name: 'Claude Code', maker: 'Anthropic', command: 'claude', site: 'https://code.claude.com/docs',
  needs: 'A Claude plan (Pro, Max, Team, Enterprise) or an Anthropic API key',
  install: { posix: 'curl -fsSL https://claude.ai/install.sh | bash', win32: 'irm https://claude.ai/install.ps1 | iex' },
  // A project's own settings of it, not in git (.claude/settings.local.json): a task's copy gets them too.
  localFiles: ['/.claude/settings.local.json'],
  // The Kulisa plugin (claude-plugin/ among Kulisa's packages): its MCP config (KULISA_MCP_URL). Settings for Kulisa's sessions only, in one
  // --settings (two are not documented to merge): its tools allowed but KULISA_ASKS (an ask rule wins over an allow
  // rule), reading the files of its pages Kulisa keeps outside its folders (else it asks each time), its hooks,
  // and the dictation (voice, below).
  // The settings go as a file in its account's folder (kulisa-settings.json, rewritten at each start): the command
  // typed into the terminal stays short. Without an account, the same JSON on the command line.
  args: ({ packages, account, artifacts }) => {
    const settings = JSON.stringify({
      permissions: { allow: [CLAUDE_KULISA, `Read(${claudePath(artifacts)}/**)`], ask: KULISA_ASKS.map((t) => `${CLAUDE_KULISA}__${t}`) },
      hooks: claudeHooks(),
      // voiceEnabled too: without it dictation is taken for off (its /voice writes both; the object alone leaves the
      // space typing spaces).
      voiceEnabled: true, voice: { enabled: true, mode: 'hold', autoSubmit: false } }, null, 2);
    const file = account && path.join(account, 'kulisa-settings.json');
    if (file) writeChanged(file, `${settings}\n`);
    return ['--plugin-dir', path.join(packages, 'claude-plugin'), '--settings', file || settings];
  },
  hooks: CLAUDE_HOOKS,
  // Its personal skills: <CLAUDE_CONFIG_DIR>/skills/<name>/SKILL.md.
  skills: 'skills',
  // Its own commands for its sign-in: `auth login` as its /login, `auth status --json` says the
  // email, `auth logout` also clears it from the macOS Keychain.
  config: { env: 'CLAUDE_CONFIG_DIR', home: () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
    login: () => ['auth', 'login'], status: ['auth', 'status', '--json'],
    email: (out) => { try { return JSON.parse(out).email || null; } catch { return null; } }, logout: ['auth', 'logout'] },
  resume: ({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && ['--resume', sessionId],
  // The task's other repositories, with their CLAUDE.md read as its own folder's.
  dirs: (folders) => ({ args: folders.flatMap((f) => ['--add-dir', f]), env: { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1' } }),
  // It asks then: "Add directory to workspace", 1. Yes, for this session.
  addDir: { command: (folder) => `/add-dir ${folder}`, confirm: 'Add directory to workspace' },
  trust: {
    has: (where, folder) => { const f = claudeConfigWhere(where); return !!f && readJSON(f)?.projects?.[folder]?.hasTrustDialogAccepted === true; },
    set: (where, folder) => { const f = claudeConfigWhere(where); return !!f && claudeTrust(f, folder); },
  },
  forget: (ctx) => forgetClaude(ctx),
  conversation: claudeConversation,
  title: ({ transcript }) => claudeTitle(transcript),
  // `claude [prompt]`: its interactive mode, the prompt sent (its --help).
  prompt: (text) => [text],
  // Its voice mode (needs a Claude.ai account), on for Kulisa's sessions only (not the user's settings): space held
  // (its repeats coming) records, the text put where the cursor is, also after text already there, and left in the
  // input for the human to send. Not its tap mode (a tap starts, another stops): it records only with the input
  // empty (its code), so a second sentence cannot be added.
  voice: CLAUDE_VOICE,
  // Its `language` setting: the language it dictates in and answers in (and may write comments in: the project's
  // CLAUDE.md decides that). Read again at each recording, and the settings file is read again when it changes, so a
  // language set holds at once in every session of the account. Kulisa's instruction to answer
  // in another language loses to it: one setting for both.
  language: { languages: CLAUDE_LANGUAGES, set: (dir, code) => setClaudeLanguage(path.join(dir, 'settings.json'), code) },
  // Its dictation recognizing for an agent without one (src/dictation's hidden session): an account signed in with
  // Claude.ai (its voice mode is offered with no other sign-in), in its hold mode with autoSubmit, so the text let go
  // is submitted, and its UserPromptSubmit hook posts it to Kulisa, whose answer blocks it: the model never gets it.
  // No plugins' MCP servers (--strict-mcp-config): a session that only listens needs none of their memory. Its
  // variables of a Claude Code session Kulisa may run in are left out: the session would take itself for a child.
  recognizer: {
    available: (dir) => !!readJSON(claudeConfigFile(dir))?.oauthAccount,
    args: () => ['--settings', JSON.stringify({ voiceEnabled: true, voice: { enabled: true, mode: 'hold', autoSubmit: true },
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: hookCommand('prompt'), timeout: hookSeconds('prompt') + 1 }] }] } }),
    '--strict-mcp-config'],
    env: (env) => Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('CLAUDE'))),
    ...CLAUDE_VOICE,
    // Its input: a blocked prompt is put back there, the cursor at its start, so Ctrl+E (to the end) then Ctrl+U
    // (deletes back to the line's start) empties it; Enter submits (autoSubmit submits from three words only).
    clear: '\x05\x15', submit: '\r',
  },
};

// Claude Code's own name for the conversation, the one its /status shows: an "ai-title" line in the transcript, which
// it writes again every few records as the conversation goes, so the last non-empty one in the transcript's end wins. A
// name derived from the folder (its sessions file, nameSource "derived") is not a real title and is not read here.
async function claudeTitle(transcript: string): Promise<string | null> {
  let title: string | null = null;
  for (const r of await tailLines(transcript, 1 << 20)) if (r.type === 'ai-title' && typeof r.aiTitle === 'string' && r.aiTitle.trim()) title = r.aiTitle.trim();
  return title;
}

const english = new Intl.DisplayNames(['en'], { type: 'language' });
// Its `language`, as its /config sets it (the language's name in English, which it answers in too); the rest of the file
// kept; not written again when it already says it. A file that is there but not JSON is not touched.
function setClaudeLanguage(file: string, code: string) {
  if (!CLAUDE_LANGUAGES.includes(code)) return { error: `not a language it understands: ${code}` };
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    settings = readJSON(file);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { error: `${file} is not JSON: fix or remove it first` };
    if (settings.language === english.of(code)) return {};
  } else fs.mkdirSync(path.dirname(file), { recursive: true });
  settings.language = english.of(code);
  writeFileAtomic(file, `${JSON.stringify(settings, null, 2)}\n`, fs.existsSync(file) ? { mode: fs.statSync(file).mode } : {});
  return {};
}

// Claude Code's own config file, as the session it reported tells it (<config dir>/projects/<folder>/<id>.jsonl, the
// config dir being CLAUDE_CONFIG_DIR or ~/.claude), so it is the one the project's environment chose (direnv …).
function claudeConfigOf(transcript: string) { return claudeConfigFile(path.dirname(path.dirname(path.dirname(transcript)))); }
// The config file of a config dir: ~/.claude keeps it next to it (~/.claude.json), CLAUDE_CONFIG_DIR inside.
function claudeConfigFile(dir: string) {
  return path.basename(dir) === '.claude' && path.dirname(dir) === os.homedir() ? path.join(os.homedir(), '.claude.json') : path.join(dir, '.claude.json');
}

const claudeConfigWhere = ({ configDir, transcript }: Where) => (configDir ? claudeConfigFile(configDir) : transcript ? claudeConfigOf(transcript) : null);
// Claude Code keeps its answer in its config file (projects[<folder>].hasTrustDialogAccepted). Not documented: when
// the file is not as expected, nothing is changed (Claude asks, as without Kulisa). Written whole at once, so Claude
// never reads it half-written.
function claudeTrust(file: string, folder: string) {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const projects = config.projects;
    if (!projects || typeof projects !== 'object' || Array.isArray(projects)) return false;
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
// Its config dir is the one a transcript is in, else the account's (configDir: a folder no conversation reported).
function forgetClaude({ folder, saved = {}, project = {}, configDir }: ForgetContext) {
  const transcript = saved.transcript || project.transcript;
  if (!folder || !path.isAbsolute(folder) || folder === project.folder || (!transcript && !configDir)) return false;
  const projects = transcript ? path.dirname(path.dirname(transcript)) : path.join(configDir!, 'projects');
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
  const config = transcript ? claudeConfigOf(transcript) : claudeConfigFile(dir);
  try {
    const json = JSON.parse(fs.readFileSync(config, 'utf8'));
    if (json.projects?.[folder]) {
      delete json.projects[folder];
      writeFileAtomic(config, JSON.stringify(json, null, 2), { mode: fs.statSync(config).mode });
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[agents] forget:', (e as Error).message); }
  return true;
}

// The folder a Claude Code transcript was made in: the cwd of its first line that has one.
const cwdOf = (file: string) => headLines(file).find((l) => l?.cwd)?.cwd ?? null;

type Block = { type?: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean; content?: unknown };
const textOf = (c: unknown): string => (typeof c === 'string' ? c
  : Array.isArray(c) ? c.map((b: Block) => (b?.type === 'text' ? b.text || '' : '')).join('') : '');

// A tool call as the next agent needs it: what was run, which file was edited and how; a file read by its path
// alone (the file is in the task's folder, and may have changed since).
function call(name: string, input: Record<string, unknown> = {}) {
  const s = (k: string) => String(input[k] ?? '');
  if (name === 'Bash') return `Bash: ${s('command')}`;
  if (name === 'Read') return `Read ${s('file_path')}`;
  if (name === 'Edit') return `Edit ${s('file_path')}\n--- old\n${s('old_string')}\n--- new\n${s('new_string')}`;
  if (name === 'Write') return `Write ${s('file_path')}\n${s('content')}`;
  return `${name} ${JSON.stringify(input)}`;
}

// Claude Code's transcript: a JSON record per line; `user` and `assistant` records with
// `message.content`, a string or blocks; a tool call's `id` is its result's `tool_use_id`. What the agent remembered
// in the task's folder is next to it (projects/<folder>/memory/).
function claudeConversation(transcript: string): Conversation {
  const entries: Entry[] = [], calls = new Map<string, string>(), answered = new Set<string>();
  let plan: string | null = null, seq = 0, lastHuman = -1, lastAnswer = -1;
  const human = (text: string) => { entries.push({ kind: 'human', text }); lastHuman = seq; };
  for (const r of lines(transcript)) {
    seq++;
    const c = r.message?.content;
    if (r.type === 'attachment') {
      // The human's message typed while the agent worked, sent at its next step (a string, or text blocks); queued
      // notices of background tasks and every other attachment are the CLI's.
      const a = r.attachment;
      if (a?.type === 'queued_command' && a.origin?.kind === 'human' && textOf(a.prompt)) human(textOf(a.prompt));
    } else if (r.type === 'user') {
      if (r.isCompactSummary) { entries.push({ kind: 'summary', text: textOf(c) }); continue; }
      if (r.isMeta) continue; // a hook's or a skill's text
      if (typeof c === 'string') { human(c); continue; }
      for (const b of (Array.isArray(c) ? c : []) as Block[]) {
        if (b.type === 'text' && b.text) human(b.text);
        else if (b.type === 'tool_result') {
          answered.add(b.tool_use_id!);
          const name = calls.get(b.tool_use_id!);
          if (name === 'Read' || (name && ownTool(name))) continue;
          const t = textOf(b.content);
          entries.push(b.is_error ? { kind: 'error', text: t } : { kind: 'result', text: cut(t) });
        }
      }
    } else if (r.type === 'assistant') {
      for (const b of (Array.isArray(c) ? c : []) as Block[]) {
        if (b.type === 'text' && b.text) { entries.push({ kind: 'agent', text: b.text }); lastAnswer = seq; }
        else if (b.type === 'tool_use' && b.name) {
          calls.set(b.id!, b.name);
          lastAnswer = seq;
          if (b.name === 'TodoWrite') {
            const todos = (b.input?.todos || []) as { content?: string; status?: string }[];
            plan = todos.map((t) => `[${t.status}] ${t.content}`).join('\n');
          } else if (!ownTool(b.name)) entries.push({ kind: 'call', text: call(b.name, b.input) });
        }
      }
    }
  }
  // Where its last turn stopped: a call with no result (cut off, by its limit or the human), or the human's last
  // message with no answer after it.
  const open = [...calls].filter(([id, name]) => !answered.has(id) && !ownTool(name)).map(([, name]) => name);
  const stopped = open.length ? `its last turn was cut off while it ran ${open.join(', ')}, with no result`
    : lastHuman > lastAnswer ? 'the human\'s last message got no answer' : null;
  return { entries, plan, stopped, memory: claudeMemory(path.join(path.dirname(transcript), 'memory')) };
}
// Claude Code's memory of a folder: its index first, then each fact's file.
function claudeMemory(dir: string) {
  let files: string[];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort((a, b) => Number(b === 'MEMORY.md') - Number(a === 'MEMORY.md')); } catch { return null; }
  const text = files.map((f) => `### ${f}\n${fs.readFileSync(path.join(dir, f), 'utf8').trim()}`).join('\n\n');
  return text || null;
}

export { claude, claudeConfigOf, claudeConversation };
