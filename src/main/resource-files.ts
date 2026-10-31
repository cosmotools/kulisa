// Directory reads stay within a task's resource roots (docs/tasks.md, The Resources panel).
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../shared/result.ts';
import type { ProjectFile } from '../shared/types.ts';
import { refused } from '../shared/result.ts';

export async function resourcePath(roots: string[], file: string): Promise<Result<{ path: string }>> {
  try {
    const target = await fs.realpath(file);
    for (const root of roots) {
      const relative = path.relative(await fs.realpath(root), target);
      if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) return { path: target };
    }
    return { error: 'This path is outside the task’s folders.' };
  } catch (error) { return { error: (error as Error).message }; }
}

export async function listResourceFiles(roots: string[], folder: string): Promise<Result<{ entries: ProjectFile[] }>> {
  const found = await resourcePath(roots, folder);
  if (refused(found)) return found;
  try {
    const children = await fs.readdir(found.path, { withFileTypes: true });
    const entries = children.map((entry) => ({ name: entry.name, path: path.join(folder, entry.name), directory: entry.isDirectory() }));
    entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true }));
    return { entries };
  } catch (error) { return { error: (error as Error).message }; }
}
