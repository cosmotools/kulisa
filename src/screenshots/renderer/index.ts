// The screenshots' window half: its entry (../README.md, The thumbnail). The thumbnail's own page is thumbnail.ts.
import type { ThumbnailAction } from '../ipc.ts';
export { default as Thumbnail } from './Thumbnail.vue';

// Its menu, the window's own (the window's menus are its own components): openMenu shows these rows at a point and
// resolves once it is closed, chosen in or not; its time goes on then.
type Row = '-' | { label: string; run: () => unknown };
export function thumbnailMenu(openMenu: (x: number, y: number, rows: Row[]) => Promise<void>) {
  const act = (action: ThumbnailAction) => () => kulisa.invoke('thumbnail:act', { action });
  kulisa.on('thumbnail:open-menu', async ({ x, y }) => {
    await openMenu(x, y, [
      { label: 'Show in Folder', run: act('show') },
      { label: 'Copy', run: act('copy') },
      { label: 'Send to Agent', run: act('send') },
      '-',
      { label: 'Delete', run: act('delete') },
      { label: 'Close', run: act('close') },
    ]);
    void act('resume')();
  });
}
