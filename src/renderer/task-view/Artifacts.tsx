// Task authorization/actions connect the file viewer to Artifacts (docs/tasks.md, The Workbench).
import { useMemo, useState } from 'react';
import { Button, Empty, EmptyHeader, EmptyTitle } from '@ui';
import { FileViewer, createViewerRegistry, textViewer, pdfViewer, imageViewer, type FileSource, type ViewerCapabilities, type ViewerProps } from '../../file-viewer/renderer';
import { loadCodeTheme } from '../../editor/renderer';
import { useTask } from './state';
import { uiTextSize, useShade } from '../lib/theme';

const registry = createViewerRegistry([pdfViewer, imageViewer, { ...textViewer, load: async () => {
  const [theme, { default: Text }] = await Promise.all([loadCodeTheme(), textViewer.load()]);
  return { default: (props: ViewerProps) => <Text {...props} appearance={{ ...props.appearance, theme }} /> };
} }]);
let focusPdfSearch: (() => void) | null = null;
kulisa.on('artifact:pdf:find', () => focusPdfSearch?.());
export function Artifacts() {
  const key = useTask((s) => s.key), selected = useTask((s) => s.selectedArtifact);
  const navigation = useTask((s) => s.artifactNavigation);
  const artifact = useTask((s) => s.artifacts.list.find((a) => a.file === selected));
  const file = artifact?.directory ? undefined : artifact?.file, revision = artifact?.revision, size = artifact?.bytes ?? 0;
  const picture = useTask((s) => s.pictures['artifact-pdf']);
  const shade = useShade(), [fontSize] = useState(uiTextSize);
  const source = useMemo<FileSource | null>(() => file ? {
    id: `${file}:${revision}:${navigation}`, name: file.split(/[\\/]/).at(-1)!, size,
    read: async (offset, length, signal) => {
      signal.throwIfAborted();
      const result = await kulisa.invoke('task:artifact:read', { key, file, offset, length });
      signal.throwIfAborted();
      if ('error' in result) throw new Error(result.error);
      if (result.revision !== revision) throw new Error('The file changed. Select it again to reload.');
      return new Uint8Array(result.bytes);
    },
  } : null, [file, revision, size, key, navigation]);
  const appearance = useMemo(() => ({ shade: shade === 'dark' ? 'dark' as const : 'light' as const, fontSize, fontFamily: '"JetBrains Mono", monospace' }), [shade, fontSize]);
  const capabilities = useMemo<ViewerCapabilities>(() => ({ pdf: {
    onFindRequested: (listener) => { focusPdfSearch = listener; return () => { if (focusPdfSearch === listener) focusPdfSearch = null; }; },
    open: async (_source, box, signal) => {
    signal.throwIfAborted();
    const request = crypto.randomUUID();
    const close = () => { void kulisa.invoke('task:artifact:pdf:close', { request }); };
    signal.addEventListener('abort', close, { once: true });
    try {
      const result = await kulisa.invoke('task:artifact:pdf:open', { key, file: file!, request, box });
      signal.throwIfAborted();
      if ('error' in result) throw new Error(result.error);
      return { place: async (box) => { await kulisa.invoke('task:artifact:pdf:place', { request, box }); },
        find: (query, forward) => kulisa.invoke('task:artifact:pdf:find', { request, query, forward }),
        dispose: () => { signal.removeEventListener('abort', close); close(); } };
    } catch (error) { signal.removeEventListener('abort', close); close(); throw error; }
  } } }), [key, file]);
  if (!source || !artifact) return <Empty className="h-full"><EmptyHeader><EmptyTitle>{selected ? 'Artifact is no longer available' : 'Choose an artifact'}</EmptyTitle></EmptyHeader></Empty>;
  return <section aria-label="Artifact preview" className="flex h-full min-h-0 flex-col">
    <header className="flex shrink-0 flex-wrap items-center gap-1 border-b p-1">
      <span title={artifact.file} className="min-w-0 flex-1 truncate px-2 text-sm">{source.name}</span>
      <Button variant="ghost" size="sm" onClick={() => void kulisa.invoke('task:artifact:open', { key, file: artifact.file })}>Open in System Application</Button>
      <Button variant="ghost" size="sm" onClick={() => void kulisa.invoke('file:show', artifact.file)}>Show in Folder</Button>
      <Button variant="ghost" size="sm" onClick={() => void kulisa.invoke('task:artifact:send', { key, file: artifact.file })}>Send to Agent</Button>
      <Button variant="ghost" size="sm" onClick={() => void kulisa.invoke('task:artifact:delete', { key, files: [artifact.file] })}>Delete</Button>
    </header>
    <div className="relative min-h-0 flex-1">
      <FileViewer source={source} registry={registry} appearance={appearance} capabilities={capabilities} />
      {picture && <img src={picture} alt="" draggable={false} className="absolute inset-0 size-full" />}
    </div>
  </section>;
}
