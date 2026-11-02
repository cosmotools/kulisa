// The profiles' pages are native views above the window's HTML (docs/ui.md): they stay
// hidden while a dialog is open or the grid is not laid out yet (store.loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top. The menus and dialogs themselves: cover.ts.
import { store } from './store';
import { coverUnder, dialogsShown } from './cover';

// A menu or a drag too (frozen): the pages stay pictures until it ends (unfreeze), or the next task's grid shown under a
// menu would show them over it.
const viewsCovered = () => dialogsShown() > 0 || store.getState().loading || !!frozen;
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered());
let layout: (() => void) | null = null;
export const onLivePages = (listener: () => void) => { layout = listener; };

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
let revision = 0;
export function freeze() {
  if (frozen) return frozen;
  const task = store.getState().current;
  const pending = kulisa.invoke('views:hidden', true, { snapshots: true }).then((pics) => {
    if (frozen === pending && store.getState().current === task) store.setState({ pictures: pics || {} });
  });
  frozen = pending;
  return pending;
}
export async function unfreeze() {
  if (!frozen) return;
  const task = store.getState().current;
  const owner = revision;
  const f = frozen; frozen = null;
  await f;
  if (frozen || revision !== owner || store.getState().current !== task) return;
  await livePages();
}
// The pages live again in place of their pictures, unless a menu or a drag has them (it does so when it ends).
async function livePages() {
  if (frozen) return;
  store.setState({ pictures: {} });
  await showViews();
  layout?.();
}
// A grid leaving: a freeze under way is forgotten (grid.ts, grid:closing).
export const forgetFrozen = () => { revision++; frozen = null; };

coverUnder({ hide: (hidden) => (hidden ? kulisa.invoke('views:hidden', true) : showViews()), freeze, unfreeze });
