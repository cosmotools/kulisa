// Virtualized review navigation; Pierre owns tree interaction and row rendering.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { GitStatus } from '@pierre/trees';
import type { DiffFile } from '../ipc';
import type { DiffSession } from './session';
import { diffLabel } from './DiffStatus';
import { treeIcons } from './tree-icons';
import treeCSS from './tree.css?raw';

const statuses: Record<string, GitStatus> = { A: 'added', C: 'added', D: 'deleted', R: 'renamed', M: 'modified', T: 'modified', U: 'modified' };

export function DiffTree({ session, files, selected, choose }: {
  session: DiffSession; files: DiffFile[]; selected: string | null; choose(file: DiffFile): void;
}) {
  const input = useMemo(() => ({
    paths: files.map((file) => file.path),
    files: new Map(files.map((file) => [file.path, file])),
    gitStatus: files.map((file) => ({ path: file.path, status: statuses[file.status] ?? 'modified' })),
  }), [files]);
  const latest = useRef({ input, choose, session, syncing: false, selected: undefined as string | null | undefined });
  const { model } = useFileTree({
    paths: input.paths, gitStatus: input.gitStatus, presorted: true, flattenEmptyDirectories: false, initialExpansion: 'open', itemHeight: 28, stickyFolders: true,
    icons: treeIcons, unsafeCSS: treeCSS,
    onSelectionChange: (selectedPaths) => {
      const file = latest.current.input.files.get(selectedPaths.at(-1) ?? '');
      if (!latest.current.syncing && file) latest.current.choose(file);
    },
    renderRowDecoration: ({ item }) => {
      const file = latest.current.input.files.get(item.path);
      if (!file) return null;
      return { text: '', title: `${file.previousPath ? `${file.previousPath} → ` : ''}${file.path}\n${diffLabel(file.status)}`,
        parts: [
          { text: file.additions === null ? '— ' : `+${file.additions} `, color: file.additions === null ? 'var(--muted-foreground)' : 'var(--success)' },
          { text: file.deletions === null ? '—' : `−${file.deletions}`, color: file.deletions === null ? 'var(--muted-foreground)' : 'var(--destructive)' },
        ] };
    },
    composition: { contextMenu: { enabled: true, triggerMode: 'right-click', onOpen: (item, context) => {
      context.close({ restoreFocus: false });
      const file = latest.current.input.files.get(item.path);
      if (file) latest.current.session.actions.showMenu({ clientX: context.anchorRect.x, clientY: context.anchorRect.y }, [{ label: 'View diff', run: () => latest.current.choose(file) }]);
    } } },
  });
  useLayoutEffect(() => {
    const current = latest.current, previous = current.input;
    const pathsChanged = input !== previous && (input.paths.length !== previous.paths.length || input.paths.some((path, i) => path !== previous.paths[i]));
    const selectionChanged = selected !== current.selected;
    Object.assign(current, { input, choose, session, selected, syncing: true });
    try {
      if (pathsChanged) {
        const directories = new Set(input.paths.flatMap((path) => {
          const parts = path.split('/');
          return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/') + '/');
        }));
        const expanded = [...directories].filter((path) => { const item = model.getItem(path); return !item || 'isExpanded' in item && item.isExpanded(); });
        model.resetPaths(input.paths, { initialExpandedPaths: expanded });
      }
      if (input !== previous) {
        model.setGitStatus(input.gitStatus);
        // Composition refreshes decorations when counts change without replacing the SVG sprite.
        model.setComposition(model.getComposition());
      }
      if (!selectionChanged && !pathsChanged) return;
      for (const path of model.getSelectedPaths()) if (path !== selected) model.getItem(path)?.deselect();
      if (selected && model.getItem(selected)) {
        const parts = selected.split('/');
        for (let depth = 1; depth < parts.length; depth++) {
          const item = model.getItem(parts.slice(0, depth).join('/') + '/'); if (item && 'expand' in item) item.expand();
        }
        model.getItem(selected)?.select();
        model.scrollToPath(selected, { focus: false });
      }
    } finally { current.syncing = false; }
  }, [model, input, selected, choose, session]);
  return <div className="relative min-h-0 flex-1">
    <FileTree model={model} aria-label="Changed file tree" className="absolute inset-0" onClickCapture={(event) => {
      // Selecting the current file again jumps back to its header too.
      const row = event.nativeEvent.composedPath().find((node) => node instanceof HTMLElement && node.getAttribute('role') === 'treeitem');
      if (row instanceof HTMLElement && row.getAttribute('aria-selected') === 'true' && !row.hasAttribute('aria-expanded')) {
        const file = latest.current.input.files.get(model.getSelectedPaths()[0] ?? ''); if (file) choose(file);
      }
    }} />
    {!files.length && <p className="p-2 text-xs text-muted-foreground">No files match</p>}
  </div>;
}
