// Local Git review contracts (README.md).
import type { Result } from '../shared/result.ts';
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
export interface ChangeSelection { folder: string; path: string; options: ChangeOptions; filter?: string; navigation?: number }
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
