// The title bar and its ☰ (docs/window.md, The title bar, Menus): the logo, the tasks' bar when
// it is here, the Kulisa zoom when not 100%, Settings, ☰; its room beside the OS window buttons (env(titlebar-area-*):
// titleBarOverlay in window.ts, 44 px there). No logo on macOS: its apps show their icon in the Dock; Exit only where
// the OS has no menu bar with Quit (macOS: Cmd+Q).
import type { ComponentType, ReactNode } from 'react';
import { BookOpenIcon, BugIcon, GitBranchIcon, InfoIcon, KeyboardIcon, LanguagesIcon, LayoutDashboardIcon, LogOutIcon, MenuIcon,
  MinusIcon, PanelBottomIcon, PanelLeftIcon, PlusIcon, SettingsIcon, SunMoonIcon, ZoomInIcon } from 'lucide-react';
import { Button, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, Toggle, Item, ItemContent, ItemDescription, ItemTitle } from '@ui';
import { ButtonMenu } from './Menus';
import { Tip } from './Tip';
import { Logo } from './ProjectIcon';
import { useWindow } from '../lib/store';
import { keyText, withKeys } from '../lib/common';
import { applyPreset } from '../lib/grid';
import { ask } from '../lib/ask';
import { dialog } from '../lib/dialogs';
import { leaveSettings, openSettings, useSettings } from '../lib/settings';
import { refused } from '../../shared/result';
import type { MenuItem } from '../lib/menu';
import type { Bar, Theme } from '../../shared/ipc';

const mac = kulisa.platform === 'darwin';

// ☰'s zoom row, as Chrome's: Zoom  −  100%  +; − and + leave the menu open.
function ZoomRow() {
  const zoom = useWindow((s) => s.zoom);
  const step = (by: number) => (e: Event) => { e.preventDefault(); void kulisa.invoke('zoom:ui', by); };
  return <div role="group" aria-label="Zoom" data-testid="zoom-row" className="flex items-center gap-0.5">
    <span className="flex flex-1 items-center gap-1.5 px-1.5 text-sm [&_svg]:size-4 [&_svg]:text-muted-foreground"><ZoomInIcon />Zoom</span>
    <DropdownMenuItem aria-label="Zoom out" title={withKeys('Zoom out', 'zoom.out')} onSelect={step(-1)}><MinusIcon /></DropdownMenuItem>
    <span className="min-w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
    <DropdownMenuItem aria-label="Zoom in" title={withKeys('Zoom in', 'zoom.in')} onSelect={step(1)}><PlusIcon /></DropdownMenuItem>
  </div>;
}

// A row of ☰ with a few choices, in a menu beside it, the chosen one at the row's end; a choice leaves the menus open,
// so another can be tried. name: the data attribute each choice has (data-theme, data-bar, data-language).
type Choice = { value: string; label: string; sub?: string; title?: string };
function ChoiceRow({ name, icon: Icon, label, title, choices, chosen, choose }: { name: string; icon: ComponentType; label: string; title?: string;
  choices: Choice[]; chosen: string; choose: (value: string) => unknown }) {
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger aria-label={label} title={title} data-testid={`${name}-row`}>
      <Icon />{label}<DropdownMenuShortcut>{choices.find((c) => c.value === chosen)?.label}</DropdownMenuShortcut>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent aria-label={label}>
      <DropdownMenuRadioGroup value={chosen} onValueChange={(v) => void choose(v)}>
        {choices.map((c) => <DropdownMenuRadioItem key={c.value} value={c.value} title={c.title} aria-label={c.label} {...{ [`data-${name}`]: c.value }}
          onSelect={(e) => e.preventDefault()}>
          {c.sub ? <Item size="xs"><ItemContent><ItemTitle>{c.label}</ItemTitle><ItemDescription>{c.sub}</ItemDescription></ItemContent></Item> : c.label}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}

const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System', title: 'As the operating system' }];
const BARS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];
const ThemeRow = () => <ChoiceRow name="theme" icon={SunMoonIcon} label="Theme" choices={THEMES} chosen={useWindow((s) => s.theme)}
  choose={(t) => kulisa.invoke('theme:set', t as Theme)} />;
const BarRow = () => <ChoiceRow name="bar" icon={PanelBottomIcon} label="Tasks bar" choices={BARS} chosen={useWindow((s) => s.bar)}
  choose={(b) => kulisa.invoke('bar:set', b as Bar)} />;

// Language (docs/window.md, Language): the system's first, then by name in each language itself; its tooltip says what
// it changes, and for which agents (agents/, language).
const languageName = (code: string, inLanguage = code) => new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code)!;
function LanguageRow() {
  const info = useWindow((s) => s.language);
  if (!info?.languages.length) return null;
  const system = navigator.language.split('-')[0];
  const order = info.languages.toSorted((a, b) => Number(b === system) - Number(a === system) || languageName(a).localeCompare(languageName(b)));
  const has = info.agents.filter((a) => a.has).map((a) => a.name), not = info.agents.filter((a) => !a.has).map((a) => a.name);
  const title = `The language you speak with the agents. ${has.join(', ')} ${has.length > 1 ? 'dictate and answer' : 'dictates and answers'} in it, `
    + 'and may write code comments in it too: your project\'s CLAUDE.md or AGENTS.md decides that.'
    + (not.length ? ` ${not.join(', ')} ${not.length > 1 ? 'have' : 'has'} no language setting yet.` : '');
  const choose = async (code: string) => {
    const r = await kulisa.invoke('language:set', code);
    if (refused(r)) await ask({ message: 'The language was not changed', detail: r.error });
  };
  return <ChoiceRow name="language" icon={LanguagesIcon} label="Language" title={title} chosen={info.language} choose={choose}
    choices={order.map((code) => ({ value: code, label: languageName(code), sub: languageName(code, 'en') === languageName(code) ? undefined : languageName(code, 'en') }))} />;
}

// The ready-made arrangements of the panels (lib/grid.ts, presets).
const PRESETS = [
  { preset: 'columns', label: 'Stage above', title: 'Stage above development terminals and Resources', icon: PanelBottomIcon },
  { preset: 'grid', label: 'Stage beside', title: 'Stage left of development terminals and Resources', icon: PanelLeftIcon },
] as const;
const ArrangeRows = () => PRESETS.map(({ preset, label, title, icon: Icon }) =>
  <DropdownMenuItem key={preset} data-preset={preset} title={title} onSelect={() => applyPreset(preset)}><Icon />{label}</DropdownMenuItem>);

// They open in the user's browser (window.ts).
const LINKS = [
  { label: 'Documentation', href: 'https://kulisa.app/docs', icon: BookOpenIcon },
  { label: 'GitHub', href: 'https://github.com/cosmotools/kulisa', icon: GitBranchIcon },
];
const windowMenu = (): MenuItem[] => [
  { component: ZoomRow }, { component: ThemeRow }, { component: BarRow }, { component: LanguageRow },
  '-', { heading: 'Arrange workspace', icon: LayoutDashboardIcon }, { component: ArrangeRows },
  '-', { label: 'Keyboard Shortcuts', icon: KeyboardIcon, keys: keyText('shortcuts'), run: async () => (await dialog('shortcuts')).showShortcuts() },
  '-', ...LINKS.map((l) => ({ label: l.label, icon: l.icon, run: () => { open(l.href); } })),
  { label: 'Report a Problem…', icon: BugIcon, title: 'The log of what Kulisa did, and how to send it', run: () => openSettings('log') },
  { label: 'About Kulisa', icon: InfoIcon, run: () => openSettings('about') },
  ...(mac ? [] : ['-' as const, { label: 'Exit', icon: LogOutIcon, run: () => kulisa.invoke('app:quit') }]),
];

export function TopBar({ children }: { children?: ReactNode }) {
  const zoom = useWindow((s) => s.zoom), settings = useWindow((s) => s.projects.settings), shown = !!useSettings();
  const toggle = <Toggle id="settingsButton" aria-label="Settings" pressed={shown} onPressedChange={() => (shown ? void leaveSettings() : openSettings())}>
    <SettingsIcon /></Toggle>;
  // The logo and the space after the tasks' bar drag the window, however many tabs: Chromium takes tabs scrolled past
  // the bar's edges as no-drag over them too (it does not clip them to the bar) and the regions in the page's order, the
  // last one winning; so both come after the tasks' bar in the page, the logo put first by order. The space is at least
  // 40 px, as Chrome's after its +.
  return <header id="topbar" className="flex h-11 w-[calc(env(titlebar-area-x,0px)+env(titlebar-area-width,100%))] min-w-0 items-center gap-2
    ps-[calc(env(titlebar-area-x,0px)+--spacing(2))] [-webkit-app-region:drag]">
    {children}
    {!mac && <span data-testid="title-logo" className="-order-1 flex [-webkit-app-region:drag]"><Logo color="var(--project, var(--foreground))" size={24} /></span>}
    <span data-testid="drag-area" className="grow shrink-0 basis-10 self-stretch [-webkit-app-region:drag]" />
    <span className="me-2 flex gap-1 [-webkit-app-region:no-drag]">
      {zoom !== 1 && <Tip text={`Kulisa's zoom. Click to reset (${keyText('zoom.reset')})`}>
        <Button id="zoomReset" variant="ghost" onClick={() => kulisa.invoke('zoom:ui', 0)}>{Math.round(zoom * 100)}%</Button></Tip>}
      {/* No tooltip while Settings is shown: one under the pointer would take its first Esc */}
      {shown ? toggle : settings && <Tip text="Settings: projects, agents, profiles">{toggle}</Tip>}
      <ButtonMenu items={windowMenu} end><Button id="windowMenu" variant="ghost" size="icon" aria-label="Menu"><MenuIcon /></Button></ButtonMenu>
    </span>
  </header>;
}
