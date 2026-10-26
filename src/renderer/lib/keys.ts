// Keyboard shortcuts in the window (main/keys.ts has the table and takes the keys; docs/window.md, Keys). The main
// process has to know where the keyboard is in this page to know whose a key is; it sends the commands back here, with
// the profile and tab they act on.
import { watch } from 'vue';
import { act, screenshot, store } from './store';
import { panes } from './grid';
import { shownTerm } from './terminals';
import { dialog } from './dialogs';
import { dialogsOpen } from './cover';
import type { Profile } from '../../shared/types';
import { refused } from '../../shared/result';

let zone = 'window';
let lastPane: string | null = null; // the profile whose page or pane had the keyboard last: where Ctrl+` goes back to
const zoneOf = (el: Element | null) => {
  if (dialogsOpen.value) return 'dialog'; // its keys are its own, wherever its focus is
  if (!el || el === document.body) return 'window';
  if (el.closest('.xterm')) return 'terminal';
  const pane = el.closest<HTMLElement>('[role="region"][data-profile]');
  return pane ? `pane:${pane.dataset.profile}` : 'window';
};
const report = () => {
  const z = zoneOf(document.activeElement);
  if (z.startsWith('pane:')) lastPane = z.slice('pane:'.length);
  if (z !== zone) { zone = z; kulisa.send('keys:zone', z); }
};
document.addEventListener('focusin', report);
document.addEventListener('focusout', () => setTimeout(report)); // where it went is known after the event
watch(dialogsOpen, report); // a dialog opened or closed

// The folded island: the task's agent; a task with none (its project had no default) leaves the choice to the human,
// the keyboard on the island's buttons (Terminals.vue), or its + opened.
const openOwn = async () => {
  const r = await act('terminal:open', { own: true });
  if (refused(r) || !('none' in r)) return;
  const first = document.querySelector<HTMLElement>('[data-testid="launchers"] button');
  if (first) first.focus(); else document.getElementById('termUnfold')?.click();
};
// A task's tab in the tasks' bar shown, as a click on it does (TaskTab.vue).
const showTask = (tab?: Element) => { const key = (tab as HTMLElement | undefined)?.dataset.task; if (key && key !== store.current) void kulisa.invoke('task:show', key); };
interface Command { n?: number; page?: boolean; p?: Profile; tab?: string }
// What each command does. page: the key was typed in the profile's page, so the keyboard stays in its pages.
const run: Record<string, (c: Command) => unknown> = {
  'terminal.focus': () => (!store.terminals.list.length ? openOwn() : zone === 'terminal' && lastPane ? focusPage(lastPane) : shownTerm()?.focus()),
  'terminal.new': () => act('terminal:open'),
  'task.n': ({ n }) => showTask(document.querySelectorAll('#projectTabs [data-task]')[n! - 1]),
  'task.next': () => stepTask(1),
  'task.previous': () => stepTask(-1),
  'task.new': () => kulisa.invoke('task:new'),
  'task.menu': () => document.getElementById('sidebarToggle')?.click(), // the sidebar over the grid, or back
  shortcuts: async () => (await dialog('shortcuts')).showShortcuts(),
  'tab.new': ({ p }) => panes.get(p!.id)?.newTab(),
  'tab.close': ({ p, tab, page }) => act('tab:close', { profile: p!.id, tab, focus: page }),
  'tab.reopen': ({ p }) => act('tab:reopen', { profile: p!.id }),
  'tab.address': ({ p }) => panes.get(p!.id)?.focusAddress(),
  'tab.reload': ({ p, tab }) => act('tab:reload', { profile: p!.id, tab }),
  'tab.reloadAll': ({ p, tab }) => act('tab:reload', { profile: p!.id, tab, ignoreCache: true }),
  'tab.back': ({ p, tab }) => act('tab:back', { profile: p!.id, tab }),
  'tab.forward': ({ p, tab }) => act('tab:forward', { profile: p!.id, tab }),
  'tab.next': (c) => toTab(c, (i, n) => (i + 1) % n),
  'tab.previous': (c) => toTab(c, (i, n) => (i - 1 + n) % n),
  'tab.n': (c) => toTab(c, (_i, n) => (c.n! <= n ? c.n! - 1 : -1)),
  'tab.last': (c) => toTab(c, (_i, n) => n - 1),
  // As a click on Pick: off on an empty tab; again cancels.
  pick: ({ p }) => document.querySelector<HTMLButtonElement>(`[role="region"][data-profile="${CSS.escape(p!.id)}"] [aria-label="Pick an element"]`)?.click(),
  screenshot: ({ p }) => screenshot(p!.id, 'element'),
};
// The bar's tasks, in its order.
function stepTask(dir: number) {
  const all = [...document.querySelectorAll<HTMLElement>('#projectTabs [data-task]')];
  const i = all.findIndex((t) => t.dataset.task === store.current);
  if (all.length > 1) showTask(all[(i + dir + all.length) % all.length]);
}
function toTab({ p, tab, page }: Command, to: (i: number, n: number) => number) {
  const i = to(p!.tabs.findIndex((t) => t.id === tab), p!.tabs.length);
  if (p!.tabs[i] && p!.tabs[i].id !== tab) void act('tab:activate', { profile: p!.id, tab: p!.tabs[i].id, focus: page });
}
const focusPage = (id: string) => { const p = store.profiles.find((x) => x.id === id); if (p) void act('tab:focus', { profile: id, tab: p.active }); };

kulisa.on('command', ({ id, n, profile, tab, task, page }) => {
  if (task !== store.current || !run[id]) return; // a key typed as another task was coming
  const p = profile ? store.profiles.find((x) => x.id === profile) : undefined;
  if (profile && (!p || !panes.get(profile))) return;
  if (page) lastPane = profile!;
  run[id]({ n, page, p, tab: tab || p?.active || undefined });
});
