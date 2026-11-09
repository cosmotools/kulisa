// Formatted, inert Markdown with a lazy Pierre source surface (../../../README.md).
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToggleGroup, ToggleGroupItem } from '@ui';
import type { DocumentHost, ViewerProps } from '../../registry';
import { readText } from '../text/read';
import { checkImageDimensions, readImage } from '../image/metadata';
import { ImageBudget } from './image-budget';

const Source = lazy(() => import('../text/TextViewer'));
const MAX_BYTES = 256 * 1024;

export default function MarkdownViewer(props: ViewerProps) {
  const [mode, setMode] = useState('preview');
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 border-b px-2 py-1">
      <ToggleGroup type="single" size="sm" aria-label="Markdown view" value={mode} onValueChange={(value) => { if (value) setMode(value); }}>
        <ToggleGroupItem value="preview">Preview</ToggleGroupItem><ToggleGroupItem value="source">Source</ToggleGroupItem>
      </ToggleGroup>
    </div>
    {mode === 'source' ? <Suspense fallback={<p role="status">Loading source…</p>}><Source {...props} /></Suspense> : <FormatError><Formatted {...props} /></FormatError>}
  </div>;
}
class FormatError extends Component<{ children: ReactNode }, { error: string }> {
  override state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() { return this.state.error ? <p role="status" className="p-4" data-selectable>{this.state.error}</p> : this.props.children; }
}
type Tree = { children?: Tree[] };
function boundTree() {
  return (tree: Tree) => {
    const pending = [tree]; let count = 0;
    while (pending.length) {
      if (++count > 20_000) throw new Error('This Markdown is too complex to format. Choose Source to read it.');
      pending.push(...(pending.pop()!.children ?? []));
    }
  };
}
function Formatted({ source, signal, document }: ViewerProps) {
  const [text, setText] = useState<string | null>(null), [error, setError] = useState('');
  const [linkError, setLinkError] = useState('');
  const controller = useMemo(() => new AbortController(), []);
  const budget = useMemo(() => new ImageBudget(), []);
  useEffect(() => {
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void readText(source, controller.signal, MAX_BYTES).then((text) => { if (!controller.signal.aborted) setText(text); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => { signal.removeEventListener('abort', abort); abort(); };
  }, [controller, source, signal]);
  if (error) return <p role="status" className="p-4" data-selectable>{error}</p>;
  if (text === null) return <p role="status">Reading Markdown…</p>;
  return <article aria-label="Formatted Markdown" data-selectable className="min-h-0 flex-1 overflow-auto p-4 text-sm leading-relaxed select-text [&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_code]:text-xs [&_a]:text-primary [&_a]:underline [&_table]:my-3 [&_table]:border-collapse [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2 [&_hr]:my-4 [&_img]:max-w-full">
    {linkError && <p role="status">{linkError}</p>}
    <Markdown remarkPlugins={[remarkGfm, boundTree]} skipHtml components={{
      a: ({ href, children }) => {
        if (!href) return <span>{children}</span>;
        if (/^https?:\/\//i.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
        if (/^(?:[a-z][\w+.-]*:|\/)/i.test(href)) return <span title="Only web and relative artifact links are supported.">{children}</span>;
        return <a href={href} onClick={(event) => {
          event.preventDefault();
          if (href.startsWith('#')) event.currentTarget.closest('article')?.querySelector(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView();
          else void document.open(href).catch((reason: Error) => setLinkError(reason.message));
        }}>{children}</a>;
      },
      img: ({ src, alt }) => <LocalImage href={typeof src === 'string' ? src : ''} alt={alt ?? ''} document={document} signal={controller.signal} budget={budget} />,
    }}>{text}</Markdown>
  </article>;
}
function LocalImage({ href, alt, document, signal, budget }: { href: string; alt: string; document: DocumentHost; signal: AbortSignal; budget: ImageBudget }) {
  const image = useRef<HTMLImageElement>(null);
  const allocation = useRef<ReturnType<ImageBudget['reserve']> | null>(null);
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(), abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    let url = '';
    void (async () => {
      try {
        if (!href || /^(?:[a-z][\w+.-]*:|\/)/i.test(href)) throw new Error('External images are not loaded.');
        const source = await document.resolve(href, controller.signal);
        controller.signal.throwIfAborted();
        allocation.current = budget.reserve(source.size);
        const result = await readImage(source, controller.signal);
        controller.signal.throwIfAborted();
        allocation.current.dimensions(result.width, result.height);
        url = URL.createObjectURL(new Blob([result.bytes.buffer], { type: result.mime })); setUrl(url);
      } catch (reason) { if (!controller.signal.aborted) setError((reason as Error).message); }
    })();
    return () => {
      signal.removeEventListener('abort', abort); abort();
      if (url) URL.revokeObjectURL(url);
      allocation.current?.dispose(); allocation.current = null;
    };
  }, [href, document, signal, budget]);
  useEffect(() => { const current = image.current; return () => current?.removeAttribute('src'); }, [url]);
  if (error) return <span title={error}>[Image: {alt || href} — {error}]</span>;
  return url ? <img ref={image} src={url} alt={alt} draggable={false} onError={(event) => { event.currentTarget.removeAttribute('src'); URL.revokeObjectURL(url); setError('Image could not be decoded.'); }} onLoad={(event) => {
    try {
      const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
      checkImageDimensions(width, height); allocation.current?.dimensions(width, height);
    } catch (reason) { event.currentTarget.removeAttribute('src'); URL.revokeObjectURL(url); setError((reason as Error).message); }
  }} /> : <span>[Loading image: {alt}]</span>;
}
