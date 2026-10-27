// The window's menus (docs/ui.md, Menus), on shadcn's DropdownMenu, their rows from lib/menu.ts: a button's, an area's
// right-click menu at the pointer (its rows for what was right-clicked), one at a point (PointMenu.tsx). Radix keeps
// the desktop's rules but four, kept here: a row is chosen with the left button only; closed, a menu gives the keyboard
// back where it was before it opened (the terminal, a field), not to its button; the page's blur does not close it
// (lib/cover.ts closes it as the window is left); and not modal, so a press outside it closes it and acts there,
// another menu opening right from this one, as a menu bar's. A right-click's menu is a DropdownMenu at the pointer, not
// ContextMenu, whose open state is Radix's own and closes on that blur. What is under a menu (pictures of the pages):
// lib/cover.ts. Gone at once as it closes, not faded: a fading menu keeps the keyboard, taking it back from a dialog its
// row opened under the pointer, and takes the next Esc.
import { createElement, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactElement,
  type ReactNode } from 'react';
import { CircleIcon, Trash2Icon } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@ui';
import { avatarSrc } from '../lib/common';
import { menuAt } from '../lib/menu';
import { ProjectIcon } from './ProjectIcon';
import { agentMark } from './AgentMark';
import type { MenuItem as Item, MenuRow } from '../lib/menu';

export type { Item };

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
function Row({ it, close }: { it: MenuRow; close: () => void }) {
  const [hot, setHot] = useState(false);
  const remove = () => { close(); void it.remove!.run(); };
  const onKeyDown = (e: KeyboardEvent) => { if (it.remove && e.key === 'Delete') { e.preventDefault(); remove(); } };
  return <DropdownMenuItem aria-label={it.label} disabled={it.enabled === false || !it.run} title={it.title} onSelect={() => void it.run?.()}
    onPointerUp={leftOnly} onKeyDown={onKeyDown} onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
    onFocus={() => setHot(true)} onBlur={() => setHot(false)}>
    {mark(it)}
    {it.sub ? <span className="flex flex-col"><span>{it.label}</span><span className="text-xs text-muted-foreground">{it.sub}</span></span> : it.label}
    {it.remove ? <span className={hot ? 'ms-auto' : 'invisible ms-auto'}><Button variant="ghost" size="icon-xs" aria-label={it.remove.label}
      title={it.remove.label} tabIndex={-1} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(); }}><Trash2Icon /></Button></span>
      : it.keys && <DropdownMenuShortcut>{it.keys}</DropdownMenuShortcut>}
  </DropdownMenuItem>;
}

// The rows of a menu (lib/menu.ts). A submenu is a menu of its own at its row's side, opened on hover; its row's run
// makes a click on the row itself act, closing the menu.
function Rows({ items, close }: { items: Item[]; close: () => void }) {
  return items.map((it, i) => {
    if (it === '-') return <DropdownMenuSeparator key={i} />;
    if ('heading' in it) return <DropdownMenuLabel key={i}>{it.icon && createElement(it.icon)}{it.heading}</DropdownMenuLabel>;
    if ('component' in it) return createElement(it.component, { key: i, close });
    if ('submenu' in it) {
      return <DropdownMenuSub key={i}>
        <DropdownMenuSubTrigger aria-label={it.submenu} onPointerUp={leftOnly}
          onClick={it.run && ((e) => { if (e.button === 0) { close(); void it.run!(); } })}>
          {it.project && <ProjectIcon p={it.project} size={16} />}{it.submenu}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent><Rows items={it.items} close={close} /></DropdownMenuSubContent>
      </DropdownMenuSub>;
    }
    return <Row key={i} it={it} close={close} />;
  });
}

// Radix closes an open menu on the page's blur, which is not the window left (lib/cover.ts closes it then): a close
// asked while that blur is dispatched is not done. window.event: the one event that tells it, Radix's call carrying none.
const blurring = () => window.event?.type === 'blur' && window.event.target === window;

// The keyboard moving elsewhere in the window (its page getting it back puts it in the terminal; a dialog a row opened)
// leaves a menu as it is: a press closes it, or Esc, or leaving the window.
const keep = (e: Event) => e.preventDefault();

// A menu's open state, its rows built as it opens. Closed, the keyboard goes back where it was before it opened, unless
// it went elsewhere meanwhile (a dialog the row opened, a field).
function useMenu() {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Item[]>([]);
  const before = useRef<Element | null>(null);
  const show = useCallback((r: Item[]) => { before.current = document.activeElement; setRows(r); setOpen(true); }, []);
  const close = useCallback(() => { if (!blurring()) setOpen(false); }, []);
  const onCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    const was = before.current, at = document.activeElement;
    before.current = null;
    if (was instanceof HTMLElement && was.isConnected && was !== document.body && (at === document.body || at?.closest('[role="menu"]'))) was.focus();
  }, []);
  return { open, rows, show, close, onCloseAutoFocus };
}

// A menu is as wide as its rows (w-auto), at least a button's. A button's menu. children: the button (Radix opens it on the press, and a press, a drag to a row and the release
// there chooses it); items: built as it opens; end: its end edge at the button's (at a bar's end).
export function ButtonMenu({ items, children, end }: { items: () => Item[]; children: ReactElement; end?: boolean }) {
  const m = useMenu();
  return <DropdownMenu modal={false} open={m.open} onOpenChange={(o) => (o ? m.show(items()) : m.close())}>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    {m.open && <DropdownMenuContent align={end ? 'end' : 'start'} className="w-auto min-w-48" onCloseAutoFocus={m.onCloseAutoFocus} onFocusOutside={keep}>
      <Rows items={m.rows} close={m.close} />
    </DropdownMenuContent>}
  </DropdownMenu>;
}

// An area's right-click menu at the pointer: items(e) the rows for what was right-clicked, or null: none (and none of
// an area around it either: the right-click is this one's). Shown as the window's one menu at a point (PointMenu.tsx):
// a place inside the grid is not the window's (dockview's panels are boxes of their own for a fixed element).
export function RightClickMenu({ items, children, className }: { items: (e: globalThis.MouseEvent) => Item[] | null; children: ReactNode; className?: string }) {
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return; // an area inside has its own
    e.preventDefault();
    const r = items(e.nativeEvent);
    if (r?.length) menuAt(e.nativeEvent, r);
  };
  return <div className={className} onContextMenu={onContextMenu}>{children}</div>;
}

// A menu with no button of its own, at a point (PointMenu.tsx: a right-click's, menuAt's): its button an empty span there.
export function MenuAt({ at, items, onClosed }: { at: { x: number; y: number } | null; items: Item[]; onClosed: () => void }) {
  const m = useMenu(), { show } = m;
  useEffect(() => { if (at) show(items); }, [at, items, show]);
  const close = () => { m.close(); if (!blurring()) onClosed(); };
  return <DropdownMenu modal={false} open={m.open && !!at} onOpenChange={(o) => { if (!o) close(); }}>
    <DropdownMenuTrigger asChild><span aria-hidden className="pointer-events-none fixed" style={{ left: at?.x ?? 0, top: at?.y ?? 0 }} /></DropdownMenuTrigger>
    {m.open && <DropdownMenuContent align="start" sideOffset={0} className="w-auto min-w-48" onCloseAutoFocus={m.onCloseAutoFocus} onFocusOutside={keep}>
      <Rows items={m.rows} close={close} />
    </DropdownMenuContent>}
  </DropdownMenu>;
}
