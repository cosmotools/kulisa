// The project's file's main process half, its entry (../README.md): .kulisa/project.json in a repository, read and
// written. Plain Node: unit-tested.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Os } from '../../shared/types.ts';

// A role kept in the file: no account (each computer's own), its agent by its entry's id (agents/: claude, codex).
interface FileRole { id: string; agent: string; name?: string; about?: string; model?: string; os?: Os; default?: boolean }
const OSES: Os[] = ['linux', 'macos', 'windows'];

const fileOf = (repo: string) => path.join(repo, '.kulisa', 'project.json');
// Read once per change of the file (its time and size): the team is asked for on every draw of the window.
const cache = new Map<string, { stamp: string; data: Record<string, unknown> | null }>();

// The file's content; null: none, or not JSON (then nothing is written over it: it may be the human's, half edited).
function read(repo: string): Record<string, unknown> | null {
  const file = fileOf(repo);
  let stamp: string;
  try { const s = fs.statSync(file); stamp = `${s.mtimeMs}:${s.size}`; } catch { cache.delete(file); return null; }
  const had = cache.get(file);
  if (had?.stamp === stamp) return had.data;
  let data: Record<string, unknown> | null = null;
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object' && !Array.isArray(j)) data = j; } catch {}
  cache.set(file, { stamp, data });
  return data;
}
const exists = (repo: string) => fs.existsSync(fileOf(repo));

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
// Its team: the roles a file holds, each checked (one without an id or an agent left out: a hand edit gone wrong).
function teamIn(repo: string): FileRole[] {
  const t = read(repo)?.team;
  if (!Array.isArray(t)) return [];
  return t.flatMap((r: Record<string, unknown>) => {
    const id = str(r?.id, 40), agent = str(r?.agent, 40);
    if (!id || !agent) return [];
    const role: FileRole = { id, agent };
    const name = str(r.name, 40), about = str(r.about, 500), model = str(r.model, 100);
    if (name) role.name = name;
    if (about) role.about = about;
    if (model) role.model = model;
    if (OSES.includes(r.os as Os)) role.os = r.os as Os;
    if (r.default === true) role.default = true;
    return [role];
  });
}

// Its team written, the file's other sections and each role's fields Kulisa does not know kept as they were. Refused
// when the file is there but not JSON.
function writeTeam(repo: string, team: FileRole[]): { error?: string } {
  const file = fileOf(repo), had = read(repo);
  if (!had && exists(repo)) return { error: `${file} is not JSON: fix it or remove it first` };
  const old = new Map((Array.isArray(had?.team) ? had.team : []).map((r: Record<string, unknown>) => [r?.id, r]));
  const data = { ...had, team: team.map((r) => ({ ...(old.get(r.id) as object | undefined), ...r, ...(!r.default && { default: undefined }) })) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  cache.delete(file);
  return {};
}

// A new role's id in the file: not a number counted up, which two computers adding a role each would both take.
const newId = (taken: Set<string>) => { let id; do id = `r${crypto.randomBytes(3).toString('hex')}`; while (taken.has(id)); return id; };

export type { FileRole };
export { OSES, teamIn, writeTeam, exists as hasProjectFile, newId, fileOf as projectFile };
