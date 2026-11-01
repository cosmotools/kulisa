// Local Git review contracts (README.md).
import type { Result } from '../shared/result.ts';
export interface DiffOptions { to?: string }
export interface DiffFile {
  path: string;
  previousPath?: string;
  status: string;
  additions: number | null;
  deletions: number | null;
  deferred?: string;
  untracked?: boolean;
}
export interface Diff {
  git: boolean;
  revision: string | null;
  from: string;
  to: string;
  branch: string | null;
  branches: string[];
  files: DiffFile[];
}
export interface DiffSelection { folder: string; path: string; options: DiffOptions; filter?: string; navigation?: number }
export interface FileDiff {
  path: string;
  previousPath?: string;
  original: string;
  modified: string;
  notice?: string;
}
interface ReviewFile { version?: string; patch?: string; addition?: string; notice?: string; deferred?: string }
export interface Review extends Diff { diffs: { path: string; result: Result<ReviewFile> }[] }
