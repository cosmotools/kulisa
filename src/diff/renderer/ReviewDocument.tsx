// One virtualized review document, with bounded loading (../README.md).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CodeViewItem, FileDiffMetadata } from '@pierre/diffs';
import { CodeView, WorkerPoolContextProvider, type CodeViewHandle, type CodeViewProps, type CodeViewReactOptions } from '@pierre/diffs/react';
import { GitCompareArrowsIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Spinner, ToggleGroup, ToggleGroupItem } from '@ui';
import type { DiffFile } from '../ipc';
import { refused } from '../../shared/result';
import type { DiffPanelProps } from './DiffPanel';
import { DiffCounts } from './DiffCounts';
import { DiffStatus } from './DiffStatus';
import { highlighterOptions, poolOptions } from './review-theme';
import { useDiff } from './session';
import type { Notice } from './review';
import './review.css';

const empty: DiffFile[] = [];

export default function ReviewDocument(props: DiffPanelProps) {
  return <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
    <ReviewContent {...props} />
  </WorkerPoolContextProvider>;
}

function ReviewContent({ session, selection, shade, fontSize }: DiffPanelProps) {
  const { folder } = selection, target = selection.options.to, lineHeight = Math.ceil(fontSize * 1.5);
  const { data: snapshot, error, load } = useDiff(session, selection, true);
  const data = snapshot?.data;
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  const viewer = useRef<CodeViewHandle<Notice, undefined>>(null), viewport = useRef<HTMLDivElement>(null);
  const navigation = useRef<number | null>(null), userScroll = useRef(false);
  const files = useMemo(() => {
    const query = selection.filter?.toLowerCase();
    return query ? (data?.files ?? empty).filter((f) => `${f.path}\n${f.previousPath ?? ''}`.toLowerCase().includes(query)) : data?.files ?? empty;
  }, [data?.files, selection.filter]);
  const counts = useMemo(() => files.reduce((sum, file) => ({
    additions: sum.additions + (file.additions ?? 0), deletions: sum.deletions + (file.deletions ?? 0),
    partial: sum.partial || file.additions === null || file.deletions === null,
  }), { additions: 0, deletions: 0, partial: false }), [files]);
  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  const items = useMemo(() => files.flatMap((file) => snapshot?.entries.get(file.path)?.item ?? []), [files, snapshot?.entries]);

  useLayoutEffect(() => {
    const token = selection.navigation ?? 0;
    if (!files.length || (navigation.current === token && byPath.has(selection.path))) return;
    navigation.current = token; userScroll.current = false;
    const path = byPath.has(selection.path) ? selection.path : files[0]!.path;
    session.actions.selectFile(path, selection.navigation);
    viewer.current?.scrollTo({ type: 'item', id: path, align: 'start', behavior: 'instant' });
  }, [session, selection.navigation, selection.path, files, byPath]);
  const onScroll: NonNullable<CodeViewProps<Notice, undefined>['onScroll']> = useCallback((_top, instance) => {
    if (!userScroll.current) return;
    const top = instance.getContainerElement()?.getBoundingClientRect().top ?? 0;
    const path = instance.getRenderedItems().find((item) => item.element.getBoundingClientRect().bottom > top + 36)?.id;
    if (path) session.actions.selectFile(path, selection.navigation);
  }, [session, selection.navigation]);
  const renderHeader = useCallback((item: CodeViewItem<Notice>) => {
    const file = byPath.get(item.id);
    return <header role="heading" aria-level={3} aria-label={item.id} className="flex h-9 items-center gap-2 border-b bg-muted px-3 text-sm">
      <span className="min-w-0 flex-1 truncate" title={file?.previousPath ? `${file.previousPath} → ${item.id}` : item.id}>{file?.previousPath ? `${file.previousPath} → ${item.id}` : item.id}</span>
      {file && <><DiffStatus status={file.status} /><DiffCounts additions={file.additions} deletions={file.deletions} /></>}
    </header>;
  }, [byPath]);
  const renderAnnotation: NonNullable<CodeViewProps<Notice, undefined>['renderAnnotation']> = useCallback((annotation, _file, item) => {
    const notice = annotation.metadata;
    return <div className="p-3">
      <Alert variant={notice.kind === 'error' ? 'destructive' : 'default'}><AlertDescription>
          <span>{notice.text}</span>
          {notice.kind === 'deferred' && <Button variant="outline" size="sm" aria-label={`Load diff for ${item.id}`} onClick={() => load(item.id)}>Load diff</Button>}
        </AlertDescription></Alert>
    </div>;
  }, [load]);
  const viewOptions = useMemo<CodeViewReactOptions<Notice, undefined>>(() => ({ theme: 'kulisa-review', themeType: shade === 'dark' ? 'dark' : 'light', diffStyle: mode, stickyHeaders: true,
    diffIndicators: 'classic' as const, hunkSeparators: 'line-info-basic' as const, overflow: 'scroll' as const,
    itemMetrics: { lineHeight, diffHeaderHeight: 36 }, layout: { paddingTop: 16, paddingBottom: 16, gap: 24 },
    onPostRender(node, _instance, phase, context) {
      if (phase === 'unmount') return;
      // The component's public lifecycle supplies accessible names for its custom-element root and code region.
      node.setAttribute('role', 'article'); node.setAttribute('aria-label', context.item.id);
      node.shadowRoot?.querySelector('pre')?.setAttribute('aria-label', `Code comparison: ${context.item.id}`);
    },
    loadDiffFiles: async (file: FileDiffMetadata) => {
      const response = await session.actions.contents(folder, file.name, { to: target });
      if (refused(response)) throw new Error(response.error);
      if (response.notice) throw new Error(response.notice);
      return { oldFile: file.type === 'rename-pure' ? null : { name: response.previousPath ?? response.path, contents: response.original },
        newFile: { name: response.path, contents: response.modified } };
    },
  }), [shade, mode, lineHeight, session, folder, target]);
  useEffect(() => {
    const root = viewport.current;
    // CodeView's scroll root has no ARIA props in its React API.
    root?.setAttribute('role', 'region'); root?.setAttribute('aria-label', 'Changed file diffs');
    if (root) root.tabIndex = 0;
    const manual = () => { userScroll.current = true; };
    root?.addEventListener('wheel', manual, { passive: true }); root?.addEventListener('pointerdown', manual); root?.addEventListener('keydown', manual);
    return () => { root?.removeEventListener('wheel', manual); root?.removeEventListener('pointerdown', manual); root?.removeEventListener('keydown', manual); };
  }, []);
  return <section aria-label="Diff review" data-zone="editor" className="flex h-full min-h-0 min-w-0 flex-col bg-card">
    <header className="flex min-h-9 flex-wrap items-center gap-2 border-b px-2 py-1 text-sm">
      <GitCompareArrowsIcon className="size-4 shrink-0" /><span>Diff{data ? ` · ${files.length} files` : ''}</span>
      {data && <div role="group" aria-label="Change summary"><DiffCounts {...counts} /></div>}
      <div className="flex-1" />
      <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={mode} onValueChange={(value) => { if (value === 'unified' || value === 'split') setMode(value); }} aria-label="Diff layout">
        <ToggleGroupItem value="unified" aria-label="Unified diff">Unified</ToggleGroupItem><ToggleGroupItem value="split" aria-label="Split diff">Split</ToggleGroupItem>
      </ToggleGroup>
    </header>
    <div className="relative min-h-0 flex-1">
      {!data && !error && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground"><Spinner />Loading diff…</div>}
      {error && <div className="absolute inset-0 z-10 bg-card p-3"><Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert></div>}
      {data && !files.length && <p className="absolute inset-0 z-10 bg-card p-3 text-sm text-muted-foreground">{!data.git ? 'This folder is not a Git repository.' : data.files.length ? 'No files match' : 'No changes'}</p>}
      <CodeView ref={viewer} containerRef={viewport} items={items} options={viewOptions} onScroll={onScroll}
        renderCustomHeader={renderHeader} renderAnnotation={renderAnnotation} className="diff-review h-full overflow-auto px-4"
        style={{ '--diffs-font-size': `${fontSize}px`, '--diffs-line-height': `${lineHeight}px` } as CSSProperties} />
    </div>
    <footer className="flex gap-2 border-t px-3 py-1 text-xs text-muted-foreground"><span className="min-w-0 truncate">{data ? `${data.from} → ${data.to}` : 'From → To'}</span><span className="ms-auto shrink-0">Read only</span></footer>
  </section>;
}
