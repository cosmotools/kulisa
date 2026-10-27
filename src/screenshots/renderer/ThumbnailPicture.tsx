// A screenshot's thumbnail as its window draws it (../README.md, The thumbnail): its own view is above the pages and
// hides with them; this shows while they are pictures (under a menu or a dialog, its own menu among them): over the
// pages' pictures, under the window's dialogs and menus (their layers' z-50), where its window draws it.
import { createStore, useStore } from 'zustand';
import type { ThumbnailEvents } from '../ipc.ts';

// Where the window draws it, while it is shown.
const place = createStore<ThumbnailEvents['thumbnail:place']>()(() => null);
kulisa.on('thumbnail:place', (t) => place.setState(t, true));

export function Thumbnail() {
  const t = useStore(place);
  // object-top: a page's head, where its picture is cut
  return t && <div className="pointer-events-none fixed z-10" style={{ left: t.x, top: t.y, width: t.width, height: t.height }}>
    <img id="shotthumb" src={t.src} alt="" className="size-full rounded-md border object-cover object-top shadow-lg" />
  </div>;
}
