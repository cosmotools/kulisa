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

// The records of a transcript's last bytes, read without blocking: what an agent appends as it goes (its title) is
// there, and a transcript runs to hundreds of MB, too much to read whole at every turn's end. The first line, cut, is
// dropped.
async function tailLines(file: string, bytes: number) {
  const fh = await fs.promises.open(file, 'r');
  try {
    const { size } = await fh.stat();
    const start = Math.max(0, size - bytes), buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    return (start ? text.slice(text.indexOf('\n') + 1) : text).split('\n').flatMap((l) => {
      if (!l) return [];
      try { return [JSON.parse(l)]; } catch { return []; }
    });
  } finally { await fh.close(); }
}

export { CUT, cut, ownTool, lines, tailLines };
export type { Entry, Conversation };
