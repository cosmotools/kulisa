// Reading and rewriting the agents' own files (their configs, transcripts, histories): undocumented formats, so what
// cannot be read is left as it is.
import fs from 'fs';
import path from 'path';
import { writeFileAtomic } from '../../../main/store.ts';
import { removeTree } from '../../../main/remove.ts';

const readJSON = (file: string) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

// The first lines of a transcript (JSONL, its first 64 KB), parsed; one that is not JSON is null.
function headLines(file: string) {
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(65536);
    const head = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, 0));
    fs.closeSync(fd);
    return head.split('\n').map((line) => { try { return JSON.parse(line); } catch { return null; } });
  } catch { return []; }
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

// Kulisa's shared skill (resources/skills/kulisa/, one text for every agent) written into an agent's config folder,
// where it reads its own skills (an entry's skills): at each start, so it follows Kulisa's version, and only when it
// changed; it goes with the account. Under a name of Kulisa's (kulisa), apart from the human's own skills.
function installSkill(packages: string, folder: string) {
  const text = fs.readFileSync(path.join(packages, 'skills', 'kulisa', 'SKILL.md'), 'utf8');
  writeChanged(path.join(folder, 'kulisa', 'SKILL.md'), text);
  // Keep one instruction source in Kulisa-owned agent accounts.
  removeTree(path.join(folder, 'kulisa-profiles'));
}
// A file of Kulisa's in an agent's folder, written whole only when its text changed (an agent may be reading it).
function writeChanged(file: string, text: string) {
  let now: string | null = null;
  try { now = fs.readFileSync(file, 'utf8'); } catch {}
  if (now === text) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, text);
}

export { readJSON, headLines, rewriteLines, installSkill, writeChanged };
