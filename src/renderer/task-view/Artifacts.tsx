// Task authorization/actions connect the file viewer to Artifacts (docs/tasks.md, The Workbench).
import { useMemo, useState } from 'react';
import { Button, Empty, EmptyHeader, EmptyTitle } from '@ui';
import { FileViewer, createViewerRegistry, textViewer, pdfViewer, imageViewer, markdownViewer, audioViewer, videoViewer, type FileSource, type PdfHost, type DocumentHost, type MediaHost } from '../../file-viewer/renderer';
import { useTask, taskStore, useTaskActive } from './state';
import { uiTextSize, useShade } from '../lib/theme';

const registry = createViewerRegistry([pdfViewer, imageViewer, markdownViewer, audioViewer, videoViewer, textViewer]);
let focusPdfSearch: (() => void) | null = null;
kulisa.on('artifact:pdf:find', () => focusPdfSearch?.());
function artifactSource(key: string, file: string, size: number, revision: string, navigation = 0): FileSource {
  return { id: `${file}:${revision}:${navigation}`, name: file.split(/[\\/]/).at(-1)!, size,
    read: async (offset, length, signal) => {
      signal.throwIfAborted();
      const result = await kulisa.invoke('task:artifact:read', { key, file, offset, length });
      signal.throwIfAborted();
      if ('error' in result) throw new Error(result.error);
      if (result.revision !== revision) throw new Error('The file changed. Select it again to reload.');
      return new Uint8Array(result.bytes);
    } };
}
export function Artifacts() {
  const state = taskStore();
  const key = useTask((s) => s.key), selected = useTask((s) => s.selectedArtifact);
  const navigation = useTask((s) => s.artifactNavigation);
  const artifact = useTask((s) => s.artifacts.list.find((a) => a.file === selected));
  const file = artifact?.directory ? undefined : artifact?.file, revision = artifact?.revision, size = artifact?.bytes ?? 0;
  const picture = useTask((s) => s.pictures['artifact-pdf']);
  const shade = useShade(), [fontSize] = useState(uiTextSize);
  const mediaVisible = useTaskActive();
  const source = useMemo(() => file ? artifactSource(key, file, size, revision!, navigation) : null, [file, revision, size, key, navigation]);
  const appearance = useMemo(() => ({ shade: shade === 'dark' ? 'dark' as const : 'light' as const, fontSize, fontFamily: '"JetBrains Mono", monospace' }), [shade, fontSize]);
  const pdf = useMemo<PdfHost>(() => ({
    onFindRequested: (listener) => { focusPdfSearch = listener; return () => { if (focusPdfSearch === listener) focusPdfSearch = null; }; },
    open: async (box, signal) => {
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
  } }), [key, file]);
  const media = useMemo<MediaHost>(() => ({ visible: mediaVisible, open: async (signal) => {
    signal.throwIfAborted();
    const request = crypto.randomUUID();
    const close = () => { void kulisa.invoke('task:artifact:media:close', { request }); };
    signal.addEventListener('abort', close, { once: true });
    try {
      const result = await kulisa.invoke('task:artifact:media:open', { key, file: file!, revision: revision!, request });
      signal.throwIfAborted();
      if ('error' in result) throw new Error(result.error);
      return result.url;
    } catch (error) { signal.removeEventListener('abort', close); close(); throw error; }
  } }), [key, file, revision, mediaVisible]);
  const document = useMemo<DocumentHost>(() => {
    const resolve = (href: string) => {
      const list = state.getState().artifacts.list, from = list.find((a) => a.file === file);
      // URL only normalizes document-relative names; filesystem access stays in the core read/view actions.
      const root = new URL('https://artifacts.invalid/files/');
      const url = new URL(href, new URL(from?.path.split('/').map(encodeURIComponent).join('/') ?? '', root));
      const target = from && url.origin === root.origin && url.pathname.startsWith(root.pathname)
        && list.find((a) => a.path === decodeURIComponent(url.pathname.slice(root.pathname.length)) && !a.directory);
      if (!target) throw new Error('That link does not name an artifact of this task.');
      return target;
    };
    return {
      resolve: async (href, signal) => {
        signal.throwIfAborted();
        const result = resolve(href);
        return artifactSource(key, result.file, result.bytes, result.revision);
      },
      open: async (href) => {
        const target = resolve(href);
        const result = await kulisa.invoke('task:artifact:view', { key, file: target.file });
        if ('error' in result) throw new Error(result.error);
      },
    };
  }, [key, file, state]);
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
      <FileViewer source={source} registry={registry} appearance={appearance} pdf={pdf} media={media} document={document} />
      {picture && <img src={picture} alt="" draggable={false} className="absolute inset-0 size-full" />}
    </div>
  </section>;
}
