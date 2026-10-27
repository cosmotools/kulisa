// The window's menus (docs/ui.md, Menus), on shadcn's DropdownMenu and ContextMenu, their rows from lib/menu.ts: a
// button's, an area's right-click menu at the pointer (its rows for what was right-clicked), one at a point
// (PointMenu.tsx). Radix keeps the desktop's rules but two, kept here: a row is chosen with the left button only, and
// closed, a menu gives the keyboard back where it was before it opened (the terminal, a field), not to its button.
// What is under a menu (pictures of the pages) and closing it from outside: lib/cover.ts.
import { createElement, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactElement,
  type ReactNode } from 'react';
import { CircleIcon, Trash2Icon } from 'lucide-react';
import {
  Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@ui';
import { avatarSrc } from '../lib/common';
import { ProjectIcon } from './ProjectIcon';
import { agentMark } from './AgentMark';
import type { MenuItem as Item, MenuRow } from '../lib/menu';

export type { Item };

// A menu's parts: a button's and a point's are DropdownMenu's, a right-click's ContextMenu's (Radix keeps each in its
// own context).
const DROPDOWN = { Item: DropdownMenuItem, Separator: DropdownMenuSeparator, Label: DropdownMenuLabel, Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub, SubTrigger: DropdownMenuSubTrigger, SubContent: DropdownMenuSubContent };
const CONTEXT: typeof DROPDOWN = { Item: ContextMenuItem, Separator: ContextMenuSeparator, Label: ContextMenuLabel, Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub, SubTrigger: ContextMenuSubTrigger, SubContent: ContextMenuSubContent };
type Kit = typeof DROPDOWN;

// A row's mark at its start: its icon, a project's dot or icon, a profile's picture, an agent's mark.
function mark(it: MenuRow) {
  if (it.avatar) return <img src={avatarSrc(it.avatar)} alt="" className="size-4" />;
  if (it.project) return <ProjectIcon p={it.project} size={16} />;
  if (it.color) return <CircleIcon className="fill-current" style={{ color: it.color }} />; // a project's color, known at run time
  if (it.agent) return createElement(agentMark(it.agent));
  return it.icon ? createElement(it.icon) : undefined;
}

// On Linux a right-click menu opens on the press: the release over a row must not choose it (Radix chooses on any).
const leftOnly = (e: PointerEvent) => { if (e.button !== 0) e.preventDefault(); };

// A row. remove: its 🗑, shown while the pointer or the keyboard is on the row, Delete too; it runs instead of the row's
// own action, the menu closing as for any row.
function Row({ it, kit, close }: { it: MenuRow; kit: Kit; close: () => void }) {
  const [hot, setHot] = useState(false);
  const remove = () => { close(); void it.remove!.run(); };
  const onKeyDown = (e: KeyboardEvent) => { if (it.remove && e.key === 'Delete') { e.preventDefault(); remove(); } };
  return <kit.Item aria-label={it.label} disabled={it.enabled === false || !it.run} title={it.title} onSelect={() => void it.run?.()}
    onPointerUp={leftOnly} onKeyDown={onKeyDown} onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
    onFocus={() => setHot(true)} onBlur={() => setHot(false)}>
    {mark(it)}
    {it.sub ? <span className="flex flex-col"><span>{it.label}</span><span className="text-xs text-muted-foreground">{it.sub}</span></span> : it.label}
    {it.remove ? <span className={hot ? 'ms-auto' : 'invisible ms-auto'}><Button variant="ghost" size="icon-xs" aria-label={it.remove.label}
      title={it.remove.label} tabIndex={-1} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(); }}><Trash2Icon /></Button></span>
      : it.keys && <kit.Shortcut>{it.keys}</kit.Shortcut>}
  </kit.Item>;
}

// The rows of a menu (lib/menu.ts). A submenu is a menu of its own at its row's side, opened on hover; its row's run
// makes a click on the row itself act, closing the menu.
function Rows({ items, kit, close }: { items: Item[]; kit: Kit; close: () => void }) {
  return items.map((it, i) => {
    if (it === '-') return <kit.Separator key={i} />;
    if ('heading' in it) return <kit.Label key={i}>{it.icon && createElement(it.icon)}{it.heading}</kit.Label>;
    if ('component' in it) return createElement(it.component, { key: i, close });
    if ('submenu' in it) {
      return <kit.Sub key={i}>
        <kit.SubTrigger aria-label={it.submenu} onPointerUp={leftOnly}
          onClick={it.run && ((e) => { if (e.button === 0) { close(); void it.run!(); } })}>
          {it.project && <ProjectIcon p={it.project} size={16} />}{it.submenu}
        </kit.SubTrigger>
        <kit.SubContent><Rows items={it.items} kit={kit} close={close} /></kit.SubContent>
      </kit.Sub>;
    }
    return <Row key={i} it={it} kit={kit} close={close} />;
  });
}

// A menu's open state, its rows built as it opens. Closed, the keyboard goes back where it was before it opened, unless
// it went elsewhere meanwhile (a dialog the row opened, a field).
function useMenu() {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Item[]>([]);
  const before = useRef<Element | null>(null);
  const show = useCallback((r: Item[]) => { before.current = document.activeElement; setRows(r); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  const onCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    const was = before.current, at = document.activeElement;
    before.current = null;
    if (was instanceof HTMLElement && was.isConnected && was !== document.body && (at === document.body || at?.closest('[role="menu"]'))) was.focus();
  }, []);
  return { open, rows, show, close, onCloseAutoFocus };
}

// A menu as wide as its rows, at least a button's.
const WIDTH = 'w-auto min-w-48';

// A button's menu. children: the button (Radix opens it on the press, and a press, a drag to a row and the release
// there chooses it); items: built as it opens; end: its end edge at the button's (at a bar's end).
export function ButtonMenu({ items, children, end }: { items: () => Item[]; children: ReactElement; end?: boolean }) {
  const m = useMenu();
  return <DropdownMenu open={m.open} onOpenChange={(o) => (o ? m.show(items()) : m.close())}>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent align={end ? 'end' : 'start'} className={WIDTH} onCloseAutoFocus={m.onCloseAutoFocus}>
      <Rows items={m.rows} kit={DROPDOWN} close={m.close} />
    </DropdownMenuContent>
  </DropdownMenu>;
}

// An area's right-click menu at the pointer: items(e) the rows for what was right-clicked, or null: none (and none of
// an area around it either: the right-click is this one's).
export function RightClickMenu({ items, children, className }: { items: (e: globalThis.MouseEvent) => Item[] | null; children: ReactNode; className?: string }) {
  const m = useMenu();
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return; // an area inside has its own
    const r = items(e.nativeEvent);
    if (r?.length) m.show(r); else e.preventDefault();
  };
  return <ContextMenu onOpenChange={(o) => { if (!o) m.close(); }}>
    <ContextMenuTrigger asChild onContextMenu={onContextMenu}><div className={className}>{children}</div></ContextMenuTrigger>
    {m.open && <ContextMenuContent className={WIDTH} onCloseAutoFocus={m.onCloseAutoFocus}>
      <Rows items={m.rows} kit={CONTEXT} close={m.close} />
    </ContextMenuContent>}
  </ContextMenu>;
}

// A menu with no button or area of its own, at a point (PointMenu.tsx): its button an empty span there.
export function MenuAt({ at, items, onClosed }: { at: { x: number; y: number } | null; items: Item[]; onClosed: () => void }) {
  const m = useMenu(), { show } = m;
  useEffect(() => { if (at) show(items); }, [at, items, show]);
  return <DropdownMenu open={m.open && !!at} onOpenChange={(o) => { if (!o) { m.close(); onClosed(); } }}>
    <DropdownMenuTrigger asChild><span aria-hidden className="pointer-events-none fixed" style={{ left: at?.x ?? 0, top: at?.y ?? 0 }} /></DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={0} className={WIDTH} onCloseAutoFocus={m.onCloseAutoFocus}>
      <Rows items={m.rows} kit={DROPDOWN} close={() => { m.close(); onClosed(); }} />
    </DropdownMenuContent>
  </DropdownMenu>;
}
