// The caller owns resource access, selection persistence and window menus (../README.md).
import type { Result } from '../../shared/result';
import type { ChangeOptions, ChangeSelection, Changes, FileDiff, Review } from '../ipc';

export interface ChangesActions {
  list(folder: string, options: ChangeOptions): Promise<Result<Changes>>;
  targets(folder: string): Promise<Result<{ branches: string[] }>>;
  review(folder: string, options: ChangeOptions, load: string[]): Promise<Result<Review>>;
  contents(folder: string, path: string, options: ChangeOptions): Promise<Result<FileDiff>>;
  select(selection: ChangeSelection): void;
  selectFile(path: string, navigation: number | undefined): void;
  showMenu(event: MouseEvent, rows: { label: string; run: () => unknown }[]): void;
}
