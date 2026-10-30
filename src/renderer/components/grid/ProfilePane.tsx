// A profile's pane, as a Chrome window, and its header in the grid (docs/profiles.md; docs/window.md, The grid). The
// page itself is a native view the main process lays over the content box (lib/grid.ts tells it where); while a panel is
// dragged or a menu is open, a picture of the page stands in for it. The pages draw above the window's HTML, so the
// pane's and its header's hints are the OS's (title): a tooltip of the window's would be covered.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { ArrowLeftIcon, ArrowRightIcon, EllipsisIcon, EllipsisVerticalIcon, GlobeIcon, LockIcon, PlusIcon, RotateCwIcon, SquareMousePointerIcon,
  XIcon } from 'lucide-react';
import { Avatar, AvatarImage, Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Toggle } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { BrowserTab, TabStrip } from '../BrowserTabs';
import { act, screenshot, store, togglePick, useWindow } from '../../lib/store';
import { avatarSrc, keyText, withKeys } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes, scheduleLayout } from '../../lib/grid';
import { grow, useStrip } from '../../lib/strip';
import { openSettings } from '../../lib/settings';
import { deleteProfile } from '../../lib/profiles';
import { EnvironmentFocus, environmentFocusItem } from './EnvironmentFocus';

const profileOf = (panel: string) => panel.slice('profile:'.length);
const useProfile = (id: string) => useWindow((s) => s.profiles.find((p) => p.id === id));
// Its active tab as the store has it now, for what acts (a handler, not a render).
const activeTab = (id: string) => { const p = store.getState().profiles.find((x) => x.id === id); return p?.tabs.find((t) => t.id === p.active); };
// An address as Chrome shows it in the omnibox when not editing: no http(s)://, no www., no lone trailing /.
const fullUrl = (u = '') => (u === 'about:blank' ? '' : u);
const shortUrl = (u?: string) => fullUrl(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^([^/?#]+)\/$/, '$1');
// Nothing to pick or take on an empty tab.
const blank = (u?: string) => !fullUrl(u);

export function ProfilePane({ api }: IDockviewPanelProps) {
  const id = profileOf(api.id), profile = useProfile(id);
  const picking = useWindow((s) => !!s.picking[id]), picture = useWindow((s) => s.pictures[id]);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const addr = useRef<HTMLInputElement>(null), strip = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLSpanElement>(null), reload = useRef<HTMLSpanElement>(null);
  const typeInto = useRef<string | null>(null), clickedIn = useRef(false);
  const active = profile?.tabs.find((t) => t.id === profile.active);
  useStrip(strip, profile?.active);
  const tab = () => activeTab(id)?.id ?? '';

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
    setEditing(fullUrl(activeTab(id)?.url));
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
        if (typeInto.current && typeInto.current === activeTab(id)?.id) { typeInto.current = null; addr.current?.focus(); }
      },
      // As a click on Pick: off on an empty tab; again cancels.
      pick() {
        if (store.getState().picking[id] || !blank(activeTab(id)?.url)) void togglePick(id);
      },
    };
    panes.set(id, handle);
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(content);
    scheduleLayout();
    return () => { observer.disconnect(); if (panes.get(id) === handle) panes.delete(id); };
  }, [id, content]);

  // The tab strip: a tab is chosen on the press, as in Chrome (not on its ×), or by Enter or Space. A tab opened grows
  // in, and the active tab is kept in sight (lib/strip.ts). Tabs are kept by id: an element stays as its tab does.
  const activate = (t: string) => { if (t !== tab()) void act('tab:activate', { profile: id, tab: t }); };
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
  // other panes and the rest of the window go on), so not a dialog layer of the window's, whose overlay would hide every
  // page (lib/cover.ts). The human's answer goes back when they close it (OK, Cancel, Esc), not when it goes for them
  // (answered by the agent, the page gone: the state has it no more). One answered is not shown again by a state sent
  // before the answer arrived.
  const [answered, setAnswered] = useState<number | null>(null);
  const dialog = active?.dialog && active.dialog.id !== answered ? active.dialog : null;
  const answer = (ok: boolean) => {
    if (!dialog) return;
    setAnswered(dialog.id);
    void act('tab:dialog', { profile: id, tab: tab(), dialog: dialog.id, ok });
  };

  if (!profile) return null;
  const run = (channel: 'tab:back' | 'tab:forward' | 'tab:reload') => () => void act(channel, { profile: id, tab: tab() });
  // ⋮: what a pane does less often, after the buttons the bar has given up (hidden by its width, below).
  const more = (): MenuItem[] => {
    const t = activeTab(id), off = blank(t?.url);
    const given: MenuItem[] = [
      ...!nav.current?.checkVisibility() ? [{ label: 'Back', keys: keyText('tab.back'), enabled: !!t?.canBack, run: run('tab:back') },
        { label: 'Forward', keys: keyText('tab.forward'), enabled: !!t?.canFwd, run: run('tab:forward') }] : [],
      ...!reload.current?.checkVisibility() ? [{ label: 'Reload', keys: keyText('tab.reload'), run: run('tab:reload') }] : [],
    ];
    return [...given, ...given.length ? ['-' as const] : [],
      { heading: 'Screenshot' },
      { label: 'Element', keys: keyText('screenshot'), enabled: !off, run: () => screenshot(id, 'element') },
      { label: 'Visible Part', enabled: !off, run: () => screenshot(id, 'visible') },
      { label: 'Full Page', enabled: !off, run: () => screenshot(id, 'full') },
      '-',
      { label: 'DevTools', keys: keyText('devtools.tab'), run: () => act('tab:devtools', { profile: id, tab: tab() }) }];
  };

  // @container: the pane's width decides which of the bar's buttons it keeps.
  return <div className="@container flex h-full min-w-0 flex-col bg-card" role="region" aria-label={profile.name} data-profile={id}>
    {/* The tabs scroll in their strip; + is next to it, never over a tab, as in Chrome. */}
    <nav aria-label="Tabs" className="flex flex-none items-center gap-1 px-2 pt-1">
      <RightClickMenu items={tabMenu} className="flex min-w-0">
        <TabStrip stripRef={strip} label="Open tabs" value={profile.active ?? ''} onChoose={activate}>
          {/* their widths: docs/ui.md, Tabs */}
          {profile.tabs.map((t) => <BrowserTab key={t.id} ref={grow} value={t.id} data-tab={t.id} aria-label={t.title || t.url || 'New tab'} title={t.url}
            className="@container w-55 min-w-16 flex-initial"
            icon={t.favicon ? <img data-testid="tab-icon" alt="" src={t.favicon} className="size-4" /> : <GlobeIcon data-testid="tab-icon" />}
            close={{ title: 'Close tab', run: () => void act('tab:close', { profile: id, tab: t.id }) }}>
            <span className="@max-[80px]:hidden">{t.title || t.url || 'New tab'}</span>
          </BrowserTab>)}
        </TabStrip>
      </RightClickMenu>
      <Button variant="ghost" size="icon-sm" title={withKeys('New tab', 'tab.new')} aria-label="New tab" onClick={() => void panes.get(id)?.newTab()}>
        <PlusIcon />
      </Button>
    </nav>
    {/* A narrow pane gives up Back and Forward, then Reload (into ⋮; their keys stay), never Pick or ⋮: in order, else
        the buttons at the end go out of reach first. The address shrinks. */}
    <div role="group" aria-label="Page" className="flex flex-none items-center gap-1 px-2 py-1">
      {/* one: Back without Forward would be half a pair */}
      <span ref={nav} className="hidden gap-1 @2xs:flex">
        <Button variant="ghost" size="icon-sm" title={withKeys('Back', 'tab.back')} aria-label="Back" disabled={!active?.canBack} onClick={run('tab:back')}>
          <ArrowLeftIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" title={withKeys('Forward', 'tab.forward')} aria-label="Forward" disabled={!active?.canFwd} onClick={run('tab:forward')}>
          <ArrowRightIcon />
        </Button>
      </span>
      <span ref={reload} className="hidden @3xs:flex">
        <Button variant="ghost" size="icon-sm" title={withKeys('Reload', 'tab.reload')} aria-label="Reload" onClick={run('tab:reload')}><RotateCwIcon /></Button>
      </span>
      <Input ref={addr} aria-label="Address" placeholder="Search Google or type a URL" spellCheck={false} className="h-7 min-w-0 flex-1"
        value={editing ?? shortUrl(active?.url)} onChange={(e) => setEditing(e.target.value)}
        onKeyDown={go} onFocus={addrFocus} onBlur={() => setEditing(null)} onMouseDown={addrDown} onMouseUp={addrUp} />
      {/* The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it. */}
      {active && active.zoom !== 1 && <Button variant="ghost" size="sm" title="This site's zoom in this profile (Ctrl + / − / 0 in the page). Click to reset."
        onClick={() => void act('tab:zoom', { profile: id, tab: tab(), dir: 0 })}>{Math.round(active.zoom * 100)}%</Button>}
      {/* Pick needs a page to point at: off on an empty tab, unless picking already. */}
      <Toggle size="sm" pressed={picking} aria-label="Pick an element" title={withKeys('Pick an element on the page to mention it to the agent (again or Esc: cancel)', 'pick')}
        disabled={!picking && blank(active?.url)} onPressedChange={() => void togglePick(id)}><SquareMousePointerIcon /></Toggle>
      <ButtonMenu items={more} end>
        <Button variant="ghost" size="icon-sm" title="More: Screenshot, DevTools" aria-label="More"><EllipsisVerticalIcon /></Button>
      </ButtonMenu>
    </div>
    {/* --picture: the page's picture under its dialog, dimmed. */}
    <div ref={setContent} data-testid="page" data-dimmed={dialog ? '' : undefined}
      className="relative flex-1 overflow-hidden bg-card data-dimmed:bg-(image:--picture) data-dimmed:bg-size-[100%_100%]"
      style={{ '--picture': dialog?.picture ? `url(${JSON.stringify(dialog.picture)})` : 'none' } as CSSProperties}>
      {dialog && <PageDialog key={dialog.id} from={dialog.from} message={dialog.message} confirm={dialog.type === 'confirm'} answer={answer} />}
      {picture && <img data-testid="snapshot" alt="" src={picture} className="absolute inset-0 size-full object-cover" />}
    </div>
  </div>;
}

// Not a Dialog: it is placed in its pane, not over the window (docs/ui.md, Dialogs), so the keyboard is kept in it here:
// OK has it, as in Chrome; Esc is Cancel; Tab stays among its buttons.
function PageDialog({ from, message, confirm, answer }: { from: string; message: string; confirm: boolean; answer: (ok: boolean) => void }) {
  const title = useId(), text = useId();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); answer(false); }
    if (e.key !== 'Tab') return;
    const buttons = [...e.currentTarget.querySelectorAll('button')], at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    buttons.at((at + (e.shiftKey ? -1 : 1)) % buttons.length)?.focus();
  };
  return <div className="absolute inset-0 backdrop-blur-xs backdrop-brightness-75">
    <Card size="sm" role="alertdialog" aria-labelledby={title} aria-describedby={text} onKeyDown={onKeyDown} className="mx-auto mt-2 w-[calc(100%-(--spacing(4)))] max-w-112.5">
      <CardHeader><CardTitle id={title}>{from}</CardTitle></CardHeader>
      <CardContent><p id={text} data-selectable className="whitespace-pre-wrap wrap-anywhere">{message}</p></CardContent>
      <CardFooter className="justify-end">
        <div className="flex gap-2">
          {confirm && <Button variant="outline" onClick={() => answer(false)}>Cancel</Button>}
          <Button autoFocus onClick={() => answer(true)}>OK</Button>
        </div>
      </CardFooter>
    </Card>
  </div>;
}

// A profile's panel's header: its picture and name, what the agent does in it (or that it is paused on a sign-in
// page), its menu (⋯, and a right-click on the header), ×. A pane narrower than its name: the name cut with …, ⋯ and ×
// kept.
export function ProfileHeader({ api, containerApi }: IDockviewPanelHeaderProps) {
  const activity = useWindow((s) => s.stageActivity === api.id);
  const id = profileOf(api.id), profile = useProfile(id);
  const caption = useWindow((s) => s.captions[id] || '');
  const menu = (): MenuItem[] => [
    { label: 'New tab', keys: keyText('tab.new'), run: () => panes.get(id)?.newTab() },
    environmentFocusItem(api),
    { label: 'About this profile…', run: () => openSettings('profiles', id) },
    { label: 'Sign In to Master…', run: () => act('profile:master', { profile: id }) },
    { label: 'Close profile', run: () => act('profile:close', { profile: id }) },
    '-',
    { label: 'Remove from Project…', run: () => deleteProfile(id) },
  ];
  return <RightClickMenu items={() => (profile ? menu() : null)} className="h-full min-w-0">
    <div className="flex h-full min-w-0 items-center gap-1.5 px-2 data-[agent-active=true]:bg-accent" data-panel={api.id} data-agent-active={activity || undefined}>
      {profile && <>
        <Avatar aria-hidden className="size-5"><AvatarImage src={avatarSrc(profile.avatar)} alt="" /></Avatar>
        <span data-testid="profile-name" className="min-w-0 flex-[0_1_auto] truncate font-medium"
          title={[profile.name, profile.description].filter(Boolean).join('\n')}>{profile.name}</span>
        <span role="status" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {profile.signinMode ? <Badge variant="outline"><LockIcon className="text-warning" />Sign-in page · agent paused</Badge> : caption}
        </span>
        <EnvironmentFocus api={api} containerApi={containerApi} />
        <ButtonMenu items={menu} end>
          <Button variant="ghost" size="icon-xs" title="Profile" aria-label="Profile menu"><EllipsisIcon /></Button>
        </ButtonMenu>
        <Button variant="ghost" size="icon-xs" title="Close profile: its tabs go, its sign-ins stay (open it again in Profiles)" aria-label="Close profile"
          onClick={() => void act('profile:close', { profile: id })}><XIcon /></Button>
      </>}
    </div>
  </RightClickMenu>;
}
