// Trees presentation for Artifacts (docs/tasks.md, The Workbench).
import { useLayoutEffect, useRef } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { FileTreeIconConfig } from '@pierre/trees';
import { treeFocusCSS, treeStyle } from '../../../shared/tree-style';
import rowCSS from './rows.css?raw';

export interface ArtifactTreeEntry {
  path: string;
  caption: string;
  thumb?: string | null;
}
interface Actions {
  open(path: string): void;
  menu(path: string, at: { clientX: number; clientY: number }): void;
  drag?(path: string): void;
  thumbnails?(paths: string[]): void;
}

function eventRow(event: Event) {
  return event.composedPath().find((node) => node instanceof HTMLElement && node.getAttribute('role') === 'treeitem') as HTMLElement | undefined;
}

// The public icon API matches basenames, not paths. Never show another file's thumbnail when names collide.
function thumbnailIcons(entries: readonly ArtifactTreeEntry[]): FileTreeIconConfig {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const name = entry.path.split('/').at(-1)!.toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const byFileName: NonNullable<FileTreeIconConfig['byFileName']> = Object.create(null);
  const symbols: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const name = entry.path.split('/').at(-1)!;
    if (counts.get(name.toLowerCase()) !== 1 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(entry.thumb ?? '')) continue;
    const id = `artifact-thumbnail-${index}`;
    byFileName[name] = { name: id, width: 32, height: 32, viewBox: '0 0 32 32' };
    symbols.push(`<symbol id="${id}" viewBox="0 0 32 32"><image href="${entry.thumb}" width="32" height="32" preserveAspectRatio="xMidYMin slice" /></symbol>`);
  }
  return { set: 'complete', byFileName, spriteSheet: `<svg data-icon-sprite aria-hidden="true" width="0" height="0">${symbols.join('')}</svg>` };
}

export function ArtifactTree({ entries, actions }: {
  entries: readonly ArtifactTreeEntry[]; actions: Actions;
}) {
  const current = useRef({ actions, byPath: new Map(entries.map((e) => [e.path, e])) });
  const pendingThumbnails = useRef(new Set<string>());
  const scheduledThumbnails = useRef(false);
  const requestedThumbnails = useRef(new Set<string>());
  const previousPaths = useRef(entries.map((e) => e.path));
  const { model } = useFileTree({
    paths: entries.map((e) => e.path), flattenEmptyDirectories: false, initialExpansion: 'closed',
    itemHeight: 52, icons: thumbnailIcons(entries), unsafeCSS: treeFocusCSS + rowCSS,
    dragAndDrop: { canDrop: () => false },
    renderRowDecoration: ({ item }) => {
      const entry = current.current.byPath.get(item.path);
      if (entry && !entry.thumb && /\.(png|jpe?g|webp)$/i.test(entry.path) && !requestedThumbnails.current.has(entry.path)) {
        pendingThumbnails.current.add(entry.path); requestedThumbnails.current.add(entry.path);
        if (!scheduledThumbnails.current) {
          scheduledThumbnails.current = true;
          queueMicrotask(() => {
            scheduledThumbnails.current = false;
            const paths = [...pendingThumbnails.current]; pendingThumbnails.current.clear();
            current.current.actions.thumbnails?.(paths);
          });
        }
      }
      return entry ? { text: entry.caption, title: `${entry.path}\n${entry.caption}` } : null;
    },
    composition: { contextMenu: { enabled: true, triggerMode: 'both', buttonVisibility: 'when-needed', onOpen: (item, context) => {
      context.close({ restoreFocus: false });
      current.current.actions.menu(item.path, { clientX: context.anchorRect.x, clientY: context.anchorRect.y });
    } } },
  });
  useLayoutEffect(() => {
    current.current = { actions, byPath: new Map(entries.map((e) => [e.path, e])) };
    requestedThumbnails.current.clear();
    const paths = entries.map((e) => e.path);
    if (paths.length !== previousPaths.current.length || paths.some((path, i) => path !== previousPaths.current[i])) {
      const directories = new Set<string>();
      for (const path of paths) {
        for (let at = path.indexOf('/'); at !== -1; at = path.indexOf('/', at + 1)) directories.add(path.slice(0, at + 1));
      }
      const expanded = [...directories].filter((path) => {
        const item = model.getItem(path);
        return item && 'isExpanded' in item && item.isExpanded();
      });
      model.resetPaths(paths, { initialExpandedPaths: expanded });
      previousPaths.current = paths;
    }
    model.setIcons(thumbnailIcons(entries));
  }, [model, entries, actions]);

  return <FileTree model={model} aria-label="Artifacts" style={treeStyle} className="h-full min-h-0 w-full"
    onClickCapture={(event) => {
      // A shadow-root row is outside React's target; composedPath is the event's public cross-root boundary.
      const row = eventRow(event.nativeEvent);
      if (row?.getAttribute('data-item-type') === 'file' && event.button === 0 && !event.nativeEvent.composedPath().some((node) => node instanceof HTMLElement && node.closest('[data-item-section=action]'))) actions.open(row.getAttribute('data-item-path')!);
    }}
    onKeyDownCapture={(event) => {
      const path = model.getFocusedPath();
      if (event.key === 'Enter' && path && !model.getItem(path)?.isDirectory()) {
        event.preventDefault(); event.stopPropagation();
        for (const selected of model.getSelectedPaths()) model.getItem(selected)?.deselect();
        model.getItem(path)?.select(); actions.open(path);
      }
    }}
    onDragStartCapture={(event) => {
      const row = eventRow(event.nativeEvent), path = row?.getAttribute('data-item-path');
      if (path && actions.drag) {
        event.preventDefault(); event.stopPropagation(); actions.drag(path);
      }
    }} />;
}
