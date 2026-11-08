// The caller supplies filesystem and desktop access without coupling the tree to a task or window.
import type { Result } from '../../shared/result.ts';
import type { ProjectFile, ProjectGitStatus } from '../ipc.ts';

export interface ExplorerActions {
  readFolder(folder: string): Promise<Result<{ entries: ProjectFile[] }>>;
  readGitStatus(folder: string): Promise<Result<{ entries: ProjectGitStatus[] }>>;
  openFolder(folder: string): unknown;
  folderMenu(folder: string): { label: string; run: () => unknown }[];
  openFile(file: string): Promise<Result>;
  openExternal?(file: string): unknown;
  showFile(file: string): unknown;
  showMenu(event: Pick<MouseEvent, 'clientX' | 'clientY'>, rows: { label: string; run: () => unknown }[]): void;
}
