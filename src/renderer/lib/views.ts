// The profiles' pages are native views above the window's HTML (docs/ui.md): they stay
// hidden while a dialog is open or the grid is not laid out yet (the task loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top. The menus and dialogs themselves: cover.ts.
import { taskStore } from './store';
import { coverUnder, dialogsShown } from './cover';

// A menu or a drag too (frozen): the pages stay pictures until it ends (unfreeze), or the next task's grid shown under a
// menu would show them over it.
const viewsCovered = () => dialogsShown() > 0 || taskStore().getState().loading || !!frozen;
const showViews = () => kulisa.invoke('views:hidden', viewsCovered());
export const revealGrid = (task: string) => kulisa.invoke('grid:ready', { task, hidden: viewsCovered() });
let layout: (() => void) | null = null;
export const onLivePages = (listener: () => void) => { layout = listener; };

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
export function freeze() {
  if (frozen) return frozen;
  const owner = taskStore();
  const pending = kulisa.invoke('views:hidden', true, { snapshots: true }).then((pics) => {
    if (frozen === pending && owner === taskStore()) owner.setState({ pictures: pics || {} });
  });
  frozen = pending;
  return pending;
}
export async function unfreeze() {
  if (!frozen) return;
  const owner = taskStore(), pending = frozen;
  frozen = null;
  await pending;
  if (frozen || owner !== taskStore()) return;
  await livePages();
}
// The pages live again in place of their pictures, unless a menu or a drag has them (it does so when it ends).
async function livePages() {
  if (frozen) return;
  taskStore().setState({ pictures: {} });
  await showViews();
  layout?.();
}
// A grid leaving: a freeze under way is forgotten (grid.ts, task:deactivated).
export const forgetFrozen = () => { frozen = null; };

coverUnder({ hide: (hidden) => (hidden ? kulisa.invoke('views:hidden', true) : showViews()), freeze, unfreeze });
