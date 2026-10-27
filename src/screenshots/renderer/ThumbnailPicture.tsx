// A screenshot's thumbnail as its window draws it (../README.md, The thumbnail): its own view is above the pages and
// hides with them; this shows while they are pictures (under a menu or a dialog, its own menu among them).
import { Image } from '@fluentui/react-components';
import { createStore, useStore } from 'zustand';
import type { ThumbnailEvents } from '../ipc.ts';
import css from './ThumbnailPicture.module.css';

// Where the window draws it, while it is shown.
const place = createStore<ThumbnailEvents['thumbnail:place']>()(() => null);
kulisa.on('thumbnail:place', (t) => place.setState(t, true));

export function Thumbnail() {
  const t = useStore(place);
  return t && <div className={css.place} style={{ left: t.x, top: t.y, width: t.width, height: t.height }}>
    <Image id="shotthumb" src={t.src} alt="" fit="cover" shape="rounded" bordered shadow />
  </div>;
}
