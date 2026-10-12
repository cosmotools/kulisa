// Codex (OpenAI), as Kulisa runs it (agent.ts): Kulisa's MCP server and hooks as config overrides, its accounts, its
// trust of a folder, what it keeps of a task's folder, its transcript read as the task's history.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeFileAtomic } from '../store.ts';
import { cut, ownTool, lines } from '../transcripts.ts';
import type { Conversation, Entry } from '../transcripts.ts';
import { headLines, rewriteLines } from './files.ts';
import { KULISA_ASKS, hookCommand, hookSeconds } from './agent.ts';
import type { Agent, Hook, Where } from './agent.ts';

// Codex's hooks (its docs, learn.chatgpt.com/docs/hooks; tried in a session with 0.160.1), as config overrides. Codex
// runs no hook the human has not trusted (/hooks), keeping the trust under one key per event for every task, and
// Kulisa never passes --dangerously-bypass-hook-trust (it would run any project's hooks unreviewed too): a hook changed
// here is asked about once again. Its MCP tools' questions come as PermissionRequest too.
const CODEX_HOOKS: Hook[] = [
  { on: 'SessionStart', sends: 'session-start' },
  { on: 'UserPromptSubmit', sends: 'prompt' },
  { on: 'PermissionRequest', sends: 'waiting' },
  { on: 'PostToolUse', sends: 'tool-done' },
  { on: 'Stop', sends: 'stop' },
  { on: 'Interrupt', sends: 'interrupt' },
  { on: 'SessionEnd', sends: 'session-end' },
];
const codexHooks = () => `{${CODEX_HOOKS.map(({ on, sends }) =>
  `${on}=[{hooks=[{type="command",timeout=${hookSeconds(sends) + 1},command='${hookCommand(sends)}'}]}]`).join(',')}}`;

const codex: Agent = {
  id: 'codex', name: 'Codex', maker: 'OpenAI', command: 'codex', site: 'https://developers.openai.com/codex',
  needs: 'A ChatGPT plan (Plus, Pro, Business, Enterprise) or an OpenAI API key',
  install: { posix: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh', win32: 'irm https://chatgpt.com/codex/install.ps1 | iex' },
  // Kulisa's MCP server and hooks as config overrides (TOML values), not written into the user's ~/.codex/config.toml;
  // its tools approved but KULISA_ASKS (its MCP docs, 0.160.1: `approve` runs a tool without a question).
  args: ({ env }) => ['-c', `mcp_servers.kulisa.url="${env.KULISA_MCP_URL}"`, '-c', `hooks=${codexHooks()}`,
    '-c', 'mcp_servers.kulisa.default_tools_approval_mode="approve"',
    ...KULISA_ASKS.flatMap((t) => ['-c', `mcp_servers.kulisa.tools.${t}.approval_mode="prompt"`])],
  hooks: CODEX_HOOKS,
  // A project's own config of it (repository-scoped, 0.160.1): a task's copy gets it when git ignores it.
  localFiles: ['/.codex/config.toml'],
  // Its skills: <CODEX_HOME>/skills/<name>/SKILL.md, the same format as Claude Code's (0.160.1).
  skills: 'skills',
  lacks: {
    addDir: 'Codex 0.160.1 has no command to add a folder in a session: told in a line instead',
    voice: 'Codex 0.160.1 has no dictation of its own, only a realtime voice conversation',
  },
  // Its own sign-in (0.160.1): `login`, `login status`, `logout`. Its status does not say the email ("Logged in
  // using ChatGPT", checked 2026-10-12): the account is shown by its id.
  config: { env: 'CODEX_HOME', home: () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    login: () => ['login'], status: ['login', 'status'], email: () => null, logout: ['logout'] },
  // The conversation its SessionStart hook reported, else its last one in this folder (each task has its own).
  resume: ({ started, sessionId }) => started && ['resume', sessionId || '--last'],
  // The task's other repositories, writable as its own folder (checked with 0.160.1).
  dirs: (folders) => ({ args: folders.flatMap((f) => ['--add-dir', f]) }),
  trust: { has: (where, folder) => codexTrusted(codexHome(where), folder), set: (where, folder) => codexTrust(codexHome(where), folder) },
  forget: ({ folder, configDir }) => forgetCodex(folder, configDir ?? undefined),
  conversation: codexConversation,
  // `codex [PROMPT]` (its --help, 0.160.1).
  prompt: (text) => [text],
};

// Codex keeps its answer in its config.toml: a table [projects."<folder>"] with trust_level = "trusted" (0.160.1;
// "untrusted" when the human said no, which is never carried).
const codexHome = ({ configDir }: Where) => configDir || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const tomlKey = (folder: string) => `"${folder.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
function codexTrusted(home: string, folder: string) {
  let text: string;
  try { text = fs.readFileSync(path.join(home, 'config.toml'), 'utf8'); } catch { return false; }
  let inside = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('[')) inside = t === `[projects.${tomlKey(folder)}]` || t === `[projects.'${folder}']`;
    else if (inside && /^trust_level\s*=\s*["']trusted["']/.test(t)) return true;
  }
  return false;
}
function codexTrust(home: string, folder: string) {
  const file = path.join(home, 'config.toml');
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return false; }
  if (text.split('\n').some((l) => l.trim() === `[projects.${tomlKey(folder)}]`)) return false; // the human's answer there
  writeFileAtomic(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${text ? '\n' : ''}[projects.${tomlKey(folder)}]\ntrust_level = "trusted"\n`);
  return true;
}

// What Codex keeps of a deleted task's folder (undocumented layout, as of Codex 0.160), in CODEX_HOME (~/.codex):
//   sessions/…/rollout-*.jsonl, archived_sessions/…   its conversations: the first line's payload.cwd is the folder
//   history.jsonl                                     the prompts typed, a line each with the session_id of one of those
//   config.toml                                       [projects."<folder>"]: its trust
// Its own databases (state_*.sqlite) are not touched: their format is Codex's alone.
function forgetCodex(folder: string, home: string = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  if (!folder || !path.isAbsolute(folder)) return false;
  const walk = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true, withFileTypes: true }) : [])
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => path.join(e.parentPath, e.name));
  const sessions = new Set<string>();
  for (const f of [...walk(path.join(home, 'sessions')), ...walk(path.join(home, 'archived_sessions'))]) {
    const meta = headLines(f)[0];
    if (!meta || (meta.payload?.cwd ?? meta.cwd) !== folder) continue;
    if (meta.payload?.id) sessions.add(meta.payload.id);
    fs.rmSync(f, { force: true });
  }
  if (sessions.size) rewriteLines(path.join(home, 'history.jsonl'), (line) => !sessions.has(JSON.parse(line).session_id));
  // The table of the folder, up to the next table.
  const key = (q: string) => (q === '"' ? `[projects.${tomlKey(folder)}]` : `[projects.'${folder}']`);
  const config = path.join(home, 'config.toml');
  let skipping = false;
  rewriteLines(config, (line) => {
    const t = line.trim();
    if (t.startsWith('[')) skipping = t === key('"') || t === key("'");
    return !skipping;
  });
  return true;
}

// Codex's transcript (checked with 0.160.1: sessions/…/rollout-*.jsonl in its CODEX_HOME): a JSON record per line,
// { type, payload }. What was said and done is in `response_item`s (the model's own items); `event_msg`s repeat them
// for its screen. It calls tools from scripts (`exec`, a custom tool: Kulisa's as tools.mcp__kulisa__<name>(…)), so
// a call is its script, its result what the script printed. A compaction keeps its summary encrypted: a chapter starts
// there with no text of it.
type Item = { type?: string; role?: string; name?: string; input?: string; arguments?: string; call_id?: string; output?: unknown; content?: unknown };
const codexText = (c: unknown): string => (typeof c === 'string' ? c
  : Array.isArray(c) ? c.map((b: { type?: string; text?: string }) => (/^(input|output)_text$/.test(b?.type || '') ? b.text || '' : '')).join('') : '');
// What Codex puts into the conversation as the user's but the human did not type: its environment, the project's
// AGENTS.md, a note that a turn was interrupted.
const notTyped = (text: string) => /^\s*(<(environment_context|user_instructions|turn_aborted)>|# AGENTS\.md instructions)/.test(text);
// A script that only calls task_history (or only lists the tools to find it).
const ownScript = (input: string) => /task_history/.test(input) && [...input.matchAll(/tools\.(\w+)\s*\(/g)].every((m) => ownTool(m[1]!));
function codexConversation(transcript: string): Conversation {
  const entries: Entry[] = [], calls = new Map<string, string>(), answered = new Set<string>(), own = new Set<string>();
  let plan: string | null = null, seq = 0, lastHuman = -1, lastAnswer = -1, aborted = -1;
  for (const r of lines(transcript)) {
    seq++;
    const p = (r.payload || {}) as Item;
    if (r.type === 'compacted') { entries.push({ kind: 'summary', text: 'Codex keeps this summary encrypted: it cannot be read here. From here on it worked from it and the human\'s messages before it; what it did before is in the chapter before.' }); continue; }
    if (r.type === 'event_msg' && (p as { type?: string }).type === 'turn_aborted') { aborted = seq; continue; }
    if (r.type !== 'response_item') continue;
    if (p.type === 'message' && p.role === 'user') {
      const text = codexText(p.content);
      if (text && !notTyped(text)) { entries.push({ kind: 'human', text }); lastHuman = seq; }
    } else if (p.type === 'message' && p.role === 'assistant') {
      const text = codexText(p.content);
      if (text) { entries.push({ kind: 'agent', text }); lastAnswer = seq; }
    } else if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const input = p.type === 'custom_tool_call' ? String(p.input ?? '') : String(p.arguments ?? '');
      calls.set(p.call_id!, p.name || 'a tool'); lastAnswer = seq;
      if (p.name === 'update_plan') {
        try { plan = (JSON.parse(input).plan || []).map((s: { status?: string; step?: string }) => `[${s.status}] ${s.step}`).join('\n'); } catch {}
      } else if (ownTool(p.name || '') || (p.name === 'exec' && ownScript(input))) own.add(p.call_id!);
      else entries.push({ kind: 'call', text: `${p.name}: ${input}` });
    } else if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      answered.add(p.call_id!);
      if (own.has(p.call_id!) || calls.get(p.call_id!) === 'update_plan') continue;
      const out = p.output as unknown;
      entries.push({ kind: 'result', text: cut(typeof out === 'string' ? out : codexText(out) || JSON.stringify(out ?? '')) });
    }
  }
  const open = [...calls].filter(([id]) => !answered.has(id) && !own.has(id)).map(([, name]) => name);
  const stopped = open.length ? `its last turn was cut off while it ran ${open.join(', ')}, with no result`
    : aborted > lastHuman ? 'the human interrupted its last turn'
      : lastHuman > lastAnswer ? 'the human\'s last message got no answer' : null;
  return { entries, plan, stopped, memory: null };
}

export { codex, codexConversation };
