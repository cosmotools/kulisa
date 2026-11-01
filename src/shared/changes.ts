// Local code review contracts (docs/tasks.md, Changes).
import type { Result } from './result.ts';
export interface ChangeOptions { to?: string }
export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: string;
  additions: number | null;
  deletions: number | null;
  deferred?: string;
  untracked?: boolean;
}
export interface Changes {
  git: boolean;
  revision: string | null;
  from: string;
  to: string;
  branch: string | null;
  branches: string[];
  files: ChangedFile[];
}
export interface ChangeSelection { task: string; folder: string; path: string; options: ChangeOptions; filter?: string; navigation?: number }
export interface FileDiff {
  from: string;
  to: string;
  path: string;
  previousPath?: string;
  original: string;
  modified: string;
  notice?: string;
}
interface ReviewFile { version?: string; addition?: string; notice?: string; deferred?: string }
export interface Review extends Changes { patch: string; diffs: { path: string; result: Result<ReviewFile> }[] }

export function compareChangePaths(a: string, b: string): number {
  const left = a.split('/'), right = b.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] === right[i]) continue;
    return Number(i < right.length - 1) - Number(i < left.length - 1) || left[i]!.localeCompare(right[i]!);
  }
  return left.length - right.length;
}
