// A task's history for its agents (task_history; docs/transcripts.md): where the work stands and the task's
// conversations, each agent's, with what each was about; then one conversation, read from its transcript on disk
// (transcripts.ts), the latest chapter first, in parts. Kulisa keeps no copy: the agents' transcripts are the one record.
import fs from 'fs';
import { progress } from './worktrees.ts';
import type { Task } from './tasks.ts';
import type { Conversation as Saved } from './store.ts';
import type { Conversation, Entry } from './transcripts.ts';
import { refused } from '../shared/result.ts';
import type { Result } from '../shared/result.ts';

// A part's size in characters, about 10,000 tokens: under what agents take from one tool's result.
const PART = 40_000;
// A request quoted in the list of conversations, at most.
const QUOTE = 200;

const LABEL: Record<Entry['kind'], string> = {
  human: 'The human', agent: 'The agent', call: 'The agent ran', result: 'Its result', error: 'Its result (an error)',
  summary: "The agent's summary of what came before (written when its context was compacted: it worked from this on)",
};
const when = (t?: number) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '');
const quote = (s: string) => JSON.stringify(s.length > QUOTE ? `${s.slice(0, QUOTE)}…` : s);

// Where the work stands, what no transcript says: the code, the profiles, the terminals.
async function standing(task: Task) {
  const { entry } = task;
  const lines = [`# Where the task stands (from Kulisa)`, '',
    `The task "${task.name}", in ${task.folder}${entry.branch ? `, on branch ${entry.branch}` : ''}.`];
  for (const c of entry.copies || []) {
    const { log, status, stat } = await progress(c);
    lines.push('', `## The code: ${c.folder} (a copy of ${c.repo})`,
      `Commits since the task started:\n${log || '(none)'}`,
      `Not committed:\n${status || '(nothing)'}`,
      ...(stat ? [`Changed since the task started:\n${stat}`] : []));
  }
  const open = [...task.profiles.values()].map((p) => `${p.id} ("${p.name}")`);
  const closed = [...task.closed.values()].map(({ cfg }) => `${cfg.id} ("${cfg.name}")`);
  lines.push('', '## Profiles', `Open: ${open.join(', ') || 'none'}. Closed: ${closed.join(', ') || 'none'}.`);
  const shells = task.terminalsInfo().list.filter((t) => !t.agent);
  if (shells.length) lines.push('', '## Terminals', ...shells.map((t) => `- ${t.name}: ${t.command || 'a shell'}`));
  return lines.join('\n');
}

// A conversation read: its agent's name, its tab's name, and what was said, or why it cannot be read.
function read(task: Task, c: Saved, i: number): { name: string; tab: string; open: boolean; conv?: Conversation; why?: string } {
  const agent = task.shell.agentFor(c.agent, { any: true });
  const name = agent?.name || c.agent || 'an agent';
  const t = c.terminal === undefined ? undefined : task.terminals.get(c.terminal);
  const tab = t ? task.label(t) : c.title || agent?.cli || name;
  const base = { name, tab, open: !!t };
  if (!agent?.conversation) return { ...base, why: "Kulisa does not read this agent's transcripts yet" };
  if (!c.transcript || !fs.existsSync(c.transcript)) return { ...base, why: i === task.conversations().length - 1 ? 'nothing said yet' : 'its transcript is gone' };
  try { return { ...base, conv: agent.conversation(c.transcript) }; } catch (e) {
    console.warn('[history]', c.transcript, (e as Error).message);
    return { ...base, why: 'its transcript could not be read' };
  }
}

// Where the task stands, then its conversations, each with what it was about (the human's first and last requests).
async function overview(task: Task) {
  const list = task.conversations().map((c, i) => {
    const r = read(task, c, i), asked = r.conv?.entries.filter((e) => e.kind === 'human') || [];
    return [`${i + 1}. "${r.tab}": ${r.name}, ${r.open ? 'open in its tab' : 'closed'}, from ${when(c.from)}${c.to ? ` to ${when(c.to)}` : ''}.`,
      r.conv ? [asked[0] ? `   First request: ${quote(asked[0].text)}` : '   No request yet.',
        asked.length > 1 && `   Last request: ${quote(asked.at(-1)!.text)}`,
        `   How its last turn ended: ${r.conv.stopped || 'as usual'}.`].filter(Boolean).join('\n') : `   Its conversation cannot be read here (${r.why}).`].join('\n');
  });
  return [await standing(task), '', '# Its conversations, oldest first', '',
    list.length ? list.join('\n') : 'None yet.', '',
    'Read one whole with task_history and its number (conversation).'].join('\n');
}

// One conversation whole: its chapters (a chapter starts at a summary), the latest first.
function whole(task: Task, n: number): Result<{ text: string }> {
  const c = task.conversations()[n - 1];
  if (!c) return { error: `There are ${task.conversations().length} conversations.` };
  const { name, tab, conv, why } = read(task, c, n - 1);
  const head = `Conversation ${n}, "${tab}", ${name}, from ${when(c.from)}${c.to ? ` to ${when(c.to)}` : ''}`;
  if (!conv) return { text: `# ${head}\n\nIts conversation cannot be read here (${why}).` };
  let part: Entry[] = [];
  const parts = [part];
  for (const e of conv.entries) {
    if (e.kind === 'summary' && part.length) parts.push(part = []);
    part.push(e);
  }
  const chapters = parts.map((p, k) => {
    const end = k === parts.length - 1 ? [
      `### How its last turn ended\n${conv.stopped || 'As usual.'}`,
      conv.plan && `### The agent's last plan\n${conv.plan}`,
      conv.memory && `### What the agent remembered in this folder (its own notes)\n${conv.memory}`,
    ].filter(Boolean) : [];
    return [`# ${head}, chapter ${k + 1} of ${parts.length}`, ...p.map((e) => `### ${LABEL[e.kind]}\n${e.text}`), ...end].join('\n\n');
  });
  return { text: [`${head}: what was said and done, the latest chapter first and the earlier ones after it. Read every part.`, ...chapters.reverse()].join('\n\n') };
}

// Its parts: cut at a line's end near PART. The whole text is made at part 1 and kept for the next parts, so the
// parts stay the same while the agent reads them (its own transcript grows meanwhile).
const made = new WeakMap<Task, Map<number, string[]>>();
function split(text: string) {
  const parts: string[] = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(at + PART, text.length);
    if (end < text.length) { const nl = text.lastIndexOf('\n', end); if (nl > at + PART / 2) end = nl + 1; }
    parts.push(text.slice(at, end)); at = end;
  }
  return parts;
}
// conversation: its number (from 1); none: the overview.
async function historyPart(task: Task, part: number, conversation = 0): Promise<Result<{ text: string; parts: number }>> {
  if (!made.has(task)) made.set(task, new Map());
  const kept = made.get(task)!;
  if (part === 1 || !kept.has(conversation)) {
    const r = conversation ? whole(task, conversation) : { text: await overview(task) };
    if (refused(r)) return r;
    kept.set(conversation, split(r.text));
  }
  const parts = kept.get(conversation)!;
  if (part > parts.length) return { error: `There are ${parts.length} parts.` };
  const next = `task_history with${conversation ? ` conversation ${conversation} and` : ''} part ${part + 1}`;
  return { parts: parts.length, text: `Part ${part} of ${parts.length}.${part < parts.length ? ` Then ${next}.` : ' The last one.'}\n\n${parts[part - 1]}` };
}

export { historyPart };
