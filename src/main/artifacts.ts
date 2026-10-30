// The task's environment artifacts: numbered files under a size limit (docs/tasks.md, The Resources panel).
import fs from 'fs';
import type { ArtifactSource } from '../shared/types.ts';
import path from 'path';
import { folderUsage } from '../activity-monitor/main/index.ts';

const LIMIT = 100 * 1024 * 1024;
const next = new Map<string, number>(); // by folder: the next number
const numberOf = (file: string) => Number(/^(\d+)-/.exec(file)?.[1] ?? 0);

// Its path, <n>-<name>. The number is taken before any await: tools writing at once (also) get each its own.
async function saveArtifact(dir: string, name: string, content: string | Buffer, limit = LIMIT) {
  const n = next.get(dir) ?? Math.max(0, ...(fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(numberOf)) + 1;
  next.set(dir, n + 1);
  const file = path.join(dir, `${n}-${name}`);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(file, content);
  await prune(dir, limit, path.basename(file));
  return file;
}

// The oldest go to keep the folder within the limit; the one just written stays.
async function prune(dir: string, limit: number, keep: string) {
  let { bytes: total, entries } = await folderUsage(dir);
  for (const x of entries.sort((a, b) => numberOf(a.name) - numberOf(b.name))) {
    if (total <= limit || x.name === keep) break;
    await fs.promises.rm(path.join(dir, x.name), { force: true });
    total -= x.bytes;
  }
}

// The folder's files, the newest first: whose and what each is from its name (saveArtifact's
// <n>-<profile>-<tab>-<kind>.<ext>, or <n>-application-<id>-terminal.txt), when and its size from the file.
async function listArtifacts(dir: string) {
  return (await folderUsage(dir)).entries.flatMap((e) => {
    const m = /^\d+-([^-]+)-([^-]+)-(\w+)\.\w+$/.exec(e.name);
    if (!m) return [];
    const source: ArtifactSource = m[1] === 'application' && m[3] === 'terminal'
      ? { kind: 'application', id: Number(m[2]) } : { kind: 'profile', id: m[1]!, tab: m[2]! };
    return [{ file: path.join(dir, e.name), source, kind: m[3]!, time: e.time, bytes: e.bytes }];
  }).sort((a, b) => numberOf(path.basename(b.file)) - numberOf(path.basename(a.file)));
}

export { saveArtifact, listArtifacts, LIMIT as ARTIFACTS_LIMIT };
