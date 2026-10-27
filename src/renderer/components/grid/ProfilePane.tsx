// A profile's pane, as a Chrome window, and its header in the grid (docs/profiles.md; docs/window.md, The grid). The
// page itself is a native view the main process lays over the content box (lib/grid.ts tells it where); while a panel is
// dragged or a menu is open, a picture of the page stands in for it. The pages draw above the window's HTML, so the
// pane's and its header's hints are the OS's (title), not Fluent's Tooltip, which a page under it would cover.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { Avatar, Badge, Button, Caption1, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Image, Input, Overflow, OverflowItem,
  Tab, TabList, Text, ToggleButton, Toolbar, ToolbarButton, useIsOverflowItemVisible } from '@fluentui/react-components';
import { AddRegular, ArrowClockwiseRegular, ArrowLeftRegular, ArrowRightRegular, CursorHoverFilled, CursorHoverRegular, DismissRegular, GlobeFilled,
  GlobeRegular, LockClosedRegular, MoreHorizontalRegular, MoreVerticalRegular, bundleIcon } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { act, screenshot, store, togglePick, useWindow } from '../../lib/store';
import { avatarSrc, keyText, withKeys } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes, scheduleLayout } from '../../lib/grid';
import { Grow, useStrip } from '../../lib/strip';
import { openSettings } from '../../lib/settings';
import { deleteProfile } from '../../lib/profiles';
import css from './ProfilePane.module.css';

const profileOf = (panel: string) => panel.slice('profile:'.length);
const useProfile = (id: string) => useWindow((s) => s.profiles.find((p) => p.id === id));
// The same now, for what acts: its active tab's id.
const activeOf = (id: string) => store.getState().profiles.find((p) => p.id === id)?.active ?? '';
// An address as Chrome shows it in the omnibox when not editing: no http(s)://, no www., no lone trailing /.
const fullUrl = (u = '') => (u === 'about:blank' ? '' : u);
const shortUrl = (u?: string) => fullUrl(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^([^/?#]+)\/$/, '$1');
// Nothing to pick or take on an empty tab.
const blank = (u?: string) => !fullUrl(u);
// Filled when chosen, as Fluent's tabs and toggles show it.
const Globe = bundleIcon(GlobeFilled, GlobeRegular), PickIcon = bundleIcon(CursorHoverFilled, CursorHoverRegular);
// The tests' handle on a tab's icon, on its slot: a bundled icon is two.
const TAB_ICON = { 'data-testid': 'tab-icon' };

export function ProfilePane({ api }: IDockviewPanelProps) {
  const id = profileOf(api.id), profile = useProfile(id);
  const picking = useWindow((s) => !!s.picking[id]), picture = useWindow((s) => s.pictures[id]);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const addr = useRef<HTMLInputElement>(null), strip = useRef<HTMLDivElement>(null);
  const typeInto = useRef<string | null>(null), clickedIn = useRef(false);
  const active = profile?.tabs.find((t) => t.id === profile.active);
  useStrip(strip, profile?.active);
  const tab = () => activeOf(id);

  // A tab the human opened (+, New tab, Ctrl+T): the address gets the focus once the tab is the active one, as in
  // Chrome (here, or in newTab when the state came first). The address: shown short unless being edited; getting the
  // focus shows the whole address, selected; a click while editing places the caret, a drag selects. Enter goes there.
  // editing: what is typed while it has the focus; selectAll: the whole selected once it shows it.
  const [editing, setEditing] = useState<string | null>(null), selectAll = useRef(false);
  useEffect(() => {
    if (typeInto.current && typeInto.current === active?.id) { typeInto.current = null; addr.current?.focus(); }
  }, [active?.id]);
  useLayoutEffect(() => { if (selectAll.current) { selectAll.current = false; addr.current?.select(); } });
  const addrFocus = () => {
    selectAll.current = true;
    setEditing(fullUrl(store.getState().profiles.find((p) => p.id === id)?.tabs.find((t) => t.id === tab())?.url));
  };
  const addrDown = () => { clickedIn.current = document.activeElement !== addr.current; };
  const addrUp = (e: MouseEvent) => {
    const a = addr.current!;
    if (clickedIn.current && a.selectionStart === a.selectionEnd) { e.preventDefault(); a.select(); }
    clickedIn.current = false;
  };
  const go = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    void act('tab:navigate', { profile: id, tab: tab(), url: editing ?? '' });
    addr.current!.blur();
  };

  // What the window does with this pane (lib/keys.ts: New tab, the address, Pick by their keys).
  useEffect(() => {
    if (!content) return;
    const handle = {
      content,
      focusAddress() { addr.current?.focus(); addr.current?.select(); },
      async newTab() {
        const r = await act('tab:new', { profile: id });
        typeInto.current = typeof r === 'string' ? r : null;
        if (typeInto.current && typeInto.current === activeOf(id)) { typeInto.current = null; addr.current?.focus(); }
      },
      // As a click on Pick: off on an empty tab; again cancels.
      pick() {
        const p = store.getState().profiles.find((x) => x.id === id), url = p?.tabs.find((t) => t.id === p.active)?.url;
        if (store.getState().picking[id] || !blank(url)) void togglePick(id);
      },
    };
    panes.set(id, handle);
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(content);
    scheduleLayout();
    return () => { observer.disconnect(); if (panes.get(id) === handle) panes.delete(id); };
  }, [id, content]);

  // The tab strip: a tab is chosen on the press, as in Chrome (not on its ×); the arrows move between them and Enter
  // chooses (Fluent's TabList). A tab opened grows in, and the active tab is kept in sight (lib/strip.ts, with the
  // wheel and the faded edges). Tabs are kept by id: an element stays as its tab does.
  const activate = (t: string) => { if (t !== tab()) void act('tab:activate', { profile: id, tab: t }); };
  const pressTab = (t: string) => (e: PointerEvent) => { if (e.button === 0) activate(t); };
  const closeTab = (t: string) => (e: MouseEvent) => { e.stopPropagation(); void act('tab:close', { profile: id, tab: t }); };
  // A tab's right-click menu (the strip's: for the tab it was on).
  function tabMenu(e: globalThis.MouseEvent): MenuItem[] | null {
    const t = (e.target as Element).closest<HTMLElement>('[data-tab]')?.dataset.tab, p = store.getState().profiles.find((x) => x.id === id);
    if (!t || !p) return null;
    const url = p.tabs.find((x) => x.id === t)?.url;
    return [
      { label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: id, tab: t }) },
      { label: 'Duplicate', run: () => act('tab:new', { profile: id, url }) },
      '-',
      { label: 'Close tab', keys: keyText('tab.close'), run: () => act('tab:close', { profile: id, tab: t }) },
      { label: 'Close other tabs', enabled: p.tabs.length > 1,
        run: () => { for (const x of p.tabs) if (x.id !== t) void act('tab:close', { profile: id, tab: x.id }); } },
    ];
  }

  // The active tab's alert or confirm (profiles.ts), over a picture of its page, as Chrome shows it: not modal (the
  // other panes and the rest of the window go on), in the pane. The human's answer goes back when they close it (OK,
  // Cancel, Esc; a click outside does nothing), not when it goes for them (answered by the agent, the page gone: the
  // state has it no more). One answered is not shown again by a state sent before the answer arrived. OK has the
  // keyboard, as in Chrome.
  const [answered, setAnswered] = useState<number | null>(null);
  const dialog = active?.dialog && active.dialog.id !== answered ? active.dialog : null;
  const answer = (ok: boolean) => {
    if (!dialog) return;
    setAnswered(dialog.id);
    void act('tab:dialog', { profile: id, tab: tab(), dialog: dialog.id, ok });
  };

  if (!profile) return null;
  const run = (channel: 'tab:back' | 'tab:forward' | 'tab:reload') => () => void act(channel, { profile: id, tab: tab() });
  return <div className={css.pane} role="region" aria-label={profile.name} data-profile={id}>
    <nav className={css.tabs} aria-label="Tabs">
      <RightClickMenu items={tabMenu}>
        <TabList ref={strip} appearance="filled-circular" size="small" reserveSelectedTabSpace={false} selectedValue={profile.active ?? undefined}
          onTabSelect={(e, d) => { if (!('detail' in e && e.detail > 0)) activate(String(d.value)); }}>
          {profile.tabs.map((t) => <Grow key={t.id}><Tab value={t.id} data-tab={t.id} aria-label={t.title || t.url || 'New tab'} title={t.url}
            onPointerDown={pressTab(t.id)}
            icon={{ ...TAB_ICON, children: t.favicon ? <img className={css.favicon} alt="" src={t.favicon} /> : <Globe /> }}>
            <span className={css.label}>
              {/* Text sets a weight of its own: the chosen tab's, as Fluent's Tab sets its label's */}
              <span className={css.title}><Text truncate wrap={false} block weight={t.id === profile.active ? 'semibold' : 'regular'}>{t.title || t.url || 'New tab'}</Text></span>
              {/* Not a press on the tab: it is not chosen first. */}
              <span className={css.close}><Button as="a" appearance="subtle" size="small" icon={<DismissRegular />} aria-label="Close tab" title="Close tab" tabIndex={-1}
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }} onClick={closeTab(t.id)} /></span>
            </span>
          </Tab></Grow>)}
        </TabList>
      </RightClickMenu>
      <Button appearance="subtle" size="small" icon={<AddRegular />} title={withKeys('New tab', 'tab.new')} aria-label="New tab" onClick={() => void panes.get(id)?.newTab()} />
    </nav>
    {/* A narrow pane gives up Back and Forward, then Reload (into ⋮; their keys stay), never Pick or ⋮: in order, else
        the buttons at the end go out of reach first. The address is no item (it shrinks): padding keeps its room. */}
    <Overflow padding={ADDRESS_ROOM}>
      <Toolbar aria-label="Page">
        {/* one item: Back without Forward would be half a pair */}
        <OverflowItem id="nav" priority={0}>
          <span className={css.group}>
            <ToolbarButton icon={<ArrowLeftRegular />} title={withKeys('Back', 'tab.back')} aria-label="Back"
              disabledFocusable={!active?.canBack} onClick={run('tab:back')} />
            <ToolbarButton icon={<ArrowRightRegular />} title={withKeys('Forward', 'tab.forward')} aria-label="Forward"
              disabledFocusable={!active?.canFwd} onClick={run('tab:forward')} />
          </span>
        </OverflowItem>
        <OverflowItem id="reload" priority={1}>
          <ToolbarButton icon={<ArrowClockwiseRegular />} title={withKeys('Reload', 'tab.reload')} aria-label="Reload" onClick={run('tab:reload')} />
        </OverflowItem>
        <span className={css.address}><Input ref={addr} appearance="filled-darker" size="small" aria-label="Address" spellCheck={false}
          value={editing ?? shortUrl(active?.url)} onChange={(_, d) => setEditing(d.value)}
          onKeyDown={go} onFocus={addrFocus} onBlur={() => setEditing(null)} onMouseDown={addrDown} onMouseUp={addrUp} /></span>
        {/* The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it. */}
        {active && active.zoom !== 1 && <OverflowItem id="zoom" pinned>
          <Button appearance="subtle" size="small" title="This site's zoom in this profile (Ctrl + / − / 0 in the page). Click to reset."
            onClick={() => void act('tab:zoom', { profile: id, tab: tab(), dir: 0 })}>{Math.round(active.zoom * 100)}%</Button>
        </OverflowItem>}
        {/* Pick needs a page to point at: off on an empty tab, unless picking already. */}
        <OverflowItem id="pick" pinned>
          <ToggleButton appearance="subtle" icon={<PickIcon />} checked={picking} aria-label="Pick an element"
            title={withKeys('Pick an element on the page to mention it to the agent (again or Esc: cancel)', 'pick')}
            disabledFocusable={!picking && blank(active?.url)} onClick={() => void togglePick(id)} />
        </OverflowItem>
        <More id={id} />
      </Toolbar>
    </Overflow>
    <div ref={setContent} className={css.content} data-dimmed={dialog ? '' : undefined} data-testid="page"
      style={{ '--picture': dialog?.picture ? `url(${JSON.stringify(dialog.picture)})` : 'none' } as CSSProperties}>
      {content && <Dialog open={!!dialog} modalType="non-modal" onOpenChange={(_, d) => { if (!d.open) answer(false); }}>
        <DialogSurface mountNode={content}>
          <DialogBody>
            <DialogTitle as="h2">{dialog?.from}</DialogTitle>
            <DialogContent><span className={css.message}>{dialog?.message}</span></DialogContent>
            <DialogActions>
              {dialog?.type === 'confirm' && <Button onClick={() => answer(false)}>Cancel</Button>}
              <Button appearance="primary" autoFocus onClick={() => answer(true)}>OK</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>}
      {picture && <div className={css.snapshot}><Image data-testid="snapshot" alt="" src={picture} fit="cover" /></div>}
    </div>
  </div>;
}

// What the bar keeps besides its items: the address's least width (about a host's name), its margins, the gaps and the
// bar's padding (the container's width counts it).
const ADDRESS_ROOM = 90 + 8 + 12 + 16;

// ⋮ at the end of the bar, as Chrome's: what a pane does less often; and the buttons the bar has given up. Screenshot's
// kinds are rows under its heading, one click away. In a span: ButtonMenu's trigger takes no OverflowItem.
function More({ id }: { id: string }) {
  const nav = !useIsOverflowItemVisible('nav'), reload = !useIsOverflowItemVisible('reload'), tab = () => activeOf(id);
  const more = (): MenuItem[] => {
    const t = store.getState().profiles.find((p) => p.id === id)?.tabs.find((x) => x.id === tab()), off = blank(t?.url);
    const given: MenuItem[] = [
      ...nav ? [{ label: 'Back', keys: keyText('tab.back'), enabled: !!t?.canBack, run: () => act('tab:back', { profile: id, tab: tab() }) },
        { label: 'Forward', keys: keyText('tab.forward'), enabled: !!t?.canFwd, run: () => act('tab:forward', { profile: id, tab: tab() }) }] : [],
      ...reload ? [{ label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: id, tab: tab() }) }] : [],
    ];
    return [...given, ...given.length ? ['-' as const] : [],
      { heading: 'Screenshot' },
      { label: 'Element', keys: keyText('screenshot'), enabled: !off, run: () => screenshot(id, 'element') },
      { label: 'Visible Part', enabled: !off, run: () => screenshot(id, 'visible') },
      { label: 'Full Page', enabled: !off, run: () => screenshot(id, 'full') },
      '-',
      { label: 'DevTools', keys: keyText('devtools.tab'), run: () => act('tab:devtools', { profile: id, tab: tab() }) }];
  };
  return <OverflowItem id="more" pinned>
    <span className={css.more}>
      <ButtonMenu items={more} end>
        <ToolbarButton icon={<MoreVerticalRegular />} title="More: Screenshot, DevTools" aria-label="More" />
      </ButtonMenu>
    </span>
  </OverflowItem>;
}

// A profile's panel's header: its picture and name, what the agent does in it (or that it is paused on a sign-in
// page), its menu (⋯, and a right-click on the header), ×.
export function ProfileHeader({ api }: IDockviewPanelHeaderProps) {
  const id = profileOf(api.id), profile = useProfile(id);
  const caption = useWindow((s) => s.captions[id] || '');
  const menu = (): MenuItem[] => [
    { label: 'New tab', keys: keyText('tab.new'), run: () => panes.get(id)?.newTab() },
    { label: 'About this profile…', run: () => openSettings('profiles', id) },
    { label: 'Sign In to Master…', run: () => act('profile:master', { profile: id }) },
    { label: 'Close profile', run: () => act('profile:close', { profile: id }) },
    '-',
    { label: 'Remove from Project…', run: () => deleteProfile(id) },
  ];
  return <RightClickMenu items={() => (profile ? menu() : null)}><div className={css.header} data-panel={api.id}>
    {profile && <>
      <Avatar size={20} image={{ src: avatarSrc(profile.avatar) }} aria-hidden />
      <span className={css.name}><Text weight="semibold" truncate wrap={false} block data-testid="profile-name"
        title={[profile.name, profile.description].filter(Boolean).join('\n')}>{profile.name}</Text></span>
      <span className={css.caption}><Caption1 role="status" truncate wrap={false} block>
        {profile.signinMode ? <Badge appearance="tint" color="warning" icon={<LockClosedRegular />}>Sign-in page · agent paused</Badge> : caption}</Caption1></span>
      <ButtonMenu items={menu} end>
        <Button appearance="subtle" size="small" icon={<MoreHorizontalRegular />} title="Profile" aria-label="Profile menu" />
      </ButtonMenu>
      <Button appearance="subtle" size="small" icon={<DismissRegular />} title="Close profile: its tabs go, its sign-ins stay (open it again in Profiles)"
        aria-label="Close profile" onClick={() => void act('profile:close', { profile: id })} />
    </>}
  </div></RightClickMenu>;
}
