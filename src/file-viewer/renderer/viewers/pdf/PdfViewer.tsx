// Placement/lifecycle adapter; the host implements native PDF access (../../../README.md).
import { useEffect, useRef, useState } from 'react';
import type { NativePdfLease, ViewerBox, ViewerProps } from '../../registry';
import { FindBar } from '../../FindBar';

export default function PdfViewer({ source, signal, capabilities }: ViewerProps) {
  const host = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''), [opened, setOpened] = useState<NativePdfLease | null>(null);
  const [query, setQuery] = useState(''), [result, setResult] = useState({ active: 0, matches: 0 });
  const searches = useRef(0);
  useEffect(() => capabilities.pdf?.onFindRequested?.(() => { input.current?.focus(); input.current?.select(); }), [capabilities.pdf]);
  useEffect(() => {
    const element = host.current!, pdf = capabilities.pdf;
    if (!pdf) return;
    const controller = new AbortController();
    const aborted = () => controller.abort();
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) controller.abort();
    let lease: NativePdfLease | null = null;
    const box = (): ViewerBox => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    let frame = 0, previous = '';
    // Native views must follow position-only grid changes too, which ResizeObserver does not report.
    const place = () => {
      if (controller.signal.aborted) return;
      const bounds = box(), serialized = JSON.stringify(bounds);
      if (lease && serialized !== previous) {
        previous = serialized;
        void lease.place(bounds).catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    void pdf.open(source, box(), controller.signal).then((opened) => {
      if (controller.signal.aborted) opened.dispose();
      else { lease = opened; setOpened(opened); }
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => {
      controller.abort(); signal.removeEventListener('abort', aborted);
      cancelAnimationFrame(frame);
      lease?.dispose();
    };
  }, [source, signal, capabilities.pdf]);
  const find = (query: string, forward: boolean) => {
    const generation = ++searches.current;
    void opened?.find?.(query, forward).then((found) => {
      if (!signal.aborted && generation === searches.current) setResult(found);
    }).catch((reason: Error) => { if (!signal.aborted) setError(reason.message); });
  };
  if (error) throw new Error(error);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); input.current?.focus(); input.current?.select(); }
  }}>
    {opened?.find && <FindBar inputRef={input} query={query} onQuery={(query) => { setQuery(query); find(query, true); }}
      matches={result.matches} active={result.active} onMove={(step) => find(query, step > 0)} />}
    <div ref={host} className="min-h-0 flex-1" aria-label="PDF document">{!opened && <p role="status">Opening PDF…</p>}</div>
  </div>;
}
