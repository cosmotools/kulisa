// Shallow asynchronous children and foreground refresh; Trees compatibility is tracked in #389.
import { preparePresortedFileTreeInput, type FileTree } from '@pierre/trees';
import type { ProjectFile } from '../ipc.ts';
import type { ExplorerActions } from './actions.ts';
import { GitStatuses } from './git-status.ts';

export interface ExplorerRoot { folder: string; label: string; caption: string }
interface Directory {
  file: string;
  children: string[];
  error?: string;
  visible: boolean;
  loaded: boolean;
  attempt: number;
  pending: boolean;
}

export class Directories {
  private records = new Map<string, Directory>();
  private files = new Map<string, string>();
  private roots = new Map<string, ExplorerRoot>();
  private aliases = new Map<string, string>();
  private paths: string[] = [];
  private active = false;
  private disposed = false;
  private updating = false;
  private queued = false;
  private timer?: ReturnType<typeof setInterval>;
  private unsubscribe: () => void;
  private observed = { count: -1, focus: null as string | null, selection: '' };
  private git: GitStatuses;

  private model: FileTree;
  private actions: ExplorerActions;
  private changed: () => void;

  constructor(model: FileTree, actions: ExplorerActions, changed: () => void) {
    this.model = model; this.actions = actions; this.changed = changed;
    this.git = new GitStatuses(actions.readGitStatus, (entries, errorsChanged) => {
      model.setGitStatus(entries);
      if (errorsChanged) this.notify();
    });
    this.unsubscribe = model.subscribe(() => {
      if (this.disposed) return;
      this.changed();
      const next = { count: model.getVisibleCount(), focus: model.getFocusedPath(), selection: JSON.stringify(model.getSelectedPaths()) };
      const previous = this.observed;
      this.observed = next;
      if (this.updating) return;
      // Focus/selection notifications carry no expansion change. Empty-folder expansion still needs observation.
      if (next.count === previous.count && (next.focus !== previous.focus || next.selection !== previous.selection)) return;
      this.reconcile();
    });
  }

  setRoots(roots: readonly ExplorerRoot[]) {
    const next = new Map<string, ExplorerRoot>();
    for (const folder of this.aliases.keys()) if (!roots.some((root) => root.folder === folder)) this.aliases.delete(folder);
    const used = new Set(this.aliases.values());
    for (const root of roots) {
      let alias = this.aliases.get(root.folder);
      if (!alias) {
        const safe = (name: string) => name.replaceAll('/', '∕');
        const label = root.label || root.folder;
        const duplicate = roots.some((other) => other !== root && (other.label || other.folder) === label);
        const parent = root.folder.replaceAll('\\', '/').split('/').slice(0, -1).at(-1) || root.folder;
        const base = safe(duplicate ? `${label} (${parent})` : label);
        alias = base + '/';
        for (let i = 2; used.has(alias); i++) alias = `${base} (${i})/`;
        this.aliases.set(root.folder, alias);
        used.add(alias);
      }
      next.set(alias, root);
      this.directory(alias, root.folder);
    }
    this.roots = next;
    this.git.setRoots(next);
    this.updatePaths();
    this.reconcile();
    this.notify();
  }

  file(path: string) { return this.files.get(path); }
  root(path: string) { return this.roots.get(path); }
  status(path: string) {
    const gitError = this.git.error(path);
    if (gitError) return gitError;
    const value = this.records.get(path);
    if (!value?.visible) return '';
    if (value.pending && !value.loaded) return 'Loading…';
    if (value.error !== undefined) return value.error || 'Could not read folder';
    return value.loaded && !value.children.length ? 'Empty folder' : '';
  }
  failed(path: string) { return this.records.get(path)?.error !== undefined || !!this.git.error(path); }
  retry(path: string) { this.git.retry(path); void this.load(path); }

  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.git.setActive(active);
    clearInterval(this.timer);
    this.timer = active ? setInterval(() => {
      this.git.refresh();
      for (const [path, value] of this.records) if (value.visible && value.error === undefined) void this.load(path);
    }, 3000) : undefined;
    this.reconcile();
  }

  dispose() {
    this.disposed = true;
    this.unsubscribe();
    this.git.dispose();
    clearInterval(this.timer);
    this.records.clear(); this.files.clear(); this.roots.clear(); this.aliases.clear(); this.paths = [];
  }

  private directory(path: string, file: string) {
    let value = this.records.get(path);
    if (!value || value.file !== file) {
      value = { file, children: [], visible: false, loaded: false, attempt: 0, pending: false };
      this.records.set(path, value);
    }
    return value;
  }

  private reconcile() {
    const visible = new Set<string>();
    const visit = (path: string) => {
      const value = this.records.get(path), item = this.model.getItem(path);
      if (!value || !item || !('isExpanded' in item) || !item.isExpanded()) return;
      visible.add(path);
      for (const child of value.children) if (child.endsWith('/')) visit(child);
    };
    if (this.active) for (const root of this.roots.keys()) visit(root);
    let changed = false;
    for (const [path, value] of this.records) {
      const next = visible.has(path);
      if (next === value.visible) continue;
      changed = true;
      value.visible = next;
      if (next) queueMicrotask(() => { if (!this.disposed) void this.load(path); });
      else value.attempt++;
    }
    if (changed) this.notify();
  }

  private async load(path: string) {
    const value = this.records.get(path);
    if (!value || value.pending || !value.visible || this.disposed) return;
    const previousStatus = this.status(path), previouslyFailed = this.failed(path);
    const attempt = ++value.attempt;
    value.pending = true; value.error = undefined;
    const loadingStatus = this.status(path);
    if (loadingStatus !== previousStatus || previouslyFailed) this.notify();
    try {
      const result = await this.actions.readFolder(value.file);
      if (this.disposed || this.records.get(path) !== value || attempt !== value.attempt || !value.visible) return;
      if (result.error !== undefined) value.error = result.error;
      else {
        const children = result.entries.map((entry: ProjectFile) => {
          const child = path + entry.name + (entry.directory ? '/' : '');
          this.files.set(child, entry.path);
          if (entry.directory) this.directory(child, entry.path);
          return child;
        });
        const changed = children.length !== value.children.length || children.some((child, i) => child !== value.children[i]);
        value.children = children;
        value.loaded = true;
        if (changed) this.scheduleUpdate();
      }
    } catch (error) {
      if (!this.disposed && this.records.get(path) === value && attempt === value.attempt && value.visible) {
        value.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      value.pending = false;
      if (!this.disposed && this.records.get(path) === value) {
        if (this.status(path) !== loadingStatus || this.failed(path)) this.notify();
        // Reopening waits for an obsolete request to settle instead of overlapping reads of the same folder.
        if (value.visible && attempt !== value.attempt) void this.load(path);
      }
    }
  }

  private scheduleUpdate() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.disposed) { this.updatePaths(); this.reconcile(); }
    });
  }

  private updatePaths() {
    const paths: string[] = [], reachable = new Set<string>();
    const visit = (path: string) => {
      paths.push(path); reachable.add(path);
      for (const child of this.records.get(path)?.children ?? []) visit(child);
    };
    for (const [path, root] of this.roots) { this.files.set(path, root.folder); visit(path); }
    for (const path of this.records.keys()) if (!reachable.has(path)) this.records.delete(path);
    for (const path of this.files.keys()) if (!reachable.has(path)) this.files.delete(path);
    if (paths.length === this.paths.length && paths.every((path, i) => path === this.paths[i])) return;
    const expanded = paths.filter((path) => {
      if (!path.endsWith('/')) return false;
      const item = this.model.getItem(path);
      return item && 'isExpanded' in item ? item.isExpanded() : this.roots.has(path);
    });
    this.paths = paths;
    this.updating = true;
    try { this.model.resetPaths({ preparedInput: preparePresortedFileTreeInput(paths), initialExpandedPaths: expanded }); }
    finally { this.updating = false; }
  }

  private notify() {
    if (this.disposed) return;
    this.model.setComposition(this.model.getComposition());
    this.changed();
  }
}
