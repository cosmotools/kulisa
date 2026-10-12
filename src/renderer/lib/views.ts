// The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"): they stay
// hidden while a dialog is open or the grid is not laid out yet (store.loading), and become pictures of themselves
// while a panel is dragged or a menu is open, so the HTML can be on top.
//   covered('hide')       a dialog's open state (v-model:open of Reka's Dialog): the pages hidden while it is open
//   covered('pictures')   a menu's: pictures of the pages meanwhile; ready once they are there (the menu is shown then)
import { computed, shallowRef } from 'vue';
import { store } from './store';
import { scheduleLayout } from './grid';

// The dialogs open now (the keys are theirs then: keys.ts), and how to close every layer (a grid taken down, the
// window left).
export const dialogsOpen = shallowRef(0);
const dialogs = new Set<() => void>(), menus = new Set<() => void>();
const viewsCovered = () => dialogsOpen.value > 0 || store.loading;
export const showViews = () => kulisa.invoke('views:hidden', viewsCovered());

// Opened at once, as Reka expects (a right-click menu takes the pointer's place in the same turn); the pages follow.
// However it closes (Esc, a click outside, a choice, the window), the pages come back.
export function covered(how: 'hide' | 'pictures') {
  const open = shallowRef(false), ready = shallowRef(how === 'hide');
  const close = () => { model.value = false; };
  const model = computed({
    get: () => open.value,
    set(v: boolean) {
      if (v === open.value) return;
      open.value = v;
      const set = how === 'hide' ? dialogs : menus;
      if (v) set.add(close); else set.delete(close);
      if (v && how === 'pictures') for (const other of [...menus]) if (other !== close) other(); // one menu at a time, as the OS's
      if (how === 'hide') {
        dialogsOpen.value += v ? 1 : -1;
        if (v) void kulisa.invoke('views:hidden', true); else void showViews();
      } else if (v) void freeze().then(() => { ready.value = open.value; });
      else { ready.value = false; if (!menus.size) void unfreeze(); } // not when another menu has opened already
    },
  });
  return { open: model, ready };
}
const closeMenus = () => { for (const close of [...menus]) close(); };
export const closeLayers = () => { closeMenus(); for (const close of [...dialogs]) close(); };
// Leaving the window closes a menu, as the OS's own menus close.
addEventListener('blur', closeMenus);

// Pictures of the pages for a menu or a drag; live again after.
let frozen: Promise<void> | null = null;
export function freeze() {
  return (frozen ??= kulisa.invoke<Record<string, string>>('views:hidden', true, { snapshots: true }).then((pics) => { store.pictures = pics || {}; }));
}
export async function unfreeze() {
  if (!frozen) return;
  const f = frozen; frozen = null;
  await f;
  if (frozen) return; // a new drag or menu began meanwhile
  store.pictures = {};
  await showViews();
  scheduleLayout();
}
// A grid taken down: a freeze under way no longer matters.
export const forgetFrozen = () => { frozen = null; };
