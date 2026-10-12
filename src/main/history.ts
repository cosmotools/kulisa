// A task's history for its agent (task_history; ROADMAP, "Switching a task's agent"): where the work stands, then
// each run's conversation read from its transcript on disk (transcripts.ts), newest first, in parts. Kulisa keeps
// no copy: the agents' transcripts are the one record.
import fs from 'fs';
import { progress } from './worktrees.ts';
import type { Task } from './tasks.ts';
import type { Run } from './store.ts';
import type { Conversation, Entry } from './transcripts.ts';
import type { Result } from './result.ts';

// A part's size in characters, about 10,000 tokens: under what agents take from one tool's result.
const PART = 40_000;

const LABEL: Record<Entry['kind'], string> = {
  human: 'The human', agent: 'The agent', call: 'The agent ran', result: 'Its result', error: 'Its result (an error)',
  summary: "The agent's summary of what came before (written when its context was compacted: it worked from this on)",
};
const when = (t?: number) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '');

// Where the work stands, what no transcript says: how the last run stopped, the code, the profiles, the terminals.
async function standing(task: Task, last: { name: string; stopped: string | null }) {
  const { entry } = task;
  const lines = [`# Where the task stands (from Kulisa)`, '',
    `The task "${task.name}", in ${task.folder}${entry.branch ? `, on branch ${entry.branch}` : ''}.`,
    `The last run, ${last.name}: ${last.stopped || 'its last turn ended as usual'}.`];
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
  const terms = task.terminalsInfo();
  if (terms.length) lines.push('', '## Terminals besides yours', ...terms.map((t) => `- ${t.name}: ${t.command || 'a shell'}`));
  return lines.join('\n');
}

// A run read: its agent's name, and its conversation, or why there is none.
function readRun(task: Task, run: Run): { name: string; conv?: Conversation; why?: string } {
  const agent = run.agent ? task.shell.agentFor(run.agent, { any: true }) : null;
  const name = agent?.name || run.agent || 'an agent';
  if (!agent?.conversation) return { name, why: "Kulisa does not read this agent's transcripts yet" };
  if (!run.transcript || !fs.existsSync(run.transcript)) return { name, why: 'its transcript is gone' };
  try { return { name, conv: agent.conversation(run.transcript) }; } catch (e) {
    console.warn('[history]', run.transcript, (e as Error).message);
    return { name, why: 'its transcript could not be read' };
  }
}
const runsOf = (task: Task): Run[] => {
  const saved = task.store.agent();
  return [...(saved.runs || []), { agent: saved.agent, sessionId: saved.sessionId, transcript: saved.transcript, from: saved.from }];
};

// The whole text: where the task stands, then each run's chapters (a chapter starts at a summary), the latest first.
async function build(task: Task) {
  const runs = runsOf(task);
  const chapters: string[] = [];
  let last = { name: 'the agent', stopped: null as string | null };
  runs.forEach((run, i) => {
    if (i === runs.length - 1 && !run.transcript) return; // the current one, begun just now: nothing said yet
    const { name, conv, why } = readRun(task, run);
    const head = `Run ${i + 1} of ${runs.length}, ${name}${run.from ? `, from ${when(run.from)}` : ''}${run.to ? ` to ${when(run.to)}` : ''}`;
    if (conv) last = { name, stopped: conv.stopped };
    if (!conv) { chapters.push(`# ${head}\n\nIts conversation cannot be read here (${why}).`); return; }
    const parts: Entry[][] = [[]];
    for (const e of conv.entries) {
      if (e.kind === 'summary' && parts[parts.length - 1].length) parts.push([]);
      parts[parts.length - 1].push(e);
    }
    parts.forEach((p, k) => {
      const end = k === parts.length - 1 ? [
        conv.plan && `### The agent's last plan\n${conv.plan}`,
        conv.memory && `### What the agent remembered in this folder (its own notes)\n${conv.memory}`,
      ].filter(Boolean) : [];
      chapters.push([`# ${head}, chapter ${k + 1} of ${parts.length}`, ...p.map((e) => `### ${LABEL[e.kind]}\n${e.text}`), ...end].join('\n\n'));
    });
  });
  const top = 'The history of this task: where it stands, then what was said and done, the latest chapter first and the ' +
    'earlier ones after it. Read every part.';
  return [top, await standing(task, last), ...chapters.reverse()].join('\n\n');
}

// Its parts: cut at a line's end near PART. The whole text is made at part 1 and kept for the next parts, so the
// parts stay the same while the agent reads them (its own transcript grows meanwhile).
const made = new WeakMap<Task, string[]>();
function split(text: string) {
  const parts: string[] = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(at + PART, text.length);
    if (end < text.length) { const nl = text.lastIndexOf('\n', end); if (nl > at + PART / 2) end = nl + 1; }
    parts.push(text.slice(at, end)); at = end;
  }
  return parts;
}
async function historyPart(task: Task, part: number): Promise<Result<{ text: string }>> {
  if (part === 1 || !made.has(task)) made.set(task, split(await build(task)));
  const parts = made.get(task)!;
  if (part > parts.length) return { error: `There are ${parts.length} parts.` };
  return { text: `Part ${part} of ${parts.length}.${part < parts.length ? ` Then task_history with part ${part + 1}.` : ' The last one.'}\n\n${parts[part - 1]}` };
}

// Where the task stands, for an agent taking it over, before its first turn (agent-hooks.ts, SessionStart): how the
// run before it stopped, the code, the profiles, the terminals. Within Claude Code's cap on a hook's context (10,000
// characters; beyond it Claude gets a file it is not asked to read), the profiles' list beside it.
const GIST = 5000;
async function gist(task: Task) {
  const run = task.store.agent().runs?.at(-1);
  const read = run ? readRun(task, run) : null;
  const text = await standing(task, { name: read?.name || 'the agent', stopped: read?.conv?.stopped ?? null });
  return `${text.length > GIST ? `${text.slice(0, GIST)}\n… (the rest in task_history)` : text}\n\nThe rest of the task's history: the kulisa task_history tool.`;
}

export { historyPart, gist };
