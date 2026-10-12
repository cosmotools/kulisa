// Agents' transcripts read as the task's history (task_history): a reader per CLI, the same entries out of each.
// The formats are the agents' own and undocumented; which fields are kept and why: ROADMAP, "Switching a task's
// agent". A record of a kind a reader does not know is skipped, so a new kind in a new version loses nothing else.
import fs from 'fs';
import path from 'path';

// What the next agent reads: the human's words, the agent's answers and actions, their results, the agent's own
// summaries of what came before (a compaction's: a chapter starts there).
type Entry = { kind: 'human' | 'agent' | 'call' | 'result' | 'error' | 'summary'; text: string };
interface Conversation { entries: Entry[]; plan: string | null; stopped: string | null; memory: string | null }

// A tool's output past this is cut to its start and end; an error stays whole. One constant, to tune on real handoffs.
const CUT = 2048;
const cut = (s: string) => (s.length <= 2 * CUT ? s : `${s.slice(0, CUT)}\n… [${s.length - 2 * CUT} characters cut] …\n${s.slice(-CUT)}`);
// task_history's own calls and results are not history: what they returned is in the runs already.
const ownTool = (name: string) => /(^|__)task_history$/.test(name);

type Block = { type?: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean; content?: unknown };
const textOf = (c: unknown): string => (typeof c === 'string' ? c
  : Array.isArray(c) ? c.map((b: Block) => (b?.type === 'text' ? b.text || '' : '')).join('') : '');
const lines = (file: string) => fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => {
  if (!l) return [];
  try { return [JSON.parse(l)]; } catch { return []; }
});

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

// Claude Code's transcript (checked with 2.1.296): a JSON record per line; `user` and `assistant` records with
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

export { claudeConversation, CUT };
export type { Entry, Conversation };
