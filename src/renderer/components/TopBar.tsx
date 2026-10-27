// The title bar and its ☰ (docs/window.md, The title bar, Menus): the logo, the sidebar's button, the tasks' bar when
// it is here, the Kulisa zoom when not 100%, Settings, ☰. env(titlebar-area-*) leaves room for the OS window buttons
// (titleBarOverlay in window.ts; 44 px: TITLE_BAR_HEIGHT there). No logo on macOS: its apps show their icon in the
// Dock; Exit only where the OS has no menu bar with Quit (macOS: Cmd+Q).
import type { ComponentType, ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuItemRadio, MenuList, MenuPopover, MenuTrigger, Text, ToggleButton, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { AddRegular, BoardRegular, BookOpenRegular, BranchRegular, BugRegular, DarkThemeRegular, InfoRegular, KeyboardRegular,
  LayoutCellFourRegular, LayoutColumnThreeRegular, NavigationRegular, PanelBottomRegular, SettingsRegular, SignOutRegular, SquareRegular,
  SubtractRegular, TranslateRegular, ZoomIn20Regular } from '@fluentui/react-icons';
import { ButtonMenu, FIT, type Item } from './Menus';
import { Logo } from './ProjectIcon';
import { SidebarToggle } from './Sidebar';
import { useWindow } from '../lib/store';
import { keyText, LINKS, withKeys } from '../lib/common';
import { applyPreset } from '../lib/grid';
import { ask } from '../lib/ask';
import { dialog } from '../lib/dialogs';
import { leaveSettings, openSettings, useSettings } from '../lib/settings';
import { refused } from '../../shared/result';
import type { Bar, Theme } from '../../shared/ipc';

const mac = kulisa.platform === 'darwin';

const useStyles = makeStyles({
  zoom: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXXS },
  zoomLabel: { flex: 1, display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, paddingInline: tokens.spacingHorizontalMNudge },
  zoomValue: { minWidth: '4em' },
  bar: { height: '44px', display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0, boxSizing: 'border-box',
    paddingInlineStart: 'calc(env(titlebar-area-x, 0px) + 8px)', width: 'calc(env(titlebar-area-x, 0px) + env(titlebar-area-width, 100%))' },
  // Where the window is dragged by, and what in it takes clicks instead.
  drag: { WebkitAppRegion: 'drag' },
  noDrag: { WebkitAppRegion: 'no-drag' },
  logo: { order: -2, display: 'flex' },
  sidebar: { order: -1, display: 'flex' },
  space: { flex: '1 0 40px', alignSelf: 'stretch' },
  end: { display: 'flex', gap: tokens.spacingHorizontalXS, marginInlineEnd: tokens.spacingHorizontalS },
});

// ☰'s zoom row, as Chrome's: Zoom  −  100%  +; − and + leave the menu open.
function ZoomRow() {
  const zoom = useWindow((s) => s.zoom), styles = useStyles();
  return <div role="group" aria-label="Zoom" data-testid="zoom-row" className={styles.zoom}>
    <Text className={styles.zoomLabel}><ZoomIn20Regular />Zoom</Text>
    <MenuItem aria-label="Zoom out" title={withKeys('Zoom out', 'zoom.out')} persistOnClick icon={<SubtractRegular />} onClick={() => kulisa.invoke('zoom:ui', -1)} />
    <Text align="center" className={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
    <MenuItem aria-label="Zoom in" title={withKeys('Zoom in', 'zoom.in')} persistOnClick icon={<AddRegular />} onClick={() => kulisa.invoke('zoom:ui', 1)} />
  </div>;
}

// A row of ☰ with a few choices, in a menu beside it, the chosen one at the row's end; a choice leaves the menus open,
// so another can be tried. name: the data attribute each choice has (data-theme, data-bar, data-language).
type Choice = { value: string; label: string; sub?: string; title?: string };
function ChoiceRow({ name, icon: Icon, label, title, choices, chosen, choose }: { name: string; icon: ComponentType; label: string; title?: string;
  choices: Choice[]; chosen: string; choose: (value: string) => unknown }) {
  return <Menu positioning={FIT} checkedValues={{ [name]: [chosen] }} onCheckedValueChange={(_, d) => { if (d.checkedItems[0]) void choose(d.checkedItems[0]); }}>
    <MenuTrigger disableButtonEnhancement>
      <MenuItem aria-label={label} title={title} data-testid={`${name}-row`} icon={<Icon />}
        secondaryContent={choices.find((c) => c.value === chosen)?.label}>{label}</MenuItem>
    </MenuTrigger>
    <MenuPopover>
      <MenuList data-ready aria-label={label}>
        {choices.map((c) => <MenuItemRadio key={c.value} name={name} value={c.value} persistOnClick title={c.title} aria-label={c.label}
          subText={c.sub} {...{ [`data-${name}`]: c.value }}>{c.label}</MenuItemRadio>)}
      </MenuList>
    </MenuPopover>
  </Menu>;
}

const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System', title: 'As the operating system' }];
const BARS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];
const ThemeRow = () => <ChoiceRow name="theme" icon={DarkThemeRegular} label="Theme" choices={THEMES} chosen={useWindow((s) => s.theme)}
  choose={(t) => kulisa.invoke('theme:set', t as Theme)} />;
const BarRow = () => <ChoiceRow name="bar" icon={PanelBottomRegular} label="Tasks bar" choices={BARS} chosen={useWindow((s) => s.bar)}
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
  return <ChoiceRow name="language" icon={TranslateRegular} label="Language" title={title} chosen={info.language} choose={choose}
    choices={order.map((code) => ({ value: code, label: languageName(code), sub: languageName(code, 'en') === languageName(code) ? undefined : languageName(code, 'en') }))} />;
}

// The ready-made arrangements of the panels (lib/grid.ts, presets).
const PRESETS = [
  { preset: 'columns', label: 'Columns', title: 'Profiles in columns, terminal below', icon: LayoutColumnThreeRegular },
  { preset: 'grid', label: 'Two by two', title: 'Profiles two by two, terminal right', icon: LayoutCellFourRegular },
  { preset: 'focus', label: 'One at a time', title: 'One profile at a time (the others as tabs), terminal below', icon: SquareRegular },
] as const;
const ArrangeRows = () => <>{PRESETS.map(({ preset, label, title, icon: Icon }) =>
  <MenuItem key={preset} data-preset={preset} title={title} icon={<Icon />} onClick={() => applyPreset(preset)}>{label}</MenuItem>)}</>;

const LINK_ICONS: Record<string, ComponentType> = { Documentation: BookOpenRegular, GitHub: BranchRegular };
const windowMenu = (): Item[] => [
  { component: ZoomRow }, { component: ThemeRow }, { component: BarRow }, { component: LanguageRow },
  '-', { heading: 'Arrange panels', icon: BoardRegular }, { component: ArrangeRows },
  '-', { label: 'Keyboard Shortcuts', icon: KeyboardRegular, keys: keyText('shortcuts'), run: async () => (await dialog('shortcuts')).showShortcuts() },
  '-', ...LINKS.map((l) => ({ label: l.label, icon: LINK_ICONS[l.label], run: () => { open(l.href); } })),
  { label: 'Report a Problem…', icon: BugRegular, title: 'The log of what Kulisa did, and how to send it', run: () => openSettings('log') },
  { label: 'About Kulisa', icon: InfoRegular, run: () => openSettings('about') },
  ...(mac ? [] : ['-' as const, { label: 'Exit', icon: SignOutRegular, run: () => kulisa.invoke('app:quit') }]),
];

export function TopBar({ children }: { children?: ReactNode }) {
  const zoom = useWindow((s) => s.zoom), settings = useWindow((s) => s.projects.settings), shown = !!useSettings(), styles = useStyles();
  // The logo and the space after the tasks' bar drag the window, however many tabs: Chromium takes tabs scrolled past
  // the bar's edges as no-drag over them too (it does not clip them to the bar) and the regions in the page's order, the
  // last one winning; so both come after the tasks' bar in the page, the logo put first by order. The space is at least
  // 40 px, as Chrome's after its +.
  return <header id="topbar" className={mergeClasses(styles.bar, styles.drag)}>
    {children}
    {!mac && <span data-testid="title-logo" className={mergeClasses(styles.logo, styles.drag)}><Logo color={`var(--project, ${tokens.colorNeutralForeground1})`} size={26} /></span>}
    <span className={mergeClasses(styles.sidebar, styles.noDrag)}>{!shown && <SidebarToggle />}</span>
    <span data-testid="drag-area" className={mergeClasses(styles.space, styles.drag)} />
    <span className={mergeClasses(styles.end, styles.noDrag)}>
      {zoom !== 1 && <Tooltip content={`Kulisa's zoom. Click to reset (${keyText('zoom.reset')})`} relationship="description">
        <Button id="zoomReset" appearance="subtle" onClick={() => kulisa.invoke('zoom:ui', 0)}>{Math.round(zoom * 100)}%</Button></Tooltip>}
      {/* No tooltip while Settings is shown: one under the pointer would take its first Esc */}
      {shown ? <ToggleButton id="manageProjects" appearance="subtle" icon={<SettingsRegular />} aria-label="Settings" checked onClick={() => void leaveSettings()} />
        : settings && <Tooltip content="Settings: projects, agents, profiles" relationship="description">
          <ToggleButton id="manageProjects" appearance="subtle" icon={<SettingsRegular />} aria-label="Settings" checked={false} onClick={() => openSettings()} /></Tooltip>}
      <ButtonMenu items={windowMenu} end><Button id="windowMenu" appearance="subtle" icon={<NavigationRegular />} aria-label="Menu" /></ButtonMenu>
    </span>
  </header>;
}
