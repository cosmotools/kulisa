// The tasks' bar (docs/window.md, The tasks' bar; docs/tasks.md, Projects): a tab per open task, in the bar's order,
// then + (a new task of the shown task's project). A tab stands for itself: its project is its icon, in the project's
// color, which also marks the shown tab (the author's choice). Every tab keeps its width whichever task is shown, so
// showing one moves none (tabs moving under the mouse make the human miss). Where a dragged tab is let go outside every
// Kulisa window, the main process says (the page does not know where the pointer is then).
import { flushSync } from 'react-dom';
import { useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@ui';
import { RightClickMenu } from './Menus';
import { BrowserTab, TabStrip } from './BrowserTabs';
import { Tip } from './Tip';
import { ProjectIcon } from './ProjectIcon';
import { AgentState } from './AgentState';
import { store, useWindow } from '../lib/store';
import { useProjectColor } from '../lib/project-color';
import { keyText, withKeys } from '../lib/common';
import { dialog } from '../lib/dialogs';
import { projectMenu } from '../lib/project-menu';
import { profilesMenu } from '../lib/profiles';
import { terminalsOf } from '../lib/terminals';
import { useStrip } from '../lib/strip';
import type { MenuItem } from '../lib/menu';
import type { ProjectEntry, TaskInfo } from '../../shared/types';

const rename = async (key: string, name: string) => (await dialog('taskrename')).rename(key, name);
// Move to New Window, Move to Window: … (one row per other window, named as it names itself: window.ts, label):
// to(null) for a new one. The only tab stays: a new window would be the same as this one.
const moveRows = (to: (id: number | null) => unknown, { enabled = true, label = 'Move to' } = {}): MenuItem[] => {
  const { projects } = store.getState();
  return [{ label: `${label} New Window`, enabled: enabled && projects.tabs.length > 1, run: () => to(null) },
    ...(projects.windows || []).map((w) => ({ label: `${label} Window: ${w.name}`, enabled, run: () => to(w.id) }))];
};
// A tab's right-click menu: the shown one's profiles, the repositories it may add or remove, Rename…, Show Folder,
// Move to Window, Close, Delete Task…; then its project's, in a submenu of its name. From what the window was last
// told (store): it opens at once.
const taskMenu = ({ key, name, repos, resources }: TaskInfo): MenuItem[] => [
  ...(key === store.getState().current ? [{ heading: 'Profiles' }, ...profilesMenu(), '-' as const] : []),
  // The project's repositories it has no copy of, one added when its work needs it (tasks.md, Tasks).
  ...(repos.length ? [{ heading: 'Add Repository' }, ...repos.map((r) => ({ label: r.split(/[\\/]/).pop()!, title: r,
    run: () => kulisa.invoke('task:add-repo', { key, repo: r }) })), '-' as const] : []),
  // Those added (removable resources), not the task's own worktree or the main tree: those are not removed here.
  ...(resources.some((r) => r.removable) ? [{ heading: 'Remove Repository' }, ...resources.filter((r) => r.removable)
    .map((r) => ({ label: r.label, title: r.folder, run: () => kulisa.invoke('task:remove-repo', { key, repo: r.folder }) })), '-' as const] : []),
  { label: 'Rename…', run: () => rename(key, name) },
  { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
  '-', ...moveRows((to) => kulisa.invoke('task:move', { key, to, terminals: terminalsOf(key) })),
  '-', { label: 'Close', run: () => kulisa.invoke('task:close', key) },
  { label: 'Delete Task…', run: () => kulisa.invoke('task:delete', key) },
];
// A project's rows (its submenu). Move All Tasks: its open tasks of this window, together.
function projectItems(p: ProjectEntry): MenuItem[] {
  const { projects } = store.getState(), id = p.id, mine = projects.tabs.filter((t) => t.project === id);
  const terminals = () => Object.assign({}, ...mine.map((t) => terminalsOf(t.key)));
  return projectMenu(p, { newTask: () => kulisa.invoke('task:new', { project: id }), keys: id === projects.project ? keyText('task.new') : undefined,
    move: moveRows((to) => kulisa.invoke('project:move-all', { id, to, terminals: terminals() }), { enabled: mine.length < projects.tabs.length, label: 'Move All Tasks to' }) });
}

// HTML drag and drop, which also crosses windows. The tab carries its task and what its terminals show (the window it
// goes to has neither), as a type of Kulisa's own: a page under the pointer takes nothing from it.
const DRAG = 'application/x-kulisa-task';

export function TaskBar() {
  const all = useWindow((s) => s.projects), current = useWindow((s) => s.current), top = useWindow((s) => s.bar === 'top');
  const projectColor = useProjectColor();
  const byId = new Map(all.projects.map((p) => [p.id, p]));
  const tabs = all.tabs.flatMap((t) => { const p = byId.get(t.project); return p ? [{ t, p }] : []; });
  const shown = tabs.find(({ t }) => t.key === current)?.p; // the +'s project
  const plus = withKeys(shown ? `New task of ${shown.name}` : 'New task', 'task.new');
  const strip = useRef<HTMLDivElement>(null);
  // More tabs than fit: the wheel scrolls them, the edges with tabs past them fade, the shown one stays in sight.
  useStrip(strip, current);

  // A press on another tab makes it the chosen one at once, as Chrome's; its task is shown when the button is let go or
  // the tab starts being dragged (pointercancel), whichever comes first: the grid's slide that showing it starts makes
  // Chromium drop the drag about to begin. The pressed tab stays lit until the window is told its task is shown (or it
  // was refused): let go of, it would go dark while the main process takes the pictures for the slide, and blink.
  const [pressed, setPressed] = useState<string | null>(null), press = useRef<string | null>(null); // the ref: Radix chooses on the press too
  if (pressed !== null && pressed === current) setPressed(null);
  // The last press's switch: done once the window has taken its grid down (grid:closing comes before the answer).
  const showing = useRef<Promise<unknown>>(Promise.resolve());
  const tabAt = (e: { target: EventTarget | null }) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-task]');
    return (el && tabs.find(({ t }) => t.key === el.dataset.task)) || null;
  };
  const onPointerDown = (e: PointerEvent) => {
    const at = e.button === 0 && !e.ctrlKey && e.pointerType === 'mouse' && !(e.target as Element).closest('[data-close]') && tabAt(e);
    if (!at || at.t.key === current) return;
    setPressed(press.current = at.t.key);
    const done = new AbortController(), show = async () => {
      done.abort();
      press.current = null;
      const r = await (showing.current = kulisa.invoke('task:show', at.t.key));
      if (r?.error) setPressed((p) => (p === at.t.key ? null : p));
    };
    for (const type of ['pointerup', 'pointercancel']) addEventListener(type, show, { signal: done.signal });
  };
  // The keyboard's choice (Enter, Space), shown at once; a press's is shown on its release.
  const onTabSelect = (key: string) => { if (key !== current && key !== press.current) void kulisa.invoke('task:show', key); };
  // The middle button on a tab closes its task, as a browser's tab.
  const onAuxClick = (e: MouseEvent) => { const at = e.button === 1 && tabAt(e); if (at) void kulisa.invoke('task:close', at.t.key); };
  // A double click: its Rename…, a shortcut to the menu's row. On a tab not shown, after its first press has shown it:
  // the grid that goes closes the dialogs open over it.
  const onDoubleClick = async (e: MouseEvent) => {
    const at = !(e.target as Element).closest('[data-close]') && tabAt(e);
    if (!at) return;
    await showing.current.catch(() => {});
    void rename(at.t.key, at.t.name);
  };
  const menu = (e: globalThis.MouseEvent): MenuItem[] | null => {
    const at = tabAt(e);
    return at && [...taskMenu(at.t), '-', { submenu: at.p.name, project: { favicon: at.p.favicon, color: projectColor(at.p) }, items: projectItems(at.p) }];
  };

  const [dragged, setDragged] = useState<string | null>(null); // the task dragged from this window
  const [mark, setMark] = useState<{ key: string; side: 'before' | 'after' } | null>(null); // where a dropped one would go
  // Where a tab let go at e goes: before or after the tab under the pointer; the index among this window's.
  const dropAt = (e: DragEvent) => {
    const tab = (e.target as Element).closest?.<HTMLElement>('[data-task]');
    if (!tab) return null;
    const r = tab.getBoundingClientRect(), side = e.clientX < r.x + r.width / 2 ? 'before' as const : 'after' as const;
    return { key: tab.dataset.task!, side, index: tabs.findIndex(({ t }) => t.key === tab.dataset.task) + Number(side === 'after') };
  };
  // The mark drawn at once, not with React's next frame: a drop that follows at once lands where it shows.
  const over = (e: DragEvent) => {
    const at = e.dataTransfer.types.includes(DRAG) && dropAt(e);
    if (!at) { setMark(null); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (mark?.key !== at.key || mark.side !== at.side) flushSync(() => setMark({ key: at.key, side: at.side }));
  };
  const drag = {
    onDragStart: (e: DragEvent) => {
      const at = tabAt(e);
      if (!at) return;
      setDragged(at.t.key);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DRAG, JSON.stringify({ key: at.t.key, terminals: terminalsOf(at.t.key) }));
    },
    // Over a tab (entered, and as the pointer moves on it): where it would go, marked.
    onDragOver: (e: DragEvent) => over(e),
    onDragEnter: (e: DragEvent) => over(e),
    onDragLeave: (e: DragEvent) => { if (!strip.current?.contains(e.relatedTarget as Node)) setMark(null); },
    onDrop: (e: DragEvent) => {
      const at = dropAt(e), data = e.dataTransfer.getData(DRAG);
      setMark(null);
      if (!at || !data) return;
      e.preventDefault();
      const { key, terminals } = JSON.parse(data);
      void kulisa.invoke('task:drop', { key, index: at.index, terminals });
    },
    // Let go where no Kulisa window took it: outside them all, it goes to a new window there (the main process checks).
    onDragEnd: (e: DragEvent) => {
      const key = dragged;
      setDragged(null);
      if (key && e.dataTransfer.dropEffect === 'none') void kulisa.invoke('task:drag-out', { key, terminals: terminalsOf(key) });
    },
  };

  return <nav id="taskbar" aria-label="Open tasks" data-top={top || undefined}
    className={top ? 'flex min-w-0 items-center gap-1 [-webkit-app-region:no-drag]' : 'flex min-w-0 max-w-full items-center gap-1 justify-self-center px-2 py-1'}>
    {/* In the title bar the tabs are no handle to drag the window by (TopBar.tsx drags after them). */}
    <RightClickMenu items={menu} className="flex min-w-0">
      <TabStrip id="taskTabs" stripRef={strip} label="Open tasks" value={pressed ?? current ?? ''} onChoose={onTabSelect}
        onPointerDown={onPointerDown} onAuxClick={onAuxClick} onDoubleClick={onDoubleClick} {...drag}>
        {tabs.map(({ t, p }) => {
          const color = projectColor(p), at = mark?.key === t.key ? mark.side : undefined;
          // Every tab keeps its width whichever is shown, so none moves under the mouse; at its narrowest about ten letters.
          return <BrowserTab key={t.key} value={t.key} data-task={t.key} data-project={p.id} draggable aria-label={t.name}
            dragging={dragged === t.key} drop={at} className="min-w-40 flex-initial basis-50"
            title={`${p.name}\n${t.branch ? `branch ${t.branch} in ${t.folder}` : `in the project's folder ${t.folder} (no git: no copy of its own)`}`}
            icon={<><ProjectIcon p={{ favicon: p.favicon, color }} size={16} /><AgentState state={t.state} /></>}
            close={{ title: 'Close the task: its agent stops, all else stays (open it again from the sidebar)', run: () => void kulisa.invoke('task:close', t.key) }}>
            {t.name}
          </BrowserTab>;
        })}
      </TabStrip>
    </RightClickMenu>
    {/* beside the +: above or under it, the tooltip would open over the pages, which cover it. It goes as the + is
        pressed, as Chrome's: the slide to the new task shows a picture of the window, the tooltip in it until it ends;
        the + takes no keyboard (its focus would show the tooltip again). */}
    <Tip text={plus} side="right">
      <Button id="newTask" variant="ghost" size="icon-sm" aria-label={plus}
        onMouseDown={(e) => e.preventDefault()} onClick={() => kulisa.invoke('task:new')}><PlusIcon /></Button>
    </Tip>
  </nav>;
}
