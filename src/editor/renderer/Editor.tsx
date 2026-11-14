// Project's editable code surface and conflict comparison (../README.md).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { File, MultiFileDiff, EditProvider, Virtualizer, type FileOptions } from '@pierre/diffs/react';
import { Editor, type EditorFactory } from '@pierre/diffs/edit';
import { XIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Empty, EmptyHeader, EmptyTitle, Tabs, TabsList, TabsTrigger, Spinner } from '@ui';
import type { EditorDocument } from '../ipc';
import type { EditorSession } from './session';
import { editorCSS, editorTheme, editorStyle, keymap } from './appearance';

const createEditor: EditorFactory<undefined, undefined> = (type, options, editStateKey) => new Editor(type, {
  historyMaxEntries: 100, ownsVerticalViewport: true, roundedSelection: false, matchBrackets: true, autoSurround: 'default', keymap, ...options,
}, editStateKey);
const basename = (path: string) => path.split(/[/\\]/).at(-1)!;

export function CodeEditor({ session, active, shade, fontSize }: { session: EditorSession; active: boolean; shade: 'dark' | 'light'; fontSize: number }) {
  const state = useStore(session.store), doc = state.document;
  const [comparison, setComparison] = useState<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const editStateKey = doc && session.stateKey(doc);
  const comparing = comparison === doc?.path && doc?.conflict;
  useEffect(() => { void session.load(); }, [session]);
  useEffect(() => {
    if (!active) return;
    void session.refresh();
    const timer = setInterval(() => void session.refresh(), 2000);
    return () => clearInterval(timer);
  }, [session, active]);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [state.selected]);
  return <section aria-label="Code editor" data-zone="editor" style={editorStyle(shade)} className="flex h-full min-h-0 min-w-0 flex-col bg-(--code-background)">
    {!!state.tabs.length && <div className="min-w-0 shrink-0 border-b"><Tabs value={state.selected ?? ''} onValueChange={(path) => void session.select(path)} activationMode="manual" className="min-w-0">
      <div ref={strip} className="min-w-0 overflow-x-auto"><TabsList aria-label="Open files" className="justify-start">
        {state.tabs.map((tab) => <TabsTrigger key={tab.path} value={tab.path} title={tab.path} aria-label={basename(tab.path)} className="max-w-56 flex-none"
          onContextMenu={(event) => { event.preventDefault(); session.menu(event.nativeEvent, tab.path); }}>
          <span className="truncate">{basename(tab.path)}</span>{(tab.dirty || tab.error) && <span aria-label={tab.conflict ? 'Conflict' : 'Unsaved changes'}>●</span>}
          <span role="button" aria-label={`Close ${basename(tab.path)}`} title="Close file" tabIndex={-1}
            className="inline-flex size-5 shrink-0 items-center justify-center"
            onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); void session.close(tab.path); }}><XIcon className="size-3.5" /></span>
        </TabsTrigger>)}
      </TabsList></div>
    </Tabs></div>}
    {state.loading && <div role="status" className="p-3"><Spinner />Loading editor…</div>}
    {state.error && <Alert variant="destructive"><AlertDescription data-selectable>{state.error}</AlertDescription></Alert>}
    {state.notice && <Alert><AlertDescription>{state.notice}</AlertDescription></Alert>}
    {doc?.error && <Alert variant="destructive"><AlertDescription data-selectable>
      {doc.error} Your text is kept in this task.
      <Button variant="outline" size="sm" onClick={() => void session.retry()}>Retry</Button>
      <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(doc.text)}>Copy text</Button>
    </AlertDescription></Alert>}
    {doc?.conflict && <Alert><AlertDescription>
      This file changed on disk. Autosave is paused; your changes are kept.
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setComparison(comparing ? null : doc.path)}>{comparing ? 'Back to editor' : 'Compare versions'}</Button>
        <Button variant="outline" size="sm" onClick={() => void session.resolve(doc, 'disk')}>Use disk version</Button>
        <Button variant="outline" size="sm" onClick={() => void session.resolve(doc, 'mine')}>Keep my changes</Button>
      </div>
    </AlertDescription></Alert>}
    {doc && editStateKey && state.selected ? <div role="region" aria-label={`Editor document: ${doc.path}`} aria-busy={!comparing && ready !== editStateKey} className="relative min-h-0 flex-1">
      <EditProvider createEditor={createEditor}><Virtualizer className="h-full overflow-auto [--diffs-font-family:'JetBrains_Mono',monospace] [--diffs-font-features:'liga'_0,'calt'_0]"
        style={{ '--diffs-font-size': `${fontSize}px`, '--diffs-line-height': `${Math.ceil(fontSize * 1.4)}px` } as CSSProperties}>
      {comparing && doc.disk ? <div aria-label="Conflicting versions">
        <MultiFileDiff oldFile={{ name: `On disk: ${basename(doc.path)}`, contents: doc.disk.text }} newFile={{ name: `Your changes: ${basename(doc.path)}`, contents: doc.text }}
          options={{ theme: editorTheme[shade], preferredHighlighter: 'shiki-js', diffStyle: 'unified', overflow: 'wrap', unsafeCSS: 'pre { user-select: text; }' }} />
      </div> : <EditableFile key={editStateKey} editStateKey={editStateKey} doc={doc} session={session} shade={shade} fontSize={fontSize} onReady={() => setReady(editStateKey)} />}
      </Virtualizer></EditProvider>
      {!comparing && ready !== editStateKey && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground"><Spinner />Preparing editor…</div>}
    </div> : !state.loading && <Empty><EmptyHeader><EmptyTitle>Choose a text file</EmptyTitle></EmptyHeader></Empty>}
    {doc && <footer role="status" aria-label="File status" className="flex shrink-0 gap-2 border-t px-3 py-1 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1 truncate" title={doc.path}>{doc.path}</span>
      <span>{doc.conflict ? 'Conflict' : doc.error ? 'Not saved' : doc.dirty ? 'Saving…' : 'Saved automatically'}</span>
    </footer>}
  </section>;
}

// File props are creation inputs: feeding each edit back would reset Pierre's document and undo history.
function EditableFile({ doc, session, editStateKey, shade, fontSize, onReady }: { doc: EditorDocument; session: EditorSession; editStateKey: string; shade: 'dark' | 'light'; fontSize: number; onReady(): void }) {
  const [file] = useState(() => ({ name: doc.path, contents: doc.text }));
  const surface = useRef<HTMLElement | null>(null);
  const options = useMemo<FileOptions<undefined, undefined>>(() => ({ theme: editorTheme[shade], preferredHighlighter: 'shiki-js',
    disableFileHeader: true, overflow: 'scroll', unsafeCSS: editorCSS,
    onPostRender(node, _instance, phase) {
      surface.current = phase === 'unmount' ? null : node;
    },
  }), [shade]);
  return <File file={file} edit editStateKey={editStateKey} options={options}
      metrics={{ hunkLineCount: 100, lineHeight: Math.ceil(fontSize * 1.4), diffHeaderHeight: 0, spacing: 8 }}
      editorOptions={{ onAttach(editor) {
        editor.focus(editor.getViewState().selections?.length ? { preventScroll: true } : { lineNumber: 1 });
        // Take native focus before an offscreen caret replaces the virtualized DOM; Pierre's queued focus guard
        // otherwise sees the tab button and refuses to restore focus, especially for an empty final line.
        surface.current?.shadowRoot?.querySelector<HTMLElement>('[role="textbox"]')?.focus({ preventScroll: true });
        onReady();
      } }}
      onEditChange={(event) => session.edit(doc, event.file.contents)} onEditComplete={() => session.complete(editStateKey)} />;
}
