// The profiles' pages are native views above the window's HTML (docs/ui.md): they stay
// hidden while a dialog is open or the grid is not laid out yet (the task loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top. The menus and dialogs themselves: cover.ts.
import { taskStore } from './state';
import { coverUnder, dialogsShown } from '../lib/cover';

// A menu or a drag too (frozen): the pages stay pictures until it ends (unfreeze), or the next task's grid shown under a
// menu would show them over it.
const viewsCovered = () => dialogsShown() > 0 || !!frozen;
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered());

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
  owner.setState({ pictures: {} });
  await showViews();
}
// A task switch forgets a capture still in progress (controller.ts).
export const forgetFrozen = () => { frozen = null; };

coverUnder({ hide: (hidden) => (hidden ? kulisa.invoke('views:hidden', true) : showViews()), freeze, unfreeze });
