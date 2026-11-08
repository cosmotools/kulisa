// Foreground Git snapshots feed Trees' native status lane (../README.md).
import type { ProjectGitStatus } from '../ipc.ts';
import type { ExplorerActions } from './actions.ts';

interface Repository { folder: string; entries: ProjectGitStatus[]; error: string; pending: boolean; attempt: number }

export class GitStatuses {
  private roots = new Map<string, Repository>();
  private active = false;
  private disposed = false;
  private errors = '[]';
  private read: ExplorerActions['readGitStatus'];
  private changed: (entries: ProjectGitStatus[], errorsChanged: boolean) => void;

  constructor(read: ExplorerActions['readGitStatus'], changed: (entries: ProjectGitStatus[], errorsChanged: boolean) => void) {
    this.read = read; this.changed = changed;
  }

  setRoots(roots: ReadonlyMap<string, { folder: string }>) {
    for (const [path, value] of this.roots) if (roots.get(path)?.folder !== value.folder) this.roots.delete(path);
    for (const [path, root] of roots) if (!this.roots.has(path))
      this.roots.set(path, { folder: root.folder, entries: [], error: '', pending: false, attempt: 0 });
    this.publish(); this.refresh();
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) for (const value of this.roots.values()) value.attempt++;
    else this.refresh();
  }
  refresh() { for (const [path, value] of this.roots) if (!value.error) void this.load(path); }
  error(path: string) { return this.roots.get(path)?.error ?? ''; }
  retry(path: string) {
    const value = this.roots.get(path);
    if (value) { value.error = ''; void this.load(path); }
  }
  dispose() { this.disposed = true; this.roots.clear(); }

  private async load(path: string) {
    const value = this.roots.get(path);
    if (!this.active || this.disposed || !value || value.pending) return;
    const attempt = ++value.attempt;
    value.pending = true;
    try {
      const result = await this.read(value.folder);
      if (this.disposed || this.roots.get(path) !== value || attempt !== value.attempt) return;
      if (result.error !== undefined) { value.entries = []; value.error = `Could not read Git status: ${result.error}`; }
      else { value.entries = result.entries; value.error = ''; }
    } catch (error) {
      if (!this.disposed && this.roots.get(path) === value && attempt === value.attempt) {
        value.entries = []; value.error = `Could not read Git status: ${String(error)}`;
      }
    } finally {
      value.pending = false;
      if (!this.disposed && this.roots.get(path) === value) {
        this.publish();
        if (this.active && attempt !== value.attempt) void this.load(path);
      }
    }
  }
  private publish() {
    const errors = JSON.stringify([...this.roots].filter(([, value]) => value.error).map(([root, value]) => [root, value.error]));
    const errorsChanged = errors !== this.errors;
    this.errors = errors;
    this.changed([...this.roots].flatMap(([root, value]) => value.entries.map((entry) => ({ ...entry, path: root + entry.path }))), errorsChanged);
  }
}
