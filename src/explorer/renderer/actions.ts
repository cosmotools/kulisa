// The caller supplies filesystem and desktop access without coupling the tree to a task or window.
import type { Result } from '../../shared/result';
import type { ExplorerFile } from '../ipc';

export interface ExplorerActions {
  readFolder(folder: string): Promise<Result<{ entries: ExplorerFile[] }>>;
  openFile(file: string): Promise<Result>;
  showFile(file: string): unknown;
  showMenu(event: MouseEvent, rows: { label: string; run: () => unknown }[]): void;
}
