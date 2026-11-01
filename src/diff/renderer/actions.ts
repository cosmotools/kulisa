// The caller owns resource access, selection persistence and window menus (../README.md).
import type { Result } from '../../shared/result';
import type { DiffOptions, DiffSelection, Diff, FileDiff, Review } from '../ipc';

export interface DiffActions {
  list(folder: string, options: DiffOptions): Promise<Result<Diff>>;
  targets(folder: string): Promise<Result<{ branches: string[] }>>;
  review(folder: string, options: DiffOptions, load: string[], onSummary: (summary: Diff) => void): Promise<Result<Review>>;
  contents(folder: string, path: string, options: DiffOptions): Promise<Result<FileDiff>>;
  select(selection: DiffSelection): void;
  selectFile(path: string, navigation: number | undefined): void;
  showMenu(point: { clientX: number; clientY: number }, rows: { label: string; run: () => unknown }[]): void;
}
