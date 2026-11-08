// Virtualized Project navigation and caller-owned root actions (../README.md).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { Alert, AlertDescription, Button } from '@ui';
import { treeFocusCSS, treeStyle } from '../../shared/tree-style';
import type { ExplorerActions } from './actions';
import { Directories, type ExplorerRoot } from './directories';
import treeCSS from './tree.css?raw';

type Notice = { path: string; text: string; failed: boolean };

export function ProjectTree({ actions, roots, header, active = true }: {
  actions: ExplorerActions; roots: readonly ExplorerRoot[]; header: ReactNode; active?: boolean;
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice>({ path: '', text: '', failed: false });
  const latest = useRef({ actions, data: null as Directories | null, opening: 0, selecting: false });
  const { model } = useFileTree({
    paths: [], flattenEmptyDirectories: false, icons: 'complete', unsafeCSS: treeFocusCSS + treeCSS,
    onSelectionChange: (paths) => {
      if (latest.current.selecting) return;
      latest.current.selecting = true;
      try { for (const path of paths.slice(0, -1)) model.getItem(path)?.deselect(); }
      finally { latest.current.selecting = false; }
    },
    renderRowDecoration: ({ item }) => {
      const data = latest.current.data;
      const status = data?.status(item.path), root = data?.root(item.path);
      const text = [root?.caption, status].filter(Boolean).join(' · ');
      return { text, title: [data?.file(item.path), root?.caption, status].filter(Boolean).join('\n') };
    },
    composition: { contextMenu: { enabled: true, triggerMode: 'both', buttonVisibility: 'when-needed', onOpen: (item, context) => {
      context.close({ restoreFocus: false });
      const { data, actions } = latest.current, file = data?.file(item.path);
      if (!data || !file) return;
      select(item.path);
      const rows = data.root(item.path) ? actions.folderMenu(file) : [
        { label: 'Open', run: () => {
          const handle = model.getItem(item.path);
          if (handle && 'expand' in handle) handle.expand(); else void open(item.path);
        } },
        ...item.kind === 'file' && actions.openExternal ? [{ label: 'Open in System Application', run: () => actions.openExternal!(file) }] : [],
        { label: 'Show in Folder', run: () => actions.showFile(file) },
      ];
      if (data.failed(item.path)) rows.push({ label: 'Retry', run: () => data.retry(item.path) });
      actions.showMenu({ clientX: context.anchorRect.x, clientY: context.anchorRect.y }, rows);
    } } },
  });

  function select(path: string) {
    // Avoid intermediate multi-selection and its reentrant model notifications.
    for (const previous of model.getSelectedPaths()) if (previous !== path) model.getItem(previous)?.deselect();
    model.getItem(path)?.select();
  }
  async function open(path: string) {
    const { data, actions } = latest.current, file = data?.file(path);
    if (!file) return;
    select(path);
    if (data?.root(path)) { void actions.openFolder(file); return; }
    const attempt = ++latest.current.opening;
    try {
      const result = await actions.openFile(file);
      if (data === latest.current.data && attempt === latest.current.opening) setError(result.error ?? '');
    } catch (error) {
      if (data === latest.current.data && attempt === latest.current.opening) setError(String(error));
    }
  }

  useLayoutEffect(() => {
    const updateNotice = () => {
      const path = model.getFocusedPath() ?? model.getVisibleRows(0, 0)[0]?.path ?? '';
      const data = latest.current.data;
      const next = { path, text: data?.status(path) ?? '', failed: data?.failed(path) ?? false };
      setNotice((previous) => previous.path === next.path && previous.text === next.text && previous.failed === next.failed ? previous : next);
    };
    const current = latest.current;
    const data = new Directories(model, actions, updateNotice);
    Object.assign(current, { data, actions });
    return () => { current.data = null; current.opening++; data.dispose(); };
  }, [model, actions]);
  useLayoutEffect(() => { latest.current.data?.setRoots(roots); }, [model, actions, roots]);
  useLayoutEffect(() => { latest.current.data?.setActive(active); }, [model, actions, active]);

  return <div className="flex h-full min-h-0 flex-col">
    <FileTree model={model} header={header} aria-label="Project file tree" style={treeStyle} className="min-h-0 flex-1"
      onDoubleClickCapture={(event) => {
        if (!event.nativeEvent.composedPath().some((node) => node instanceof HTMLElement && node.getAttribute('role') === 'treeitem')) return;
        const path = model.getFocusedPath();
        if (path && (!model.getItem(path)?.isDirectory() || latest.current.data?.root(path))) void open(path);
      }}
      onKeyDownCapture={(event) => {
        if (!event.nativeEvent.composedPath().some((node) => node instanceof HTMLElement && node.getAttribute('role') === 'treeitem')) return;
        const path = model.getFocusedPath();
        if (event.key === 'Enter' && path && !model.getItem(path)?.isDirectory()) {
          event.preventDefault(); event.stopPropagation(); void open(path);
        }
      }} />
    {notice.text && !notice.failed && <p role="status" className="sr-only">{notice.path}: {notice.text}</p>}
    {notice.failed && <Alert variant="destructive"><AlertDescription>{notice.text}</AlertDescription>
      <Button variant="outline" size="sm" onClick={() => latest.current.data?.retry(notice.path)}>Retry</Button></Alert>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
