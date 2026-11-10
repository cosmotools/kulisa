// Working-tree status for Project, independent of Diff comparisons (../README.md).
import type { Result } from '../../shared/result.ts';
import type { ProjectGitStatus } from '../ipc.ts';

type Git = (folder: string, args: string[], options?: { trim?: boolean; timeout?: number; maxBuffer?: number }) => Promise<string>;

export async function listResourceGitStatus(folder: string, git: Git): Promise<Result<{ entries: ProjectGitStatus[] }>> {
  // Porcelain paths are repository-relative, including when the resource is a subfolder.
  const prefix = await git(folder, ['rev-parse', '--show-prefix'], { trim: false }).catch((): null => null);
  if (prefix === null) return { entries: [] };
  try {
    const output = await git(folder, ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching', '--', '.'],
      { trim: false, timeout: 10000, maxBuffer: 8 << 20 });
    const sub = prefix.replace(/\r?\n$/, ''), records = output.split('\0'), entries: ProjectGitStatus[] = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      if (!record) continue;
      const code = record.slice(0, 2), name = record.slice(3);
      // NUL output puts a rename's destination first, then its previous path.
      const previous = code.includes('R') || code.includes('C') ? records[++i] : undefined;
      const status = code === '!!' ? 'ignored' : code === '??' ? 'untracked'
        : code.includes('U') || code === 'AA' || code === 'DD' ? 'modified' : code.includes('D') ? 'deleted'
          : code.includes('R') ? 'renamed' : code.includes('A') || code.includes('C') ? 'added' : 'modified';
      if (name.startsWith(sub)) entries.push({ path: name.slice(sub.length), status });
      else if (code.includes('R') && previous?.startsWith(sub)) entries.push({ path: previous.slice(sub.length), status: 'deleted' });
      else if (status === 'ignored' && name.endsWith('/') && sub.startsWith(name)) entries.push({ path: '', status });
    }
    return { entries };
  } catch (error) { return { error: (error as Error).message }; }
}
