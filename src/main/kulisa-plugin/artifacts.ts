// What the agent's tools keep of the pages (snapshots, bodies, screenshots): files in the task's artifacts folder
// (TaskStore.artifacts), each its own, numbered in the order made, so one never replaces another (two snapshots to
// compare). The oldest go past a limit. How a tool is designed: CLAUDE.md here.
import fs from 'fs';
import path from 'path';

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

// The oldest removed until the folder is within the limit; the one just written stays.
async function prune(dir: string, limit: number, keep: string) {
  const files = await Promise.all((await fs.promises.readdir(dir)).map(async (f) => ({ f, size: (await fs.promises.stat(path.join(dir, f))).size })));
  let total = files.reduce((sum, x) => sum + x.size, 0);
  for (const x of files.sort((a, b) => numberOf(a.f) - numberOf(b.f))) {
    if (total <= limit || x.f === keep) break;
    await fs.promises.rm(path.join(dir, x.f), { force: true });
    total -= x.size;
  }
}

// The folder's files, the newest first: whose and what each is from its name (saveArtifact's
// <n>-<profile>-<tab>-<kind>.<ext>), when from its time.
async function listArtifacts(dir: string) {
  const files = await fs.promises.readdir(dir).catch((): string[] => []);
  const all = await Promise.all(files.map(async (f) => {
    const m = /^\d+-([^-]+)-[^-]+-(\w+)\.\w+$/.exec(f), s = await fs.promises.stat(path.join(dir, f)).catch((): null => null);
    return m && s ? { file: path.join(dir, f), profile: m[1]!, kind: m[2]!, time: s.mtimeMs } : null;
  }));
  return all.filter((a) => a !== null).sort((a, b) => numberOf(path.basename(b.file)) - numberOf(path.basename(a.file)));
}

export { saveArtifact, listArtifacts };
