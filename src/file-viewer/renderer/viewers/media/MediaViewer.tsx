// Chromium playback; streams and decoders live only with the selected artifact (../../../README.md).
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@ui';
import type { ViewerProps } from '../../registry';

export function AudioViewer(props: ViewerProps) { return <MediaViewer {...props} video={false} />; }
export function VideoViewer(props: ViewerProps) { return <MediaViewer {...props} video />; }
function MediaViewer(props: ViewerProps & { video: boolean }) {
  return props.media.visible ? <Playback {...props} /> : <p role="status">Playback is stopped while this view is hidden.</p>;
}
function Playback({ source, signal, media, video }: ViewerProps & { video: boolean }) {
  const element = useRef<HTMLMediaElement | null>(null);
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(), abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let dispose: (() => void) | undefined;
    void media.open(controller.signal).then((lease) => {
      if (controller.signal.aborted) { lease.dispose(); return; }
      dispose = lease.dispose; setUrl(lease.url);
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => { signal.removeEventListener('abort', abort); abort(); dispose?.(); };
  }, [media, signal]);
  useEffect(() => {
    // Retain the element before React clears its ref; pause, detach and unload the decoder on disposal.
    const current = element.current;
    return () => { if (current) { current.pause(); current.removeAttribute('src'); current.load(); } };
  }, [url]);
  if (error) throw new Error(error);
  const props = { src: url || undefined, controls: true, preload: 'metadata' as const, 'aria-label': source.name,
    controlsList: 'nodownload noremoteplayback', onError: (event: SyntheticEvent<HTMLMediaElement>) => {
      console.warn(`[file-viewer] media playback failed code=${event.currentTarget.error?.code} ${event.currentTarget.error?.message}`);
      if (!signal.aborted) setError('Chromium could not play this file or codec. Open it in a system application.');
    } };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1">
      <Select defaultValue="1" onValueChange={(value) => { if (element.current) element.current.playbackRate = Number(value); }}>
        <SelectTrigger size="sm" aria-label="Playback speed"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{[.5, 1, 1.25, 1.5, 2].map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </div>
    {!url && <p role="status">Opening media…</p>}
    <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
      {url && (video ? <video {...props} ref={(node) => { element.current = node; }} playsInline disablePictureInPicture className="max-h-full w-full" />
        : <audio {...props} ref={(node) => { element.current = node; }} className="w-full" />)}
    </div>
  </div>;
}
