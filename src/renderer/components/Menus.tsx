// Menus on Fluent UI's Menu, with the window's desktop rules on top (docs/ui.md, Menus): a button's menu opens on the
// press, and a press, a drag to a row and the release there chooses it; rows are chosen with the left button only; one
// menu at a time, leaving the window closes it, and a menu over the pages shows once they are pictures (lib/cover.ts).
// An area's right-click menu builds its rows for what was right-clicked; PointMenu.tsx opens one at a point.
// The open menu's list is [role="menu"][data-ready] once shown (the tests' handle).
import { cloneElement, useCallback, useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent,
  type PointerEvent, type ReactElement, type ReactNode } from 'react';
import { Avatar, Button, Menu, MenuDivider, MenuGroupHeader, MenuItem, MenuList, MenuPopover, MenuTrigger, makeStyles, tokens,
  type PositioningShorthand } from '@fluentui/react-components';
import { CircleFilled, DeleteRegular } from '@fluentui/react-icons';
import { avatarSrc } from '../lib/common';
import { ProjectIcon } from './ProjectIcon';
import { useCovered } from '../lib/cover';
import type { MenuItem as Item, MenuRow } from '../lib/menu';

export type { Item };

// A menu taller than the window has scrolls, reaching as far as its edge.
export const FIT = { autoSize: 'height', overflowBoundaryPadding: 4 } satisfies PositioningShorthand;

const useStyles = makeStyles({
  hidden: { visibility: 'hidden' },
  heading: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
});

// A row's mark at its start: its icon, a project's dot or icon, a profile's picture.
function mark(it: MenuRow) {
  const Icon = it.icon;
  if (it.avatar) return <Avatar size={16} image={{ src: avatarSrc(it.avatar) }} />;
  if (it.project) return <ProjectIcon p={it.project} size={16} />;
  if (it.color) return <CircleFilled style={{ color: it.color }} />; // a project's color, known at run time
  return Icon ? <Icon /> : undefined;
}

// A row. remove: its 🗑, shown while the pointer or the keyboard is on the row, Delete too; it runs instead of the row's
// own action, the menu closing as for any row.
function Row({ it, close }: { it: MenuRow; close: () => void }) {
  const [hot, setHot] = useState(false), styles = useStyles();
  const remove = () => { close(); void it.remove!.run(); };
  const onKeyDown = (e: KeyboardEvent) => { if (it.remove && e.key === 'Delete') { e.preventDefault(); remove(); } };
  return <MenuItem aria-label={it.label} disabled={it.enabled === false || !it.run} title={it.title} icon={mark(it)}
    subText={it.sub || undefined}
    secondaryContent={it.remove ? <Button appearance="subtle" size="small" icon={<DeleteRegular />} aria-label={it.remove.label} title={it.remove.label}
      tabIndex={-1} className={hot ? undefined : styles.hidden}
      onClick={(e) => { e.stopPropagation(); remove(); }} /> : it.keys || undefined}
    onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)}
    onKeyDown={onKeyDown} onClick={() => void it.run?.()}>{it.label}</MenuItem>;
}

// The rows of a menu (lib/menu.ts). A submenu is a menu of its own at its row's side, opened on hover; its row's run
// makes a click on the row itself act, closing the menu.
// Whether a menu's rows leave room for a mark at their start: given to its Menu (Fluent's context; on the MenuList
// within one it warns).
const hasIcons = (items: Item[]) => items.some((it) => typeof it === 'object' && ('icon' in it || 'avatar' in it || 'project' in it || 'color' in it));
function Rows({ items, close, ready = true }: { items: Item[]; close: () => void; ready?: boolean }) {
  const styles = useStyles();
  return <MenuList data-ready={ready || undefined}>{items.map((it, i) => {
    if (it === '-') return <MenuDivider key={i} />;
    if ('heading' in it) { const Icon = it.icon; return <MenuGroupHeader key={i} className={styles.heading}>{Icon && <Icon />}{it.heading}</MenuGroupHeader>; }
    if ('component' in it) { const Own = it.component; return <Own key={i} close={close} />; }
    if ('submenu' in it) {
      return <Menu key={i} positioning={FIT} hasIcons={hasIcons(it.items)}>
        <MenuTrigger disableButtonEnhancement>
          <MenuItem aria-label={it.submenu} icon={it.project ? <ProjectIcon p={it.project} size={16} /> : undefined}
            onClick={it.run && ((e: MouseEvent) => { if (e.button === 0) { close(); void it.run!(); } })}>{it.submenu}</MenuItem>
        </MenuTrigger>
        <MenuPopover><Rows items={it.items} close={close} /></MenuPopover>
      </Menu>;
    }
    return <Row key={i} it={it} close={close} />;
  })}</MenuList>;
}

// A menu's open state with what is under it (pictures of the pages: lib/cover.ts), Fluent's shown only once ready.
// Closed, the keyboard goes back where it was before it opened (the terminal, a field), unless it went elsewhere
// meanwhile: Fluent's own puts it on the menu's button.
function useMenuState() {
  const { open, setOpen, ready } = useCovered('pictures');
  const before = useRef<Element | null>(null);
  const opened = useCallback((v: boolean) => { if (v && before.current === null) before.current = document.activeElement; setOpen(v); }, [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEffect(() => {
    if (open) return;
    const was = before.current, at = document.activeElement;
    before.current = null;
    if (!(was instanceof HTMLElement) || !was.isConnected || was === document.body) return;
    if (at === document.body || at?.closest('[role="menu"], [aria-haspopup="menu"]')) {
      if (!document.querySelector('[role="menu"][data-ready]')) was.focus(); // not when another menu has it
    }
  }, [open]);
  return { open, shown: open && ready, ready, setOpen: opened, close };
}

// A button disabled but focusable (Group.tsx, Tool) opens nothing.
const off = (t: EventTarget | null) => t instanceof Element && !!t.closest('[aria-disabled="true"]');

// A button's menu. children: the button, given the press that opens it; items: built as it opens; end: its end edge at
// the button's (at a bar's end).
export function ButtonMenu({ items, children, end }: { items: () => Item[]; children: ReactElement; end?: boolean }) {
  const m = useMenuState(), [rows, setRows] = useState<Item[]>([]);
  const [pressed, setPressed] = useState(false); // opened by a press whose release is still to come
  // The release after the press that opened it: on a row, that row is chosen (press, drag, release).
  useEffect(() => {
    if (!m.open) return;
    const up = (e: globalThis.PointerEvent) => {
      if (!pressed || e.button !== 0) return;
      setPressed(false);
      const row = (e.target as Element).closest<HTMLElement>('[role^="menuitem"]');
      if (row && row.getAttribute('aria-disabled') !== 'true' && !row.hasAttribute('aria-haspopup')) row.click();
    };
    addEventListener('pointerup', up, true);
    return () => removeEventListener('pointerup', up, true);
  }, [m.open, pressed]);
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || off(e.currentTarget)) return;
    e.preventDefault();
    if (m.open) { m.setOpen(false); return; }
    setPressed(true); setRows(items()); m.setOpen(true);
  };
  const onClickCapture = (e: MouseEvent<HTMLElement>) => { if (e.detail > 0) e.stopPropagation(); };
  return <Menu open={m.shown} hasIcons={hasIcons(rows)} positioning={{ ...FIT, position: 'below', align: end ? 'end' : 'start', offset: 4 }}
    onOpenChange={(e, d) => { if (!d.open) m.close(); else if (!pressed && !off(e.target)) { setRows(items()); m.setOpen(true); } }}>
    {/* open on the press, not on the click (Enter, Space and ↓ open it as Fluent's trigger does) */}
    <MenuTrigger disableButtonEnhancement>{cloneElement(children as ReactElement<HTMLAttributes<HTMLElement>>, { onPointerDown, onClickCapture })}</MenuTrigger>
    <MenuPopover><Rows items={rows} close={m.close} ready={m.ready} /></MenuPopover>
  </Menu>;
}

// An area's right-click menu at the pointer: items(e) the rows for what was right-clicked, or null: none. Rows are
// chosen with the left button only: on Linux it opens on the press, and the release over a row must not choose it.
export function RightClickMenu({ items, children, className }: { items: (e: globalThis.MouseEvent) => Item[] | null; children: ReactNode; className?: string }) {
  const m = useMenuState(), [rows, setRows] = useState<Item[]>([]);
  return <Menu openOnContext open={m.shown} hasIcons={hasIcons(rows)} positioning={FIT} onOpenChange={(e, d) => {
    if (!d.open) return m.close();
    const r = 'nativeEvent' in e && 'clientX' in e ? items(e.nativeEvent) : e instanceof globalThis.MouseEvent ? items(e) : null;
    if (r?.length) { setRows(r); m.setOpen(true); }
  }}>
    <MenuTrigger disableButtonEnhancement><div className={className}>{children}</div></MenuTrigger>
    <MenuPopover><Rows items={rows} close={m.close} ready={m.ready} /></MenuPopover>
  </Menu>;
}

// A menu with no button or area of its own, at a point (PointMenu.tsx).
export function MenuAt({ at, items, onClosed }: { at: { x: number; y: number } | null; items: Item[]; onClosed: () => void }) {
  const m = useMenuState(), { setOpen, open } = m;
  useEffect(() => { if (at) setOpen(true); }, [at, setOpen]);
  const wasOpen = useRef(false);
  useEffect(() => { if (wasOpen.current && !open) onClosed(); wasOpen.current = open; }, [open, onClosed]);
  const target = { getBoundingClientRect: () => DOMRect.fromRect({ x: at?.x ?? 0, y: at?.y ?? 0, width: 0, height: 0 }) };
  return <Menu open={m.shown && !!at} hasIcons={hasIcons(items)} positioning={{ ...FIT, target, position: 'below', align: 'start' }} onOpenChange={(_, d) => { if (!d.open) m.close(); }}>
    <MenuPopover><Rows items={items} close={m.close} ready={m.ready} /></MenuPopover>
  </Menu>;
}
