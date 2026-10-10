// The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"): they stay
// hidden while a dialog is open or the grid is not laid out yet (store.loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top.
import { store } from './store';
import { scheduleLayout } from './grid';

export const viewsCovered = () => document.querySelector('dialog[open]') !== null || store.loading;
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered());

// A dialog over the pages: they are hidden while it is open. Its close event comes in a later task; another dialog
// may be open by then.
export function showModal(dialog: HTMLDialogElement) {
  if (!dialog.dataset.covers) {
    dialog.dataset.covers = '1';
    dialog.addEventListener('close', () => { showViews(); });
  }
  kulisa.invoke('views:hidden', true);
  dialog.showModal();
}

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
export function freeze() {
  return (frozen ??= kulisa.invoke<Record<string, string>>('views:hidden', true, { snapshots: true }).then((pics) => { store.pictures = pics || {}; }));
}
export async function unfreeze() {
  if (!frozen) return;
  const f = frozen; frozen = null;
  await f;
  if (frozen) return; // a new drag began meanwhile
  store.pictures = {};
  await showViews();
  scheduleLayout();
}
// A grid taken down: a freeze under way no longer matters.
export const forgetFrozen = () => { frozen = null; };
