// Virtualized review navigation; Pierre owns tree interaction and row rendering.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { FileTree, useFileTree, useFileTreeSelector } from '@pierre/trees/react';
import { preparePresortedFileTreeInput, type GitStatus } from '@pierre/trees';
import { treeFocusCSS, treeStyle } from '../../shared/tree-style';
import type { DiffFile } from '../ipc';
import type { DiffSession } from './session';
import { diffLabel } from './DiffStatus';
import treeCSS from './tree.css?raw';

const statuses: Record<string, GitStatus> = { A: 'added', C: 'added', D: 'deleted', R: 'renamed', M: 'modified', T: 'modified', U: 'modified' };

export function DiffTree({ session, files, filter, selected, choose }: {
  session: DiffSession; files: DiffFile[]; filter: string; selected: string | null; choose(file: DiffFile): void;
}) {
  const input = useMemo(() => ({
    paths: files.map((file) => file.path),
    files: new Map(files.map((file) => [file.path, file])),
    gitStatus: files.map((file) => ({ path: file.path, status: statuses[file.status] ?? 'modified' })),
  }), [files]);
  const latest = useRef({ input, choose, session, syncing: false, selected: undefined as string | null | undefined });
  const { model } = useFileTree({
    paths: [], gitStatus: input.gitStatus, flattenEmptyDirectories: false, initialExpansion: 'open',
    icons: 'complete', unsafeCSS: treeFocusCSS + treeCSS, initialSearchQuery: filter.trim() ? filter : null, fileTreeSearchMode: 'hide-non-matches',
    onSelectionChange: (selectedPaths) => {
      const file = latest.current.input.files.get(selectedPaths.at(-1) ?? '');
      if (!latest.current.syncing && file) latest.current.choose(file);
    },
    renderRowDecoration: ({ item }) => {
      const file = latest.current.input.files.get(item.path);
      if (!file) return null;
      return { text: '', title: `${file.previousPath ? `${file.previousPath} → ` : ''}${file.path}\n${diffLabel(file.status)}`,
        parts: [
          { text: file.additions === null ? '— ' : `+${file.additions} `, color: file.additions === null ? 'var(--trees-fg-muted)' : 'var(--trees-status-added)' },
          { text: file.deletions === null ? '—' : `−${file.deletions}`, color: file.deletions === null ? 'var(--trees-fg-muted)' : 'var(--trees-status-deleted)' },
        ] };
    },
    composition: { contextMenu: { enabled: true, triggerMode: 'right-click', onOpen: (item, context) => {
      context.close({ restoreFocus: false });
      const file = latest.current.input.files.get(item.path);
      if (file) latest.current.session.actions.showMenu({ clientX: context.anchorRect.x, clientY: context.anchorRect.y }, [{ label: 'View diff', run: () => latest.current.choose(file) }]);
    } } },
  });
  const query = useFileTreeSelector(model, (tree) => tree.getSearchValue());
  // Trees falls back to unfiltered rows on no match; its match list excludes files inside collapsed folders.
  const noMatches = useMemo(() => !!query && !files.some((file) => file.path.toLowerCase().includes(query)), [files, query]);
  useLayoutEffect(() => {
    const current = latest.current, previous = current.input;
    const pathsChanged = current.selected === undefined || input !== previous && (input.paths.length !== previous.paths.length || input.paths.some((path, i) => path !== previous.paths[i]));
    const selectionChanged = selected !== current.selected;
    Object.assign(current, { input, choose, session, selected, syncing: true });
    try {
      if (pathsChanged) {
        // Reapply search after replacement so its match set includes newly changed files.
        model.closeSearch();
        const directories = new Set(input.paths.flatMap((path) => {
          const parts = path.split('/');
          return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/') + '/');
        }));
        const expanded = [...directories].filter((path) => { const item = model.getItem(path); return !item || 'isExpanded' in item && item.isExpanded(); });
        model.resetPaths({ preparedInput: preparePresortedFileTreeInput(input.paths), initialExpandedPaths: expanded });
      }
      if (input !== previous) {
        model.setGitStatus(input.gitStatus);
        // Composition refreshes decorations when counts change without replacing the SVG sprite.
        model.setComposition(model.getComposition());
      }
      model.setSearch(filter.trim() ? filter : null);
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
  }, [model, input, filter, selected, choose, session]);
  return <div className="relative min-h-0 flex-1">
    <FileTree model={model} aria-label="Changed file tree" style={treeStyle} inert={noMatches} className={`absolute inset-0 ${noMatches ? 'invisible' : ''}`} onClickCapture={(event) => {
      // Selecting the current file again jumps back to its header too.
      const row = event.nativeEvent.composedPath().find((node) => node instanceof HTMLElement && node.getAttribute('role') === 'treeitem');
      if (row instanceof HTMLElement && row.getAttribute('aria-selected') === 'true' && !row.hasAttribute('aria-expanded')) {
        const file = latest.current.input.files.get(model.getSelectedPaths()[0] ?? ''); if (file) choose(file);
      }
    }} />
    {noMatches && <p className="px-4 py-2 text-sm text-muted-foreground">No files match</p>}
  </div>;
}
