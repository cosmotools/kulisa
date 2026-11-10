// Chromium playback; streams and decoders live only with the selected artifact (../../../README.md).
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { ViewerProps } from '../../registry';
import { Loading } from '../../Loading';

export function AudioViewer(props: ViewerProps) { return <MediaViewer {...props} video={false} />; }
export function VideoViewer(props: ViewerProps) { return <MediaViewer {...props} video />; }
function MediaViewer(props: ViewerProps & { video: boolean }) {
  return props.media.visible ? <Playback {...props} /> : <p role="status">Playback is stopped while this view is hidden.</p>;
}
function Playback({ source, signal, media, video }: ViewerProps & { video: boolean }) {
  const element = useRef<HTMLMediaElement | null>(null);
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(), opening = AbortSignal.any([signal, controller.signal]);
    void media.open(opening).then((url) => { if (!opening.aborted) setUrl(url); })
      .catch((reason: Error) => { if (!opening.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [media, signal]);
  useEffect(() => {
    // Retain the element before React clears its ref; pause, detach and unload the decoder on disposal.
    const current = element.current;
    return () => { if (current) { current.pause(); current.removeAttribute('src'); current.load(); } };
  }, []);
  if (error) throw new Error(error);
  const props = { src: url || undefined, controls: true, preload: 'metadata' as const, 'aria-label': source.name,
    controlsList: 'nodownload noremoteplayback', onError: (event: SyntheticEvent<HTMLMediaElement>) => {
      console.warn(`[file-viewer] media playback failed code=${event.currentTarget.error?.code} ${event.currentTarget.error?.message}`);
      if (!signal.aborted) setError('Chromium could not play this file or codec. Open it in a system application.');
    } };
  return <div className="grid min-h-0 min-w-0 flex-1 place-items-center overflow-auto p-4">
    {!url && <Loading />}
    {video ? <video {...props} ref={(node) => { element.current = node; }} playsInline disablePictureInPicture className="max-h-full w-full" />
      : <audio {...props} ref={(node) => { element.current = node; }} className="w-full" />}
  </div>;
}
