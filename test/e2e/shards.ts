// A CI shard's files (KULISA_SHARD=i/n; docs/testing.md, Speed), split by their times rather than by their tests'
// number, as Playwright's --shard does: one file of slow tests outweighs ten quick ones. Each file goes, slowest first,
// to the shard with the least time so far (timings.json: seconds per file, the slowest OS's; a file not in it counts
// as the mean, so a new one runs too, in some shard).
import fs from 'fs';
import path from 'path';
import timings from './timings.json' with { type: 'json' };

export function shardFiles(shard: string): string[] {
  const [i, n] = shard.split('/').map(Number);
  const files = fs.readdirSync(import.meta.dirname).filter((f) => f.endsWith('.spec.ts')).sort();
  const known: Record<string, number> = timings;
  const mean = Object.values(known).reduce((a, b) => a + b, 0) / Object.keys(known).length;
  const time = (f: string) => known[f] ?? mean;
  const shards = Array.from({ length: n }, () => ({ time: 0, files: [] as string[] }));
  for (const f of [...files].sort((a, b) => time(b) - time(a) || a.localeCompare(b))) {
    const s = shards.reduce((a, b) => (b.time < a.time ? b : a));
    s.time += time(f);
    s.files.push(f);
  }
  return shards[i - 1].files.map((f) => path.join(import.meta.dirname, f));
}
