// Read-only local Git comparisons (../README.md).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { git, gitBuffer } from '../../main/worktrees.ts';
import type { DiffFile, DiffOptions, Diff, FileDiff, Review } from '../ipc.ts';
import { refused, type Result } from '../../shared/result.ts';

const limit = 2 << 20;
const automaticLimit = 128 << 10, automaticLines = 2000;
const largeDiff = 'This file is large. Load its diff when you need it.';
const plain = ['--no-ext-diff', '--no-textconv', '--no-color', '--find-renames', '--relative', '-z'];
const errorText = (e: unknown) => (e as Error).message;
function countLines(text: string) {
  let lines = Number(!!text && !text.endsWith('\n'));
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) lines++;
  return lines;
}
function decode(buffer: Buffer): { text: string; notice?: string } {
  try {
    if (buffer.includes(0)) throw new Error('binary');
    return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer) };
  } catch { return { text: '', notice: 'Binary or non-UTF-8 file. Text comparison is unavailable.' }; }
}

async function comparison(folder: string, options: DiffOptions, start?: string | null) {
  const [listing, branch, head] = await Promise.all([
    git(folder, ['for-each-ref', '--format=%(refname:short)%00%(objectname)%00%(symref:short)', ...(options.to ? [`refs/heads/${options.to}`, `refs/remotes/${options.to}`] : ['refs/remotes/origin/HEAD', 'refs/remotes/origin/main', 'refs/remotes/origin/master', 'refs/heads/main', 'refs/heads/master'])], { maxBuffer: 8 << 20 }).catch((): null => null),
    git(folder, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch((): null => null),
    git(folder, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']).catch((): null => null),
  ]);
  if (listing === null) return null;
  const records = listing.split('\n').filter(Boolean).map((line) => line.split('\0'));
  const refs = new Map(records.filter(([name]) => !name!.endsWith('/HEAD')).map(([name, commit]) => [name!, commit!]));
  const remote = records.find(([name]) => name === 'origin/HEAD')?.[2] ?? '';
  if (remote) refs.set(remote, records.find(([name]) => name === 'origin/HEAD')![1]!);
  const branches = [...refs.keys(), ...(head ? ['HEAD'] : [])];
  const defaultBranch = [remote, 'origin/main', 'origin/master', 'main', 'master'].find((name) => branches.includes(name));
  const to = options.to ?? defaultBranch ?? (start ? 'Task start' : head ? 'HEAD' : 'Empty tree');
  const targets = [...new Set([...branches, ...(start ? ['Task start'] : []), ...(!head ? ['Empty tree'] : [])])];
  if (!targets.includes(to)) throw new Error('The To branch is unavailable. Choose another branch.');
  const target = to === 'Task start' ? start! : to === 'Empty tree' ? null : to === 'HEAD' ? head : refs.get(to)!;
  const revision = target && head && target !== head ? await git(folder, ['merge-base', head, target]) : target;
  const from = `${branch ?? 'detached HEAD'} (worktree)`;
  return { branch, branches: targets, from, to, revision };
}

// Git's NUL records preserve tabs, newlines and rename pairs in file names.
function parseDiff(output: string): DiffFile[] {
  const parts = output.split('\0'), files = new Map<string, DiffFile>();
  let i = 0;
  while (parts[i]?.startsWith(':')) {
    const status = parts[i++]!.split(' ').at(-1)!.slice(0, 1);
    const old = parts[i++]!, name = status === 'R' || status === 'C' ? parts[i++]! : old;
    files.set(name, { path: name, ...(old !== name && { previousPath: old }), status, additions: null, deletions: null });
  }
  for (; i < parts.length && parts[i]; i++) {
    const record = parts[i]!, first = record.indexOf('\t'), second = record.indexOf('\t', first + 1);
    let name = record.slice(second + 1);
    if (!name) { i++; name = parts[++i]!; }
    const file = files.get(name);
    if (file) {
      const add = record.slice(0, first), remove = record.slice(first + 1, second);
      file.additions = add === '-' ? null : Number(add);
      file.deletions = remove === '-' ? null : Number(remove);
    }
  }
  return [...files.values()];
}

function validatePath(file: string) {
  if (!file || file.includes('\0') || file.split(/[\\/]/).some((part) => part === '..' || part.toLowerCase() === '.git') || path.isAbsolute(file)) throw new Error('Invalid file path.');
}
async function confinedPath(folder: string, file: string) {
  validatePath(file);
  const root = await fs.realpath(folder), full = path.resolve(root, file);
  const parent = await fs.realpath(path.dirname(full));
  const relative = path.relative(root, parent);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('The file is outside this resource folder.');
  return full;
}
async function workingText(folder: string, file: string, maxBytes = limit): Promise<Text> {
  const full = await confinedPath(folder, file);
  const stat = await fs.lstat(full);
  if (stat.isSymbolicLink()) return { text: await fs.readlink(full) };
  if (!stat.isFile()) return { text: '', notice: 'This entry is not a text file.' };
  if (stat.size > limit) return { text: '', notice: 'File exceeds the 2 MiB text comparison limit.' };
  if (stat.size > maxBytes) return { text: '', deferred: largeDiff };
  const handle = await fs.open(full, 'r');
  try {
    const buffer = Buffer.allocUnsafe(Math.min(limit + 1, stat.size + 1));
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > limit) return { text: '', notice: 'File exceeds the 2 MiB text comparison limit.' };
    if (size === buffer.length) throw new Error('The file changed while being read. Refreshing will try again.');
    return decode(buffer.subarray(0, size));
  } finally { await handle.close(); }
}

async function changedFiles(folder: string, revision: string | null, wanted?: Set<string>) {
  const [diffs, others] = await Promise.all([
    revision ? git(folder, ['diff', '--raw', '--numstat', ...plain, revision, '--', '.'], { trim: false, maxBuffer: 8 << 20 }) : '',
    git(folder, ['ls-files', '-z', '--others', '--exclude-standard', ...(!revision ? ['--cached'] : []), '--', '.'], { trim: false, maxBuffer: 8 << 20 }),
  ]);
  const tracked = parseDiff(diffs);
  const files = wanted ? tracked.filter((f) => wanted.has(f.path)) : tracked;
  const untracked = others.split('\0').filter(Boolean);
  const additions = [...new Set(untracked)].filter((file) => !wanted || wanted.has(file));
  for (let i = 0; i < additions.length; i += 4) {
    files.push(...await Promise.all(additions.slice(i, i + 4).map(async (file): Promise<DiffFile> => {
      const content: Text = await workingText(folder, file, automaticLimit).catch(() => ({ text: '', notice: 'File unavailable' }));
      return { path: file, status: 'A', untracked: true, additions: content.notice || content.deferred ? null : countLines(content.text), deletions: content.notice ? null : 0,
        ...(content.deferred && { deferred: content.deferred }) };
    })));
  }
  return files.sort((a, b) => compareDiffPaths(a.path, b.path));
}

export async function listDiff(folder: string, options: DiffOptions, start?: string | null): Promise<Result<Diff>> {
  try {
    const c = await comparison(folder, options, start);
    if (!c) return { git: false, revision: null, from: '', to: '', branch: null, branches: [], files: [] };
    const files = await changedFiles(folder, c.revision);
    return { git: true, revision: c.revision, from: c.from, to: c.to, branch: c.branch, branches: c.branches, files };
  } catch (e) { return { error: errorText(e) }; }
}

type Text = { text: string; notice?: string; deferred?: string };
async function committedText(folder: string, revision: string, file: string): Promise<Text> {
  const listing = await git(folder, ['--literal-pathspecs', 'ls-tree', '-lz', revision, '--', file], { trim: false, maxBuffer: 8 << 20 });
  const record = listing.split('\0').find((record) => record.slice(record.indexOf('\t') + 1) === file);
  if (!record) throw new Error('The committed file is unavailable. Refreshing will try again.');
  const [, type, id, size] = record.slice(0, record.indexOf('\t')).trim().split(/\s+/);
  if (type !== 'blob') return { text: '', notice: 'This entry is not a text file.' };
  if (Number(size) > limit) return { text: '', notice: 'File exceeds the 2 MiB text comparison limit.' };
  return decode(await gitBuffer(folder, ['cat-file', 'blob', id!], { maxBuffer: limit }));
}

export async function listDiffTargets(folder: string, start?: string | null): Promise<Result<{ branches: string[] }>> {
  try {
    const refs = await git(folder, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes']);
    const head = await git(folder, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']).catch((): null => null);
    return { branches: [...refs.split('\n').filter((name) => name && !name.endsWith('/HEAD')), ...(head ? ['HEAD'] : ['Empty tree']), ...(start ? ['Task start'] : [])] };
  } catch (e) { return { error: errorText(e) }; }
}

// One bounded review snapshot; files outside the automatic allowance have an explicit load action.
export async function loadReview(folder: string, options: DiffOptions, start?: string | null, load: string[] = []): Promise<Result<Review>> {
  try {
    if (load.length > 4) return { error: 'Load at most four large diffs at once.' };
    const summary = await listDiff(folder, options, start);
    if (refused(summary)) return summary;
    const files = summary.files.filter((file) => load.includes(file.path));
    let lines = 0;
    for (const file of summary.files) {
      if (files.includes(file) || files.length >= 32) continue;
      const count = (file.additions ?? 0) + (file.deletions ?? 0);
      if (file.deferred || count > automaticLines || lines + count > 8000) continue;
      lines += count; files.push(file);
    }
    const revision = summary.revision;
    const forced = new Set(load), sizes = new Map<string, number>();
    const originals = files.filter((f) => !f.untracked && f.status !== 'A').map((f) => f.previousPath ?? f.path);
    if (revision && originals.length) {
      const listing = await git(folder, ['--literal-pathspecs', 'ls-tree', '-rlz', revision, '--', ...originals], { trim: false, maxBuffer: 8 << 20 });
      for (const record of listing.split('\0').filter(Boolean)) {
        const tab = record.indexOf('\t'), [, type, , size] = record.slice(0, tab).trim().split(/\s+/);
        sizes.set(record.slice(tab + 1), type === 'blob' ? Number(size) : Infinity);
      }
    }
    const diffs: Review['diffs'] = [], tracked: string[] = [];
    for (let i = 0; i < files.length; i += 4) diffs.push(...await Promise.all(files.slice(i, i + 4).map(async (entry) => {
      try {
        if (entry.untracked || !revision) {
          const text = await workingText(folder, entry.path, forced.has(entry.path) ? limit : automaticLimit);
          if (text.notice || text.deferred) return { path: entry.path, result: { notice: text.notice, deferred: text.deferred } };
          return { path: entry.path, result: { version: createHash('sha256').update('A\0').update(text.text).digest('hex'), addition: text.text } };
        }
        const stat = entry.status === 'D' ? null : await fs.lstat(await confinedPath(folder, entry.path));
        const originalSize = sizes.get(entry.previousPath ?? entry.path) ?? 0;
        const size = Math.max(originalSize, stat?.size ?? 0);
        if (size > limit || (stat && !stat.isFile() && !stat.isSymbolicLink())) return { path: entry.path, result: { notice: 'File exceeds the text comparison limit or is not a text file.' } };
        if (!forced.has(entry.path) && (size > automaticLimit || (entry.additions ?? 0) + (entry.deletions ?? 0) > automaticLines || entry.deferred)) {
          return { path: entry.path, result: { deferred: largeDiff } };
        }
        if (entry.additions === null || entry.deletions === null) return { path: entry.path, result: { notice: 'Binary file. Text comparison is unavailable.' } };
        tracked.push(entry.path, ...(entry.previousPath ? [entry.previousPath] : []));
        return { path: entry.path, result: {} };
      } catch (e) { return { path: entry.path, result: { error: errorText(e) } }; }
    })));
    const output = tracked.length ? await gitBuffer(folder, ['--literal-pathspecs', '-c', 'core.quotePath=true', 'diff', ...plain, '--raw', '--patch', '--unified=3',
      '--src-prefix=a/', '--dst-prefix=b/', revision!, '--', ...new Set(tracked)], { maxBuffer: 24 << 20 }) : Buffer.alloc(0);
    const separator = output.indexOf(Buffer.from([0, 0]));
    if (output.length && separator < 0) throw new Error('Git returned an incomplete patch batch.');
    if (separator >= 0) {
      const changed = parseDiff(output.subarray(0, separator + 1).toString('utf8'));
      const boundary = Buffer.from('\ndiff --git '), chunks: Buffer[] = [];
      let offset = separator + 2, next: number;
      while ((next = output.indexOf(boundary, offset)) !== -1) { chunks.push(output.subarray(offset, next + 1)); offset = next + 1; }
      chunks.push(output.subarray(offset));
      if (chunks.length !== changed.length) throw new Error('Git returned an incomplete patch batch.');
      for (const [i, file] of changed.entries()) {
        const diff = diffs.find((d) => d.path === file.path);
        if (!diff) continue;
        const chunk = chunks[i]!, decoded = decode(chunk);
        diff.result = decoded.notice ? { notice: decoded.notice } : { version: createHash('sha256').update(chunk).digest('hex'), patch: decoded.text };
      }
    }
    for (const diff of diffs) if (tracked.includes(diff.path) && !Object.keys(diff.result).length) {
      diff.result = { notice: 'The file changed while loading. Refreshing will try again.' };
    }
    const byPath = new Map(diffs.map((diff) => [diff.path, diff]));
    return { ...summary, diffs: summary.files.map((file) => byPath.get(file.path)
      ?? { path: file.path, result: { deferred: largeDiff } }) };
  } catch (e) { return { error: errorText(e) }; }
}

export async function readDiff(folder: string, file: string, options: DiffOptions, start?: string | null): Promise<Result<FileDiff>> {
  try {
    const c = await comparison(folder, options, start);
    if (!c) return { error: 'This folder is not a Git repository.' };
    const entry = (await changedFiles(folder, c.revision, new Set([file]))).find((f) => f.path === file);
    if (!entry) return { error: 'This file has no changes in the selected comparison.' };
    const original = c.revision && entry.status !== 'A' ? await committedText(folder, c.revision, entry.previousPath ?? file) : { text: '' };
    const current = entry.status === 'D' ? { text: '' } : await workingText(folder, file);
    const notice = original.notice ?? current.notice;
    return { from: c.from, to: c.to, path: file, previousPath: entry.previousPath,
      original: notice ? '' : original.text, modified: notice ? '' : current.text, ...(notice && { notice }) };
  } catch (e) { return { error: errorText(e) }; }
}

function compareDiffPaths(a: string, b: string): number {
  const left = a.split('/'), right = b.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] === right[i]) continue;
    return Number(i < right.length - 1) - Number(i < left.length - 1) || left[i]!.localeCompare(right[i]!);
  }
  return left.length - right.length;
}
