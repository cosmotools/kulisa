// Menus on Fluent UI's Menu, with the window's desktop rules on top (docs/ui.md, Menus): a button's menu opens on the
// press, and a press, a drag to a row and the release there chooses it; rows are chosen with the left button only;
// leaving the window closes it. An area's right-click menu builds its rows for what was right-clicked.
import { cloneElement, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type PointerEvent, type ReactElement,
  type ReactNode } from 'react';
import { Avatar, Menu, MenuDivider, MenuGroupHeader, MenuItem, MenuList, MenuPopover, MenuTrigger } from '@fluentui/react-components';
import { avatarSrc } from './avatar';

export type Row = { label: string; sub?: string; avatar?: string; enabled?: boolean; run: () => unknown };
export type Item = '-' | { heading: string } | Row;

function Rows({ items, close }: { items: Item[]; close: () => void }) {
  return <MenuList>{items.map((it, i) => {
    if (it === '-') return <MenuDivider key={i} />;
    if ('heading' in it) return <MenuGroupHeader key={i}>{it.heading}</MenuGroupHeader>;
    return <MenuItem key={i} disabled={it.enabled === false} secondaryContent={it.sub}
      icon={it.avatar ? <Avatar size={16} image={{ src: avatarSrc(it.avatar) }} /> : undefined}
      onClick={() => { close(); void it.run(); }}>{it.label}</MenuItem>;
  })}</MenuList>;
}

// Leaving the window closes every menu, as the OS's own menus close (Settings' window: its page's blur is the window's).
const closers = new Set<() => void>();
addEventListener('blur', () => { for (const c of [...closers]) c(); });
function useClosedOnBlur(open: boolean, close: () => void) {
  useEffect(() => { if (!open) return; closers.add(close); return () => { closers.delete(close); }; }, [open, close]);
}

// A button's menu. children: the button, given the press that opens it; items: built as it opens.
export function ButtonMenu({ items, children, end }: { items: () => Item[]; children: ReactElement; end?: boolean }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Item[]>([]);
  const pressed = useRef(false);
  const close = useRef(() => setOpen(false)).current;
  useClosedOnBlur(open, close);
  // The release after the press that opened it: on a row, that row is chosen (press, drag, release).
  useEffect(() => {
    if (!open) return;
    const up = (e: globalThis.PointerEvent) => {
      if (!pressed.current || e.button !== 0) return;
      pressed.current = false;
      const row = (e.target as Element).closest<HTMLElement>('[role="menuitem"]');
      if (row && row.getAttribute('aria-disabled') !== 'true') row.click();
    };
    addEventListener('pointerup', up, true);
    return () => removeEventListener('pointerup', up, true);
  }, [open]);
  return <Menu open={open} positioning={end ? 'below-end' : 'below-start'}
    onOpenChange={(_, d) => { if (!d.open) setOpen(false); else if (!pressed.current) { setRows(items()); setOpen(true); } }}>
    {/* open on the press, not on the click (Enter, Space and ↓ open it as Fluent's trigger does) */}
    <MenuTrigger disableButtonEnhancement>{cloneElement(children as ReactElement<HTMLAttributes<HTMLElement>>, {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (open) { setOpen(false); return; }
        pressed.current = true; setRows(items()); setOpen(true);
      },
      onClickCapture: (e: MouseEvent<HTMLElement>) => { if (e.detail > 0) e.stopPropagation(); },
    })}</MenuTrigger>
    <MenuPopover><Rows items={rows} close={close} /></MenuPopover>
  </Menu>;
}

// An area's right-click menu at the pointer: items(e) the rows for what was right-clicked, or null: none.
export function RightClickMenu({ items, children }: { items: (e: globalThis.MouseEvent) => Item[] | null; children: ReactNode }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Item[]>([]);
  const close = useRef(() => setOpen(false)).current;
  useClosedOnBlur(open, close);
  return <Menu openOnContext open={open} onOpenChange={(e, d) => {
    if (!d.open) return setOpen(false);
    const r = 'nativeEvent' in e && 'clientX' in e ? items(e.nativeEvent) : null;
    if (r?.length) { setRows(r); setOpen(true); }
  }}>
    <MenuTrigger disableButtonEnhancement><div>{children}</div></MenuTrigger>
    <MenuPopover><Rows items={rows} close={close} /></MenuPopover>
  </Menu>;
}
