// The window's menus, on shadcn's DropdownMenu, their rows from lib/menu.ts (docs/ui.md, Menus): Radix's rules but
// four, each kept where it is done.
import { createElement, useCallback, useEffect, useRef, useState, type ComponentProps, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import { Avatar, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@ui';
import { avatarSrc } from '../lib/common';
import { closePointMenu, menuAt, usePointMenu, type MenuItem, type MenuRow } from '../lib/menu';
import { ProjectIcon } from './ProjectIcon';
import { agentMark } from './AgentMark';

// A row's mark at its start: its icon, a profile's picture, an agent's mark, a project's icon.
function mark(it: MenuRow) {
  if (it.project) return <ProjectIcon p={it.project} size={16} />;
  if (it.avatar) return <Avatar className="size-4"><AvatarImage src={avatarSrc(it.avatar)} alt="" /></Avatar>;
  if (it.agent) return createElement(agentMark(it.agent));
  return it.icon ? createElement(it.icon) : undefined;
}

// On Linux a right-click menu opens on the press: the release over a row must not choose it (Radix chooses on any).
const leftOnly = (e: PointerEvent) => { if (e.button !== 0) e.preventDefault(); };

function Row({ it }: { it: MenuRow }) {
  return <DropdownMenuItem aria-label={it.label} disabled={it.enabled === false || !it.run} title={it.title} onSelect={() => void it.run?.()}
    onPointerUp={leftOnly}>
    {it.sub /* a line under its label: shadcn's Item in the row, as its examples put one in a menu (size xs: the row's padding) */
      ? <Item size="xs">{mark(it) && <ItemMedia>{mark(it)}</ItemMedia>}<ItemContent><ItemTitle>{it.label}</ItemTitle><ItemDescription>{it.sub}</ItemDescription></ItemContent></Item> : <>{mark(it)}{it.label}</>}
    {it.keys && <DropdownMenuShortcut>{it.keys}</DropdownMenuShortcut>}
  </DropdownMenuItem>;
}

// The rows of a menu (lib/menu.ts). A submenu is a menu of its own at its row's side, opened on hover.
function Rows({ items, close }: { items: MenuItem[]; close: () => void }) {
  return items.map((it, i) => {
    if (it === '-') return <DropdownMenuSeparator key={i} />;
    if ('heading' in it) return <DropdownMenuLabel key={i}>{it.icon && createElement(it.icon)}{it.heading}</DropdownMenuLabel>;
    if ('component' in it) return createElement(it.component, { key: i, close });
    if ('submenu' in it) {
      return <DropdownMenuSub key={i}>
        <DropdownMenuSubTrigger aria-label={it.submenu} onPointerUp={leftOnly}>
          {it.project && <ProjectIcon p={it.project} size={16} />}{it.submenu}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent><Rows items={it.items} close={close} /></DropdownMenuSubContent>
      </DropdownMenuSub>;
    }
    return <Row key={i} it={it} />;
  });
}

// Radix closes an open menu on the page's blur, which is not the window left (a profile's page taking the keyboard as it
// loads; lib/cover.ts closes it as the window is left): a close asked while that blur is dispatched is not done.
// window.event: the one event that tells it, Radix's call carrying none.
const blurring = () => window.event?.type === 'blur' && window.event.target === window;

// The keyboard moving elsewhere in the window (its page getting it back puts it in the terminal; a dialog a row opened)
// leaves a menu as it is: a press closes it, or Esc, or leaving the window.
const keep = (e: Event) => e.preventDefault();

// A menu's open state, its rows built as it opens. Closed, the keyboard goes back where it was before it opened (the
// terminal, a field), not to its button as Radix gives it, unless it went elsewhere meanwhile (a dialog the row opened).
function useMenu() {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<MenuItem[]>([]);
  const before = useRef<Element | null>(null);
  const show = useCallback((r: MenuItem[]) => { before.current = document.activeElement; setRows(r); setOpen(true); }, []);
  const close = useCallback(() => { if (!blurring()) setOpen(false); }, []);
  const onCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    const was = before.current, at = document.activeElement;
    before.current = null;
    if (was instanceof HTMLElement && was.isConnected && was !== document.body && (at === document.body || at?.closest('[role="menu"]'))) was.focus();
  }, []);
  return { open, rows, show, close, onCloseAutoFocus };
}

// A button's menu. children: the button (Radix opens it on the press, and a press, a drag to a row and the release there
// chooses it); items: built as it opens; end: its end edge at the button's (at a bar's end). Not modal: a press outside
// closes it and acts there, another menu opening right from this one, as a menu bar's. Its content mounted only while
// open, so it is gone at once as it closes: a fading menu keeps the keyboard, taking it back from a dialog its row
// opened under the pointer, and takes the next Esc. As wide as its rows (w-auto), at least a button's. trigger: what a
// part around it gives its button (a Tip's trigger).
export function ButtonMenu({ items, children, end, ...trigger }: { items: () => MenuItem[]; children: ReactElement; end?: boolean } & ComponentProps<typeof DropdownMenuTrigger>) {
  const m = useMenu();
  return <DropdownMenu modal={false} open={m.open} onOpenChange={(o) => (o ? m.show(items()) : m.close())}>
    <DropdownMenuTrigger asChild {...trigger}>{children}</DropdownMenuTrigger>
    {m.open && <DropdownMenuContent align={end ? 'end' : 'start'} className="w-auto min-w-48" onCloseAutoFocus={m.onCloseAutoFocus} onFocusOutside={keep}>
      <Rows items={m.rows} close={m.close} />
    </DropdownMenuContent>}
  </DropdownMenu>;
}

// An area's right-click menu at the pointer: items(e) the rows for what was right-clicked, or null: none (and none of
// an area around it either: the right-click is this one's). Shown as the window's one menu at a point (PointMenu): a
// place inside the grid is not the window's (dockview's panels are boxes of their own for a fixed element). Not
// Radix's ContextMenu, whose open state is its own and closes on the page's blur.
export function RightClickMenu({ items, children, className }: { items: (e: globalThis.MouseEvent) => MenuItem[] | null; children: ReactNode; className?: string }) {
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return; // an area inside has its own
    e.preventDefault();
    const r = items(e.nativeEvent);
    if (r?.length) menuAt(e.nativeEvent, r);
  };
  return <div className={className} onContextMenu={onContextMenu}>{children}</div>;
}

// The window's one menu at a point (lib/menu.ts, menuAt): a right-click's, a link in the terminal's, a screenshot's
// thumbnail's. Its button an empty span there.
export function PointMenu() {
  const at = usePointMenu(), m = useMenu(), { show } = m;
  useEffect(() => { if (at) show(at.items); }, [at, show]);
  const close = () => { m.close(); if (!blurring()) closePointMenu(); };
  return <DropdownMenu modal={false} open={m.open && !!at} onOpenChange={(o) => { if (!o) close(); }}>
    <DropdownMenuTrigger asChild><span aria-hidden className="pointer-events-none fixed" style={{ left: at?.x ?? 0, top: at?.y ?? 0 }} /></DropdownMenuTrigger>
    {m.open && <DropdownMenuContent align="start" sideOffset={0} className="w-auto min-w-48" onCloseAutoFocus={m.onCloseAutoFocus} onFocusOutside={keep}>
      <Rows items={m.rows} close={close} />
    </DropdownMenuContent>}
  </DropdownMenu>;
}
