// A screenshot's thumbnail as its window draws it (../README.md, The thumbnail): its own view is above the pages and
// hides with them; this shows while they are pictures (under a menu or a dialog, its own menu among them).
import { Image, makeStyles } from '@fluentui/react-components';
import { createStore, useStore } from 'zustand';
import type { ThumbnailEvents } from '../ipc.ts';

// Where the window draws it, while it is shown.
const place = createStore<ThumbnailEvents['thumbnail:place']>()(() => null);
kulisa.on('thumbnail:place', (t) => place.setState(t, true));

// Over the pages' pictures, under the window's dialogs and menus (Fluent's portals).
const useStyles = makeStyles({ picture: { position: 'fixed', zIndex: 10, objectPosition: 'top', pointerEvents: 'none' } });

export function Thumbnail() {
  const t = useStore(place), styles = useStyles();
  return t && <Image id="shotthumb" src={t.src} alt="" fit="cover" shape="rounded" bordered shadow
    className={styles.picture} style={{ left: t.x, top: t.y, width: t.width, height: t.height }} />;
}
