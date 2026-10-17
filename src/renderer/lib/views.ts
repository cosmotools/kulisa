// The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"): they stay
// hidden while a dialog is open or the grid is not laid out yet (store.loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top. The menus and dialogs themselves: cover.ts.
import { watch } from 'vue';
import { store } from './store';
import { scheduleLayout } from './grid';
import { coverUnder, dialogsOpen } from './cover';

// A menu or a drag too (frozen): the pages stay pictures until it ends (unfreeze); a task's slide ending under a menu
// showed them over it.
const viewsCovered = () => dialogsOpen.value > 0 || store.loading || store.newTab || !!frozen; // a new tab: the task under it
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered());

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
export function freeze() {
  return (frozen ??= kulisa.invoke('views:hidden', true, { snapshots: true }).then((pics) => { store.pictures = pics || {}; }));
}
export async function unfreeze() {
  if (!frozen) return;
  const f = frozen; frozen = null;
  await f;
  if (frozen) return; // a new drag or menu began meanwhile
  await livePages();
}
// The pages live again in place of their pictures, unless a menu or a drag has them (it does so when it ends).
export async function livePages() {
  if (frozen) return;
  store.pictures = {};
  await showViews();
  scheduleLayout();
}
// A grid leaving: a freeze under way no longer matters (grid.ts, grid:closing).
export const forgetFrozen = () => { frozen = null; };

watch(() => store.newTab, () => void showViews());
coverUnder({ hide: (hidden) => void (hidden ? kulisa.invoke('views:hidden', true) : showViews()), freeze, unfreeze });
