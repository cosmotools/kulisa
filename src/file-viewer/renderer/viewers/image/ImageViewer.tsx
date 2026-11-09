// Browser image display; object URLs and animation live only with this source (../../../README.md).
import { useEffect, useRef, useState } from 'react';
import type { ViewerProps } from '../../registry';
import { checkImageDimensions, readImage } from './metadata';

type Mode = 'fit' | 'width' | 'actual' | 'zoom';
export default function ImageViewer({ source, signal }: ViewerProps) {
  const viewport = useRef<HTMLDivElement>(null), image = useRef<HTMLImageElement>(null);
  const [opened, setOpened] = useState<{ url: string; width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [area, setArea] = useState({ width: 1, height: 1 });
  const [mode, setMode] = useState<Mode>('fit'), [zoom, setZoom] = useState(1);
  useEffect(() => {
    const element = viewport.current!;
    const measure = () => setArea({ width: Math.max(1, element.clientWidth - 32), height: Math.max(1, element.clientHeight - 32) });
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let url: string | undefined, disposed = false;
    const dispose = () => {
      disposed = true; image.current?.removeAttribute('src');
      if (url) { URL.revokeObjectURL(url); url = undefined; }
    };
    signal.addEventListener('abort', dispose, { once: true });
    void readImage(source, signal).then(({ bytes, mime, width, height }) => {
      if (disposed || signal.aborted) return;
      url = URL.createObjectURL(new Blob([bytes.buffer], { type: mime }));
      setOpened({ url, width, height });
    }).catch((reason: Error) => { if (!disposed && !signal.aborted) setError(reason.message); });
    return () => { signal.removeEventListener('abort', dispose); dispose(); };
  }, [source, signal]);
  useEffect(() => {
    // React clears refs before passive unmount cleanup; retain the element to stop its decoder/animation too.
    const element = image.current;
    return () => { element?.removeAttribute('src'); };
  }, [opened?.url]);
  const scale = !opened ? 1 : mode === 'fit' ? Math.min(1, area.width / opened.width, area.height / opened.height)
    : mode === 'width' ? Math.min(1, area.width / opened.width) : mode === 'actual' ? 1 : zoom;
  const magnify = (factor: number) => { setZoom(Math.min(8, Math.max(.01, scale * factor))); setMode('zoom'); };
  if (error) throw new Error(error);
  return <div className="file-viewer-image">
    <div className="file-viewer-tools" role="toolbar" aria-label="Image controls">
      <button type="button" disabled={!ready} aria-pressed={mode === 'fit'} onClick={() => setMode('fit')}>Fit</button>
      <button type="button" disabled={!ready} aria-pressed={mode === 'width'} onClick={() => setMode('width')}>Fit width</button>
      <button type="button" disabled={!ready} aria-pressed={mode === 'actual'} onClick={() => setMode('actual')}>100%</button>
      <button type="button" disabled={!ready || scale <= .01} aria-label="Zoom out" onClick={() => magnify(1 / 1.25)}>−</button>
      <button type="button" disabled={!ready || scale >= 8} aria-label="Zoom in" onClick={() => magnify(1.25)}>+</button>
      <output aria-label="Image zoom">{Math.round(scale * 100)}%</output>
      {opened && <output aria-label="Image dimensions">{opened.width} × {opened.height}</output>}
    </div>
    <div ref={viewport} className="file-viewer-image-scroll" tabIndex={0} aria-label="Image viewport">
      {!ready && <p role="status">Opening image…</p>}
      {opened && <div className="file-viewer-image-canvas" style={{ width: opened.width * scale + 32, height: opened.height * scale + 32 }}>
        <img ref={image} src={opened.url} alt={source.name} draggable={false} style={{ width: opened.width * scale, height: opened.height * scale }}
          onError={() => { if (!signal.aborted) setError('Chromium could not decode this image. Open it in a system application.'); }}
          onLoad={(event) => {
            try {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              checkImageDimensions(width, height);
              setOpened((current) => current ? { ...current, width, height } : current); setReady(true);
            } catch (reason) { setError((reason as Error).message); }
          }} />
      </div>}
    </div>
  </div>;
}
