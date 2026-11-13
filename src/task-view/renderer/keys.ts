// Keyboard shortcuts in one task UI (main/keys.ts has the table and takes the keys; docs/window.md, Keys). The main
// process has to know where the keyboard is in this page to know whose a key is; it sends the commands back here, with
// the profile and tab they act on.
import { currentTask, store, act } from './state';
import { browserPanes } from './stage-panes';
import { focusDevelopmentTerminal } from './terminals';
import type { Profile } from '../../shared/types';
import { refused } from '../../shared/result';

import { zone, lastPane } from '../../layers/renderer';
const { pane, screenshot } = browserPanes;
let focusedPane: string | null = null;
// The folded terminals' panel: the task's agent; a task with none (its project had no default) leaves the choice to the
// human, the keyboard on the panel's big buttons (task-view/DevelopmentTerminals.tsx), or its + opened.
const openOwn = async () => {
  const task = currentTask();
  focusDevelopmentTerminal(task);
  const r = await act('development-terminal:open', { own: true });
  if (currentTask() !== task || refused(r) || !('none' in r)) return;
  const first = document.querySelector<HTMLElement>('[data-task-view][data-active] [data-launcher]');
  if (first) { first.focus(); return; }
  // Its menu opens on a press or a key (Radix's), not on a click
  const plus = document.querySelector<HTMLElement>('[data-task-view][data-active] [data-unfold]');
  plus?.focus();
  plus?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
};
interface Command { n?: number; page?: boolean; p?: Profile; tab?: string }
// What each command does. page: the key was typed in the profile's page, so the keyboard stays in its pages.
const run: Record<string, (c: Command) => unknown> = {
  'terminal.focus': () => (!store.getState().developmentTerminals.list.length ? openOwn() : zone === 'terminal' && (focusedPane || lastPane) ? focusPage((focusedPane || lastPane)!) : focusDevelopmentTerminal()),
  'terminal.new': async () => {
    const task = currentTask();
    const result = await act('development-terminal:open');
    if (!refused(result)) focusDevelopmentTerminal(task);
  },
  'tab.new': ({ p }) => pane(p!.id)?.newTab(),
  'tab.close': ({ p, tab, page }) => act('tab:close', { profile: p!.id, tab, focus: page }),
  'tab.reopen': ({ p }) => act('tab:reopen', { profile: p!.id }),
  'tab.address': ({ p }) => pane(p!.id)?.focusAddress(),
  'tab.reload': ({ p, tab }) => act('tab:reload', { profile: p!.id, tab }),
  'tab.reloadAll': ({ p, tab }) => act('tab:reload', { profile: p!.id, tab, ignoreCache: true }),
  'tab.back': ({ p, tab }) => act('tab:back', { profile: p!.id, tab }),
  'tab.forward': ({ p, tab }) => act('tab:forward', { profile: p!.id, tab }),
  'tab.next': (c) => toTab(c, (i, n) => (i + 1) % n),
  'tab.previous': (c) => toTab(c, (i, n) => (i - 1 + n) % n),
  'tab.n': (c) => toTab(c, (_i, n) => (c.n! <= n ? c.n! - 1 : -1)),
  'tab.last': (c) => toTab(c, (_i, n) => n - 1),
  pick: ({ p }) => pane(p!.id)?.pick(),
  screenshot: ({ p }) => screenshot(p!.id, 'element'),
};
function toTab({ p, tab, page }: Command, to: (i: number, n: number) => number) {
  const i = to(p!.tabs.findIndex((t) => t.id === tab), p!.tabs.length);
  if (p!.tabs[i] && p!.tabs[i].id !== tab) void act('tab:activate', { profile: p!.id, tab: p!.tabs[i].id, focus: page });
}
const focusPage = (id: string) => { const p = store.getState().profiles.find((x) => x.id === id); if (p) void act('tab:focus', { profile: id, tab: p.active }); };

kulisa.on('command:run', ({ id, n, profile, tab, task, page }) => {
  if (task !== currentTask() || !run[id]) return; // a key typed as another task was coming
  const p = profile ? store.getState().profiles.find((x) => x.id === profile) : undefined;
  if (profile && (!p || !pane(profile))) return;
  if (page) focusedPane = profile!;
  run[id]({ n, page, p, tab: tab || p?.active || undefined });
});
