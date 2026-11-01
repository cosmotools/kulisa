// The caller owns resource access, selection persistence and window menus (../README.md).
import type { Result } from '../../shared/result';
import type { DiffOptions, DiffSelection, Diffs, FileDiff, Review } from '../ipc';

export interface DiffsActions {
  list(folder: string, options: DiffOptions): Promise<Result<Diffs>>;
  targets(folder: string): Promise<Result<{ branches: string[] }>>;
  review(folder: string, options: DiffOptions, load: string[]): Promise<Result<Review>>;
  contents(folder: string, path: string, options: DiffOptions): Promise<Result<FileDiff>>;
  select(selection: DiffSelection): void;
  selectFile(path: string, navigation: number | undefined): void;
  showMenu(event: MouseEvent, rows: { label: string; run: () => unknown }[]): void;
}
