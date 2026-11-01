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
export interface Diffs {
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
  from: string;
  to: string;
  path: string;
  previousPath?: string;
  original: string;
  modified: string;
  notice?: string;
}
interface ReviewFile { version?: string; addition?: string; notice?: string; deferred?: string }
export interface Review extends Diffs { patch: string; diffs: { path: string; result: Result<ReviewFile> }[] }
