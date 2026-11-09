// Read-only Pierre code surface; no editor provider or saving lifecycle (../../../README.md).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CodeView, type CodeViewHandle, type CodeViewProps } from '@pierre/diffs/react';
import { Toggle } from '@ui';
import { loadCodeTheme } from '../../../../editor/renderer';
import type { ViewerProps } from '../../registry';
import { findText } from './search';
import { FindBar } from '../../FindBar';

const MAX_BYTES = 4 * 1024 * 1024;
const theme = await loadCodeTheme();
export default function TextViewer({ source, signal, appearance }: ViewerProps) {
  const [text, setText] = useState<string | null>(null), [error, setError] = useState('');
  useEffect(() => {
    void (async () => {
      try {
        if (source.size > MAX_BYTES) throw new Error('Text preview is limited to 4 MiB.');
        const bytes = await source.read(0, source.size, signal);
        signal.throwIfAborted();
        if (bytes.length !== source.size) throw new Error('The file changed while opening. Select it again to reload.');
        const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(value)) throw new Error('This file contains binary data.');
        if (value.split(/\r\n|\r|\n/).length > 100_000) throw new Error('Text preview is limited to 100,000 lines.');
        if (!signal.aborted) setText(value);
      } catch (reason) { if (!signal.aborted) setError((reason as Error).message); }
    })();
  }, [source, signal]);
  if (error) throw new Error(error);
  return text === null ? <p role="status">Reading text…</p> : <TextContent text={text} name={source.name} appearance={appearance} />;
}
function TextContent({ text, name, appearance }: { text: string; name: string; appearance: ViewerProps['appearance'] }) {
  const view = useRef<CodeViewHandle<undefined, undefined>>(null), input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(''), [index, setIndex] = useState(0), [wrap, setWrap] = useState(false);
  const matches = useMemo(() => findText(text, query), [text, query]);
  const items = useMemo<CodeViewProps<undefined, undefined>['items']>(() => [{ id: 'file', type: 'file', file: { name, contents: text } }], [text, name]);
  const options = useMemo(() => ({ theme,
    themeType: appearance.shade, preferredHighlighter: 'shiki-js' as const,
    disableFileHeader: true, overflow: wrap ? 'wrap' as const : 'scroll' as const, enableLineSelection: true,
    tokenizeMaxLineLength: 4000, tokenizeMaxLength: MAX_BYTES,
    unsafeCSS: 'pre { user-select: text; }',
  }), [appearance.shade, wrap]);
  const current = matches.lines.length ? index % matches.lines.length : 0;
  useEffect(() => {
    const line = matches.lines[current];
    if (line) {
      view.current?.setSelectedLines({ id: 'file', range: { start: line, end: line } });
      view.current?.scrollTo({ type: 'line', id: 'file', lineNumber: line, align: 'center' });
    } else view.current?.clearSelectedLines();
  }, [matches, current]);
  const move = (step: number) => setIndex((current + step + matches.lines.length) % (matches.lines.length || 1));
  const fontSize = appearance.fontSize;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); input.current?.focus(); input.current?.select(); }
  }}>
    <FindBar inputRef={input} query={query} onQuery={(query) => { setQuery(query); setIndex(0); }} matches={matches.lines.length}
      active={matches.lines.length ? current + 1 : 0} truncated={matches.truncated} onMove={move}>
      <Toggle size="sm" pressed={wrap} onPressedChange={setWrap}>Wrap</Toggle>
    </FindBar>
    <CodeView ref={view} items={items} options={options} className="min-h-0 flex-1 overflow-auto select-text" style={{
      '--diffs-font-family': appearance.fontFamily, '--diffs-font-size': `${fontSize}px`, '--diffs-line-height': `${Math.ceil(fontSize * 1.4)}px`,
    } as CSSProperties} />
  </div>;
}
