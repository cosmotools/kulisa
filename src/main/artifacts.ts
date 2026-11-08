// Task-owned files and directories. The filesystem is authoritative (docs/tasks.md, Artifacts and temporary files).
import fs from 'node:fs';
import path from 'node:path';
import { removeTree } from './remove.ts';
import type { Artifact } from '../shared/types.ts';

type FileEntry = Omit<Artifact, 'thumb'>;
const numberOf = (file: string) => Number(/^(\d+)-/.exec(file)?.[1] ?? 0);

// Reject links at every component, including the root: actions must never reach another task or user folder.
async function ownedPath(root: string, file: string) {
  const relative = path.relative(root, path.resolve(file));
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) return false;
  let current = root;
  for (const part of ['', ...relative.split(path.sep).filter(Boolean)]) {
    current = path.join(current, part);
    const stat = await fs.promises.lstat(current).catch((): null => null);
    if (!stat || stat.isSymbolicLink()) return false;
  }
  return true;
}

// Exclusive creation also protects against another process or agent writing the same generated filename.
async function saveArtifact(dir: string, name: string, content: string | Buffer) {
  await fs.promises.mkdir(dir, { recursive: true });
  if (!await ownedPath(dir, dir)) throw new Error('The task file folder must not be a symbolic link.');
  if (path.basename(name) !== name || /[\\/]/.test(name)) throw new Error('Expected a filename.');
  let n = (await fs.promises.readdir(dir)).reduce((max, file) => Math.max(max, numberOf(file)), 0) + 1;
  for (;;) {
    const file = path.join(dir, `${n++}-${name}`);
    let handle: fs.promises.FileHandle;
    try { handle = await fs.promises.open(file, 'wx'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue; throw error; }
    try { await handle.writeFile(content); return file; }
    catch (error) { await handle.close(); await fs.promises.unlink(file).catch(() => {}); throw error; }
    finally { await handle.close(); }
  }
}

async function listArtifacts(dir: string): Promise<FileEntry[]> {
  if (!await ownedPath(dir, dir)) return [];
  const result: FileEntry[] = [];
  const visit = async (folder: string) => {
    const names = await fs.promises.readdir(folder).catch((): string[] => []);
    names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const name of names) {
      const file = path.join(folder, name);
      if (!await ownedPath(dir, file)) continue;
      const stat = await fs.promises.lstat(file).catch((): null => null);
      if (!stat || (!stat.isFile() && !stat.isDirectory())) continue;
      const directory = stat.isDirectory();
      // Legacy tool names preserve provenance; ordinary user filenames need no registration or sidecar.
      const m = !directory && /^\d+-([^-]+)-([^-]+)-(screenshot|snapshot|request|response|terminal)\.\w+$/.exec(name);
      const source = m ? ((m[1] === 'application' || m[1] === 'terminal') && m[3] === 'terminal'
        ? { kind: 'stage-terminal' as const, id: Number(m[2]) }
        : { kind: 'profile' as const, id: m[1]!, tab: m[2]! }) : undefined;
      result.push({ file, path: path.relative(dir, file).split(path.sep).join('/') + (directory ? '/' : ''),
        directory, ...(source && { source }), kind: directory ? 'folder' : m ? m[3]! : 'file',
        bytes: directory ? 0 : stat.size, time: stat.mtimeMs, revision: `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}` });
      if (directory) await visit(file);
    }
  };
  await visit(dir);
  return result;
}

async function deleteFiles(dir: string, files: string[] | null) {
  const list = await listArtifacts(dir);
  const paths = files?.map((file) => path.resolve(file));
  if (paths?.some((file) => !list.some((entry) => entry.file === file))) return { error: 'not an artifact of this task' };
  // Removing a parent already removes its children; never count or delete those twice.
  const requested = paths && new Set(paths);
  const chosen = list.filter((entry) => !requested || requested.has(entry.file));
  const directories = new Set(chosen.filter((entry) => entry.directory).map((entry) => entry.file));
  const roots = chosen.filter((entry) => {
    for (let parent = path.dirname(entry.file); parent !== dir && parent !== path.dirname(parent); parent = path.dirname(parent)) {
      if (directories.has(parent)) return false;
    }
    return true;
  });
  let deleted = 0, bytes = 0;
  for (const entry of roots) {
    if (!await ownedPath(dir, entry.file)) return { error: 'The task file changed while deleting it.' };
    const descendants = entry.directory ? list.filter((a) => a.file === entry.file || a.file.startsWith(entry.file + path.sep)) : [entry];
    removeTree(entry.file);
    deleted += descendants.length; bytes += descendants.reduce((sum, a) => sum + a.bytes, 0);
  }
  return { deleted, bytes };
}

export { saveArtifact, listArtifacts, deleteFiles, ownedPath };
