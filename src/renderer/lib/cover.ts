// Menus and dialogs over a page: one menu at a time, as the OS's; every layer closed at once (a grid taken down, the
// window left). What lies under them is the page's own: in a tasks' window the profiles' native views, which draw
// above its HTML (views.ts plugs them in: under); Settings' window has none (docs/ui.md, Menus and dialogs).
//   covered('hide')       a dialog's open state (v-model:open of Reka's Dialog)
//   covered('pictures')   a menu's; ready once what is under it allows it to show (pictures of the pages)
import { computed, shallowRef } from 'vue';

// The dialogs open now (the keys are theirs then: keys.ts).
export const dialogsOpen = shallowRef(0);
const dialogs = new Set<() => void>(), menus = new Set<() => void>();

// What a page has under its menus and dialogs: hidden while a dialog is open; still while a menu is (frozen).
interface Under { hide(hidden: boolean): void; freeze(): Promise<void>; unfreeze(): Promise<void> }
let under: Under | null = null;
export const coverUnder = (u: Under) => { under = u; };

// Opened at once, as Reka expects (a right-click menu takes the pointer's place in the same turn); what is under it
// follows. However it closes (Esc, a click outside, a choice, the window), that comes back.
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
        under?.hide(v);
      } else if (v) {
        if (under) void under.freeze().then(() => { ready.value = open.value; }); else ready.value = true;
      } else { ready.value = false; if (!menus.size) void under?.unfreeze(); } // not when another menu has opened already
    },
  });
  return { open: model, ready };
}
const closeMenus = () => { for (const close of [...menus]) close(); };
export const closeLayers = () => { closeMenus(); for (const close of [...dialogs]) close(); };
// Leaving the window closes a menu, as the OS's own menus close.
addEventListener('blur', closeMenus);
