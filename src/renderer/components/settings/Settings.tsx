// Settings (docs/window.md, Settings): over the window's area under the title bar, its categories in a nav on the left
// (Projects, Agents, Profiles, GitHub, Log, About), on the right a category's page (its list) or one thing's, under its
// path. Saved as it changes. Its ×, Esc (unless a layer was open) and the gear close it, what is typed saved first.
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Button, Card, DrawerHeaderNavigation, DrawerHeaderTitle, Field, Input, Table, TableBody, TableCell, TableCellLayout, TableRow, createTableColumn, useTableColumnSizing_unstable, useTableFeatures,
  NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem, Spinner, Text, Tooltip } from '@fluentui/react-components';
import { AddRegular, ArrowLeftRegular, ChevronRightRegular, BotFilled, BotRegular, BranchFilled, BranchRegular, bundleIcon, DocumentBulletListFilled, DocumentBulletListRegular, 
  GridFilled, GridRegular, InfoFilled, InfoRegular, MoreHorizontalRegular, PeopleFilled, PeopleRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import css from './Settings.module.css';
import { useChanged } from './changed';
import { install, installing, loadAccounts, loadAgents, useAgents } from './agents';
import { avatarSrc } from '../../lib/common';
import { useCovered } from '../../lib/cover';
import { closeSettings, onLeaveSettings } from '../../lib/settings';
import { agentMark } from '../AgentMark';
import { ProjectIcon } from '../ProjectIcon';
import { refused } from '../../../shared/result';
import type { ProjectEntry, ProjectSettings, SettingsProfile } from '../../../shared/types';
import type { SettingsAt } from '../../../shared/ipc';
import { ErrorBar } from '../ErrorBar';

// A nav item's icon is filled while it is the one chosen (NavItem's own styles switch them).
const icons = { projects: bundleIcon(GridFilled, GridRegular), agents: bundleIcon(BotFilled, BotRegular), profiles: bundleIcon(PeopleFilled, PeopleRegular),
  github: bundleIcon(BranchFilled, BranchRegular), log: bundleIcon(DocumentBulletListFilled, DocumentBulletListRegular), about: bundleIcon(InfoFilled, InfoRegular) };
// A category's list: the thing, and the chevron of a row going to its page, as narrow as it (Fluent's column sizing: a
// fixed Table shares its width equally).
const listColumns = [createTableColumn({ columnId: 'thing' }), createTableColumn({ columnId: 'go' })];
const listSizes = { thing: { idealWidth: 800, minWidth: 200 }, go: { idealWidth: 32, minWidth: 32 } };
const names = { projects: 'Projects', agents: 'Agents', profiles: 'Profiles', github: 'GitHub', log: 'Log', about: 'About' };


type Section = 'projects' | 'agents' | 'profiles' | 'github' | 'log' | 'about';

export function Settings({ at, className }: { at: SettingsAt; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [first, setFirst] = useState<{ id: string; page: ProjectSettings } | null>(null); // the project's page it opens at, filled
  const [section, setSection] = useState<Section>('projects');
  const [projects, setProjects] = useState<ProjectEntry[]>([]), [editing, setEditing] = useState<string | null>(null);
  const { list: agents, clis, looking, install: inst } = useAgents();
  const [agentPick, setAgentAt] = useState<string>(), [signing, setSigning] = useState<string | null>(null); // signing: the agent a new account is signed in to on its page
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]), [profilePick, setProfileAt] = useState<string>();
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});
  const { columnSizing_unstable: sizing, tableRef } = useTableFeatures({ columns: listColumns, items: [] }, [useTableColumnSizing_unstable({ columnSizingOptions: listSizes })]);
  // The project's page read again each time Settings is asked for a page.
  const [shown, setShown] = useState(0);
  // The pages of the profiles hidden while it is shown, the keys its own, as a dialog's; not closed with the grid.
  // Hidden as it is filled, not before: the window stays as it is until Settings is drawn in one go. Closed, the
  // keyboard goes back where it was, as a dialog gives it back.
  const { setOpen, opened } = useCovered('page');
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => { setOpen(false); if (before?.isConnected) before.focus(); };
  }, [setOpen]);

  const lists = useCallback(async () => {
    const [list, p] = await Promise.all([kulisa.invoke('projects:list'), kulisa.invoke('profiles:list')]);
    setProjects(list!.projects); setProfiles(p.profiles);
    return { list: list!, profiles: p.profiles };
  }, []);
  // A category's list without id, one thing's page with it.
  const show = async (on: Section, id?: string) => {
    await save.current();
    if (on !== 'agents' || id !== agentAt) setSigning(null);
    setFirst(null); // what it opened at is as it was then: a page shown later fetches its own
    setSection(on);
    if (on === 'projects') setEditing(id ?? null);
    if (on === 'agents') setAgentAt(id);
    if (on === 'profiles') setProfileAt(id);
  };
  // Opened, or asked again, at a page (lib/settings.ts).
  useEffect(() => { void (async () => {
    await save.current();
    const { list, profiles: all } = await lists();
    // As last found, looked for again behind them; never looked for yet (nothing in the window has asked), the first
    // look is waited for: a nav shown with its agents coming after jumps.
    const cached = loadAgents(true);
    void loadAccounts();
    const on = (at.section === 'profiles' ? 'profiles' : at.section === 'log' || at.section === 'about' ? at.section : 'projects') as Section;
    setSection(on);
    // the gear: the window's project; Profiles from a task: their list
    const project = on === 'projects' ? (at.id ?? list.project ?? null) : null;
    // Its page waited for too, as the agents are: shown as it comes, it jumps.
    const page = project ? kulisa.invoke('project:settings-get', { id: project }) : null;
    setProfileAt(on === 'profiles' && at.id && all.some((p) => p.id === at.id) ? at.id : undefined);
    if (!await cached) await loadAgents(false); else void loadAgents(false);
    const filled = page && await page;
    setFirst(project && filled && !refused(filled) ? { id: project, page: filled } : null);
    setEditing(project); setShown((n) => n + 1);
    await opened(true);
    setLoaded(true);
  })(); }, [at, lists, opened]);
  useChanged(lists);
  // The one shown; none (or one gone: deleted here or elsewhere), its category's list.
  const agentAt = agents.some((a) => a.id === agentPick) ? agentPick : undefined;
  const profileAt = profiles.some((p) => p.id === profilePick) ? profilePick : undefined;

  // While an agent installs, it stays.
  const close = useCallback(async () => { if (installing()) return; await save.current(); closeSettings(); }, []);
  useEffect(() => {
    onLeaveSettings(close);
    let layered = false;
    // Shown ones only: a focused Dropdown keeps its listbox, hidden. A listbox in the page is no layer (a TagPicker's
    // tags); a Dropdown's opens in a portal.
    const before = () => { layered = [...document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]:not(#settings *)')].some((l) => l.checkVisibility()); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !layered && !e.defaultPrevented) void close(); };
    addEventListener('keydown', before, true); addEventListener('keydown', esc);
    return () => { onLeaveSettings(null); removeEventListener('keydown', before, true); removeEventListener('keydown', esc); };
  }, [close]);

  async function createProfile() {
    if (!newProfile?.trim()) return;
    const r = await kulisa.invoke('profiles:new', { name: newProfile });
    if (refused(r)) { setProfilesError(r.error); return; }
    setProfiles(r.profiles); setNewProfile(null); setProfilesError(''); void show('profiles', r.id);
  }
  const deleteProject = async (id: string) => { const r = await kulisa.invoke('project:delete', { id }); if (!r?.error) { await lists(); setEditing(null); } };
  const deleteProfile = async (id: string) => { const r = await kulisa.invoke('profiles:delete', { profile: id }); if (refused(r)) setProfilesError(r.error ?? ''); else setProfiles(r.profiles); };
  // A new account of an agent: signed in on its page.
  const signIn = async (id: string) => { await show('agents', id); setSigning(id); };
  const newAccount = (): Item[] => [{ heading: 'New Account' }, ...agents.filter((a) => clis.includes(a.id))
    .map((a) => ({ label: `${a.name}…`, sub: a.installed ? undefined : 'not installed', enabled: !!a.installed && !signing, run: () => signIn(a.id) }))];

  // What acts on one thing: its row's right-click and its page's ⋯.
  const actions = (key: string): Item[] => {
    const [kind, id] = key.split(':') as [string, string];
    if (kind === 'p') return [{ label: 'Delete Project…', run: () => deleteProject(id) }];
    if (kind === 'f') return [{ label: 'Delete Profile…', run: () => deleteProfile(id) }];
    const a = agents.find((x) => x.id === id);
    if (kind === 'a' && a) return [{ label: 'Install', enabled: !a.installed && !!a.install && !inst?.running, run: () => install(a.id) },
      { label: 'New Account…', enabled: clis.includes(a.id) && !!a.installed && !signing, run: () => signIn(a.id) }];
    return [];
  };
  if (!loaded) return null;
  const shownProfile = profiles.find((p) => p.id === profileAt), shownAgent = agents.find((a) => a.id === agentAt), shownProject = projects.find((p) => p.id === editing);
  const one = section === 'projects' ? shownProject && { key: `p:${shownProject.id}`, name: shownProject.name } : section === 'agents' ? shownAgent && { key: `a:${shownAgent.id}`, name: shownAgent.name }
    : section === 'profiles' ? shownProfile && { key: `f:${shownProfile.id}`, name: shownProfile.name } : undefined;
  const listed = section === 'projects' || section === 'agents' || section === 'profiles';

  // At its path: one thing's ⋯; a category's button making one of its things (no New Project: docs/window.md).
  const make: ReactNode = one ? <ButtonMenu end items={() => actions(one.key)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label="More" /></ButtonMenu>
    : section === 'agents' ? <ButtonMenu end items={newAccount}><Button icon={<AddRegular />} disabled={!clis.length}>New Account</Button></ButtonMenu>
    : section === 'profiles' ? <Button appearance="primary" icon={<AddRegular />} onClick={() => setNewProfile('')}>New Profile</Button> : null;

  // A category's things, each row going to its page; their actions in its right-click (data-row, data-key: the tests'
  // handles, docs/testing.md).
  const list = (label: string, rows: { key: string; name: string; media: ReactElement; badges?: ReactNode; description?: string }[]) =>
    <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k ? actions(k) : null; }}>
      <Table aria-label={label} ref={tableRef} {...sizing.getTableProps()}><TableBody>{rows.map((r) => { const open = () => void show(section, r.key.split(':')[1]);
        return <TableRow key={r.key} data-row="" data-key={r.key} aria-label={r.name} title={[r.name, r.description].filter(Boolean).join('\n')} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
          <TableCell {...sizing.getTableCellProps('thing')}><TableCellLayout truncate media={r.media} description={r.description}>{r.name} {r.badges}</TableCellLayout></TableCell>
          {/* the row goes to its page */}
          <TableCell {...sizing.getTableCellProps('go')}><ChevronRightRegular fontSize={16} /></TableCell>
        </TableRow>; })}</TableBody></Table>
    </RightClickMenu>;

  const page = (): ReactNode => {
    if (section === 'projects') return shownProject ? <ProjectPage key={`${editing}:${shown}`} id={shownProject.id} first={first?.id === shownProject.id ? first.page : undefined} saveRef={save} onSaved={() => void lists()} />
      : <Card appearance="subtle">{projects.length ? list('Projects', projects.map((p) => ({ key: `p:${p.id}`, name: p.name, media: <ProjectIcon p={p} size={24} />,
        description: [`${p.folders.length} ${p.folders.length === 1 ? 'folder' : 'folders'}`, `${p.tasks.length} ${p.tasks.length === 1 ? 'task' : 'tasks'}`].join(' · ') })))
        : <Text>No projects yet.</Text>}</Card>;
    if (section === 'agents') return shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
      : <Card appearance="subtle">{agents.length ? list('Agents', agents.map((a) => { const Mark = agentMark(a.id); return { key: `a:${a.id}`, name: a.name,
        media: <Mark width={24} height={24} fontSize={24} />, badges: !a.installed && <Badge appearance="tint" color="informative">Not installed</Badge>,
        description: a.installed ? [a.version, a.path].filter(Boolean).join(' · ') || undefined : a.maker }; }))
        : looking ? <Spinner size="tiny" labelPosition="after" label="Looking for agents on this computer…" /> : <Text>No agents.</Text>}</Card>;
    if (section === 'profiles') return shownProfile ? <ProfilePage key={JSON.stringify(shownProfile)} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setProfileAt(r.id); }} />
      : <Card appearance="subtle">
        {newProfile !== null && <Field label="New profile" validationMessage={profilesError || undefined}>
          <Input autoFocus data-name value={newProfile} placeholder="Its name, e.g. ann@shop.com"
            onChange={(_, d) => { setNewProfile(d.value); setProfilesError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void createProfile(); if (e.key === 'Escape') { e.stopPropagation(); setNewProfile(null); } }} />
        </Field>}
        {newProfile === null && profilesError && <ErrorBar>{profilesError}</ErrorBar>}
        {profiles.length ? list('Profiles', profiles.map((p) => ({ key: `f:${p.id}`, name: p.name, media: <Avatar size={24} name={p.name} image={{ src: avatarSrc(p.avatar) }} />,
          description: [p.description, p.projects.length ? `in ${p.projects.join(', ')}` : 'in no project'].filter(Boolean).join(' · ') })))
          : newProfile === null && <Text>No profiles yet.</Text>}
      </Card>;
    return section === 'github' ? <GitHubPage /> : section === 'log' ? <LogPage /> : <AboutPage />;
  };

  const width = section === 'log' ? css.wide : css.column;
  return <div id="settings" className={`${css.root} ${className ?? ''}`}>
    <div className={css.body}>
      <NavDrawer open type="inline" selectedValue={section} aria-label="Settings"
        onNavItemSelect={(_, d) => void show(d.value as Section)}>
        {/* as the sidebar's (Sidebar.tsx) */}
        <NavDrawerHeader>
          {/* Back to the tasks, as Windows' Settings: a × at the nav's edge reads as closing the nav */}
          <DrawerHeaderNavigation>
            <Tooltip content="Back (Esc)" relationship="label">
              <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => void close()} />
            </Tooltip>
          </DrawerHeaderNavigation>
          <DrawerHeaderTitle><Text size={300} weight="semibold">Settings</Text></DrawerHeaderTitle>
        </NavDrawerHeader>
        <NavDrawerBody>
          {(Object.keys(names) as Section[]).map((k) => { const Icon = icons[k]; return <NavItem key={k} value={k} data-key={k} icon={<Icon />}>{names[k]}</NavItem>; })}
        </NavDrawerBody>
      </NavDrawer>

      <main className={css.main}>
        <div className={`${css.path} ${width}`}>
          <Breadcrumb size="large" aria-label="Path">
            {one && listed ? <>
              <BreadcrumbItem><BreadcrumbButton onClick={() => void show(section)}>{names[section]}</BreadcrumbButton></BreadcrumbItem>
              <BreadcrumbDivider />
              <BreadcrumbItem><BreadcrumbButton current>{one.name}</BreadcrumbButton></BreadcrumbItem>
            </> : <BreadcrumbItem><BreadcrumbButton current>{names[section]}</BreadcrumbButton></BreadcrumbItem>}
          </Breadcrumb>
          {make}
        </div>
        <div className={`${css.page} ${width}`}>{page()}</div>
      </main>
    </div>
  </div>;
}
