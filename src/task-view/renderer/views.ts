// The profiles' pages are native views above the window's HTML (docs/ui.md): they stay
// hidden while a dialog is open or the grid is not laid out yet (the task loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top. The menus and dialogs themselves: cover.ts.
import { flushSync } from 'react-dom';
import { store } from './state';
import { coverUnder, dialogsShown } from '../../layers/renderer';

// Local menus and drags keep native pages covered until their image handoff ends.
const viewsCovered = () => dialogsShown() > 0 || prepared;
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered(), { task: store.getState().key });

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
let prepared = false;
export function freeze() {
  if (frozen) return frozen;
  const owner = store;
  const current = () => frozen === pending;
  const pending = kulisa.invoke('views:pictures').then(async (pics) => {
    if (!current()) return;
    // A second menu can arrive while the first one's native views are still covered.
    const pictures = { ...owner.getState().pictures, ...pics };
    const sources = Object.values(pictures);
    if (sources.length) {
      await Promise.all(sources.map(async (src) => {
        const image = new Image(); image.src = src;
        await image.decode().catch(() => {});
      }));
      if (!current()) return;
      flushSync(() => owner.setState({ pictures }));
      // The first frame paints React's committed images; only the following frame may uncover that surface.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    if (current()) {
      prepared = true;
      await kulisa.invoke('views:hidden', true, { focus: false, task: owner.getState().key });
    }
  });
  frozen = pending;
  return pending;
}
export async function unfreeze() {
  if (!frozen) return;
  const owner = store, pending = frozen;
  frozen = null; prepared = false;
  await pending;
  if (frozen) return;
  await showViews();
  if (!frozen) owner.setState({ pictures: {} });
}
// A task switch forgets a capture still in progress (controller.ts).
export const forgetFrozen = () => { frozen = null; prepared = false; };

coverUnder({ hide: (hidden) => (hidden ? kulisa.invoke('views:hidden', true) : showViews()), freeze, unfreeze });
