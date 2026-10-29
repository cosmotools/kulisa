// The window's handles on its shown task's panes (docs/profiles.md, the table of actions): profiles, tabs, terminals,
// the grid's layout. Each only translates to the task's own (tasks.ts), as the agent's tools do (kulisa-plugin/tools/).
import { refused } from '../../shared/result.ts';
import { handle, on } from '../ipc.ts';
import { focusWindow } from '../page-focus.ts';
import { chooseElement } from '../picker.ts';
import { copy } from '../../screenshots/main/index.ts';
import { filesIn, openFile, showFile } from '../file-links.ts';
import type { Ipc, IpcEvent } from '../ipc.ts';
import type { IpcMainInvokeEvent } from 'electron';
import type { Profile, Tab } from '../profiles.ts';
import type { OnProfile, OnTab } from '../../shared/ipc.ts';

export function registerPanes(ipc: Ipc) {
  const { at } = ipc;
  // A window's handles on the profiles of its shown task (the editor, the panes): each only translates to the
  // task's own (tasks.ts), the same the agent's tools use (kulisa-plugin/tools/). A refusal answers { error }.
  // Each names its task (renderer, tasks.ts: act): one sent just as the human switches tasks or
  // projects is refused, not done in the task shown by then.
  const noTask = { error: 'that task is not on screen' };
  const onScreen = (e: IpcEvent, key: string | null) => { const task = at(e)?.task; return task && task.key === key ? task : null; };
  // What a message carries besides naming its profile or tab (A: its arguments, from the channel's in shared/ipc.ts).
  const onProfile = <A extends OnProfile, R>(fn: (p: Profile, args: Omit<A, keyof OnProfile>) => R) => (e: IpcMainInvokeEvent, { task, profile, ...args }: A) => { const r = onScreen(e, task)?.find(profile) || noTask; return refused(r) ? r : fn(r.profile, args); };
  const onTab = <A extends OnTab, R>(fn: (p: Profile, t: Tab, args: Omit<A, keyof OnTab>) => R) => (e: IpcMainInvokeEvent, { task, profile, tab, ...args }: A) => { const r = onScreen(e, task)?.findTab(profile, tab) || noTask; return refused(r) ? r : fn(r.profile, r.tab, args); };
  handle('profile:close', (e, { task, profile }) => onScreen(e, task)?.closeProfile(profile) || noTask);
  handle('profile:open', (e, { task, profile }) => onScreen(e, task)?.openProfile(profile) || noTask);
  // Let go by the task's project (projects.ts, askDropProfile): Remove from Project… in its pane's menu.
  handle('profile:delete', (e, { task, profile }) => onScreen(e, task)?.deleteProfile(profile, 'human') || noTask);
  handle('layout:load', (e, { task }) => onScreen(e, task)?.store.layout());
  // A profile's master, to sign in to (master.ts), and its cookies brought to this task's copy (tasks.ts).
  handle('profile:master', (e, { task, profile }) => onScreen(e, task)?.openMaster(profile) || noTask);
  // The terminals' tabs (Terminals.tsx): + (an agent of the project, a new conversation; or a shell; own: the task's own
  // agent, Ctrl+` on the folded terminals), the one in front,
  // ×, an agent's tab handed over to another agent (Task.handOver).
  handle('terminal:open', (e, { task, agent, own }) => {
    const w = onScreen(e, task);
    return !w ? noTask : own ? w.openOwn() : agent ? w.openAgent(agent) : w.openTerminal();
  });
  handle('terminal:show', (e, { task, id }) => onScreen(e, task)?.show(id) || noTask);
  handle('terminal:close', (e, { task, id }) => onScreen(e, task)?.closeTab(id) || noTask);
  handle('terminal:paste-image', (e, { task, id }) => onScreen(e, task)?.pasteImage(id));
  // The paths a terminal names, relative to the task's folder; one Ctrl+clicked, opened or shown (file-links.ts).
  handle('terminal:files', (e, { task, paths }) => { const w = onScreen(e, task); return w ? filesIn(w.folder, paths) : noTask; });
  handle('file:open', (_e, file) => openFile(file));
  handle('file:show', (_e, file) => showFile(file));
  handle('agent:new-conversation', (e, { task, id }) => onScreen(e, task)?.newConversation(id) || noTask);
  handle('agent:hand-over', (e, { task, id, agent }) => onScreen(e, task)?.handOver(id, agent) || noTask);
  on('layout:save', (e, { task, layout }) => at(e)?.saveLayout(task, layout));
  on('layout', (e, { task, rects }) => at(e)?.layout(task, rects));

  // A tab the human opens (+): the window keeps the keys for its address (components/grid/ProfilePane.tsx); its page taking
  // them as it loads gives them back (page-focus.ts).
  handle('tab:new', onProfile((p, { url }) => { focusWindow(p.win.webContents); return p.newTab(url || 'about:blank').id; }));
  // focus: the keyboard was in the tab's page (a key closed or switched it): it goes to the page shown next, as in Chrome.
  handle('tab:close', onTab((p, t, { focus }) => {
    if (focus) p.once('tab-closed', () => setImmediate(() => { const next = p.get(); if (next) p.focusTab(next); }));
    p.closeTab(t.id);
  }));
  handle('tab:activate', onTab((p, t, { focus }) => { p.activate(t.id); if (focus) p.focusTab(t); }));
  handle('tab:focus', onTab((p, t) => p.focusTab(t)));
  handle('tab:reopen', onProfile((p) => p.reopenTab()?.id ?? null));
  // An address from its pane's bar: the keyboard goes on into the page, as Chrome's.
  handle('tab:navigate', onTab((p, t, { url }) => { const r = p.navigate(t.id, url); p.focusTab(t); return r; }));
  handle('tab:back', onTab((p, t) => p.back(t.id)));
  handle('tab:forward', onTab((p, t) => p.forward(t.id)));
  handle('tab:reload', onTab((p, t, { ignoreCache }) => p.reload(t.id, { ignoreCache })));
  handle('tab:dialog', onTab((p, t, { dialog, ok }) => p.answerDialog(t.id, dialog, ok)));
  handle('tab:devtools', onTab((p, t) => p.toggleDevTools(t.id)));
  handle('tab:zoom', onTab((p, t, { dir }) => p.zoomSite(t.id, dir)));
  // The task's artifact is also copied for pasting; choosing an element shares Pick's picker.
  handle('tab:screenshot', async (e, { task, profile, tab, kind }) => {
    const w = at(e), owner = onScreen(e, task), r = (w && owner?.findTab(profile, tab)) || noTask;
    if (refused(r)) return r;
    try {
      const chosen = kind === 'element' ? await chooseElement(w!, r.profile, r.tab) : null;
      if (kind === 'element' && !chosen) return { file: null };
      const png = await r.profile.screenshot(r.tab, { ...chosen && { element: () => chosen }, fullPage: kind === 'full', scale: 'device', type: 'png', by: 'human' });
      const file = await owner!.saveArtifact(r.profile.id, r.tab.id, 'screenshot.png', png);
      await copy(png);
      return { file };
    } catch (err) { return { error: (err as Error).message }; }
  });

}
