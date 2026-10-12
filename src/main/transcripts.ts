// Agents' transcripts read as the task's history (task_history): a reader per CLI (each in its agent's file,
// agents/), the same entries out of each.
// The formats are the agents' own and undocumented; which fields are kept and why:
// docs/transcripts.md. A record of a kind a reader does not know is skipped, so a new kind in a new version loses nothing else.
import fs from 'fs';

// What the next agent reads: the human's words, the agent's answers and actions, their results, the agent's own
// summaries of what came before (a compaction's: a chapter starts there).
type Entry = { kind: 'human' | 'agent' | 'call' | 'result' | 'error' | 'summary'; text: string };
interface Conversation { entries: Entry[]; plan: string | null; stopped: string | null; memory: string | null }

// A tool's output past this is cut to its start and end; an error stays whole. One constant, to tune on real handoffs.
const CUT = 2048;
const cut = (s: string) => (s.length <= 2 * CUT ? s : `${s.slice(0, CUT)}\n… [${s.length - 2 * CUT} characters cut] …\n${s.slice(-CUT)}`);
// task_history's own calls and results are not history: what they returned is in the runs already.
const ownTool = (name: string) => /(^|__)task_history$/.test(name);
const lines = (file: string) => fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => {
  if (!l) return [];
  try { return [JSON.parse(l)]; } catch { return []; }
});

export { CUT, cut, ownTool, lines };
export type { Entry, Conversation };
