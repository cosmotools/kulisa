// Settings (docs/window.md, Settings): over the window's area under the title bar, its categories in a nav on the left
// (Projects, Agents, Profiles, GitHub, Log, About), on the right a category's page (its list) or one thing's, under its
// path. Saved as it changes. Its ×, Esc (unless a layer was open) and the gear close it, what is typed saved first.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar, Badge, Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Button, Caption1, Divider, DrawerHeaderTitle, Field, Input,
  makeStyles, mergeClasses, NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem, Spinner, Text, tokens, Tooltip } from '@fluentui/react-components';
import { AddRegular, BotFilled, BotRegular, BranchFilled, BranchRegular, bundleIcon, DocumentBulletListFilled, DocumentBulletListRegular, DismissRegular,
  GridFilled, GridRegular, InfoFilled, InfoRegular, MoreHorizontalRegular, PeopleFilled, PeopleRegular } from '@fluentui/react-icons';
import { ButtonMenu, type Item } from '../Menus';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import { Row } from './Row';
import { useChanged } from './changed';
import { install, installing, loadAccounts, loadAgents, useAgents } from './agents';
import { avatarSrc } from '../../lib/common';
import { useCovered } from '../../lib/cover';
import { closeSettings, onLeaveSettings } from '../../lib/settings';
import { agentMark } from '../AgentMark';
import { ProjectIcon } from '../ProjectIcon';
import { refused } from '../../../shared/result';
import type { ProjectEntry, SettingsProfile } from '../../../shared/types';
import type { SettingsAt } from '../../../shared/ipc';
import { ErrorBar } from '../ErrorBar';

// A nav item's icon is filled while it is the one chosen (NavItem's own styles switch them).
const icons = { projects: bundleIcon(GridFilled, GridRegular), agents: bundleIcon(BotFilled, BotRegular), profiles: bundleIcon(PeopleFilled, PeopleRegular),
  github: bundleIcon(BranchFilled, BranchRegular), log: bundleIcon(DocumentBulletListFilled, DocumentBulletListRegular), about: bundleIcon(InfoFilled, InfoRegular) };
const names = { projects: 'Projects', agents: 'Agents', profiles: 'Profiles', github: 'GitHub', log: 'Log', about: 'About' };

const useStyles = makeStyles({
  // The window's background, the title bar's: a page's cards (Background1) stand out on it, as Windows' Settings.
  root: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: tokens.colorNeutralBackground2 },
  line: { flex: 'none' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  // Fluent's nav is drawn on Background4, the darkest, for a frame around the app; here it sits beside a page, so it
  // takes the page's, its hover and pressed following.
  nav: { height: '100%', '--colorNeutralBackground4': tokens.colorNeutralBackground2,
    '--colorNeutralBackground4Hover': tokens.colorNeutralBackground2Hover, '--colorNeutralBackground4Pressed': tokens.colorNeutralBackground2Pressed },
  newProfile: { width: '300px' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  path: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacingHorizontalM, padding: `${tokens.spacingVerticalL} 0 ${tokens.spacingVerticalM}` },
  page: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS, overflow: 'auto', paddingBottom: tokens.spacingVerticalXXL },
  // One column in the middle of a wide window, the path over it; the log as wide as the window. Padding, not a box's
  // width: the page's scrollbar stays at the window's edge.
  column: { paddingInline: `max(${tokens.spacingHorizontalXXL}, calc((100% - 900px) / 2))` },
  wide: { paddingInline: tokens.spacingHorizontalXXL },
  looking: { justifyContent: 'flex-start' },
});

type Section = 'projects' | 'agents' | 'profiles' | 'github' | 'log' | 'about';

export function Settings({ at, className }: { at: SettingsAt; className: string }) {
  const styles = useStyles();
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState<Section>('projects');
  const [projects, setProjects] = useState<ProjectEntry[]>([]), [editing, setEditing] = useState<string | null>(null);
  const { list: agents, clis, looking, install: inst } = useAgents();
  const [agentPick, setAgentAt] = useState<string>(), [signing, setSigning] = useState<string | null>(null); // signing: the agent a new account is signed in to on its page
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]), [profilePick, setProfileAt] = useState<string>();
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});
  // The project's page read again each time Settings is asked for a page.
  const [shown, setShown] = useState(0);
  // The pages of the profiles hidden while it is shown, the keys its own, as a dialog's; not closed with the grid.
  // Closed, the keyboard goes back where it was, as a dialog gives it back.
  const { setOpen } = useCovered('page');
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    setOpen(true);
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
    setEditing(on === 'projects' ? (at.id ?? list.project ?? null) : null); setShown((n) => n + 1);
    setProfileAt(on === 'profiles' && at.id && all.some((p) => p.id === at.id) ? at.id : undefined);
    if (!await cached) await loadAgents(false); else void loadAgents(false);
    setLoaded(true);
  })(); }, [at, lists]);
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

  const page = (): ReactNode => {
    if (section === 'projects') return shownProject ? <ProjectPage key={`${editing}:${shown}`} id={shownProject.id} saveRef={save} onSaved={() => void lists()} />
      : projects.length ? projects.map((p) => <Row key={p.id} image={<ProjectIcon p={p} size={24} />} title={p.name} data={{ 'data-key': `p:${p.id}` }}
        description={[`${p.folders.length} ${p.folders.length === 1 ? 'folder' : 'folders'}`, `${p.tasks.length} ${p.tasks.length === 1 ? 'task' : 'tasks'}`].join(' · ')}
        open={() => void show('projects', p.id)} menu={() => actions(`p:${p.id}`)} />) : <Caption1>No projects yet.</Caption1>;
    if (section === 'agents') return shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
      : agents.length ? agents.map((a) => { const Mark = agentMark(a.id); return <Row key={a.id} image={<Mark />} title={a.name} data={{ 'data-key': `a:${a.id}` }}
        badges={!a.installed && <Badge appearance="tint" color="informative">Not installed</Badge>} description={a.installed ? [a.version, a.path].filter(Boolean).join(' · ') || undefined : a.maker}
        open={() => void show('agents', a.id)} menu={() => actions(`a:${a.id}`)} />; })
      : looking ? <Spinner size="tiny" labelPosition="after" label="Looking for agents on this computer…" className={styles.looking} /> : <Caption1>No agents.</Caption1>;
    if (section === 'profiles') return shownProfile ? <ProfilePage key={JSON.stringify(shownProfile)} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setProfileAt(r.id); }} />
      : <>
        {newProfile !== null && <form onSubmit={(e) => { e.preventDefault(); void createProfile(); }}><Field label="New profile" validationMessage={profilesError || undefined}>
          <Input autoFocus data-name value={newProfile} className={styles.newProfile} placeholder="Its name, e.g. ann@shop.com"
            onChange={(_, d) => { setNewProfile(d.value); setProfilesError(''); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setNewProfile(null); } }} />
        </Field></form>}
        {newProfile === null && profilesError && <ErrorBar>{profilesError}</ErrorBar>}
        {profiles.map((p) => <Row key={p.id} image={<Avatar size={32} name={p.name} image={{ src: avatarSrc(p.avatar) }} />} title={p.name} data={{ 'data-key': `f:${p.id}` }}
          description={[p.description, p.projects.length ? `in ${p.projects.join(', ')}` : 'in no project'].filter(Boolean).join(' · ')}
          open={() => void show('profiles', p.id)} menu={() => actions(`f:${p.id}`)} />)}
        {!profiles.length && newProfile === null && <Caption1>No profiles yet.</Caption1>}
      </>;
    return section === 'github' ? <GitHubPage /> : section === 'log' ? <LogPage /> : <AboutPage />;
  };

  const width = section === 'log' ? styles.wide : styles.column;
  return <div id="settings" className={mergeClasses(styles.root, className)}>
    <Divider className={styles.line} />
    <div className={styles.body}>
      <NavDrawer open type="inline" selectedValue={section} className={styles.nav} aria-label="Settings"
        onNavItemSelect={(_, d) => void show(d.value as Section)}>
        {/* as the sidebar's (Sidebar.tsx) */}
        <NavDrawerHeader>
          <DrawerHeaderTitle action={<Tooltip content="Close (Esc)" relationship="label">
            <Button appearance="subtle" icon={<DismissRegular />} onClick={() => void close()} /></Tooltip>}>
            <Text size={300} weight="semibold">Settings</Text>
          </DrawerHeaderTitle>
        </NavDrawerHeader>
        <NavDrawerBody>
          {(Object.keys(names) as Section[]).map((k) => { const Icon = icons[k]; return <NavItem key={k} value={k} data-key={k} icon={<Icon />}>{names[k]}</NavItem>; })}
        </NavDrawerBody>
      </NavDrawer>

      <main className={styles.main}>
        <div className={mergeClasses(styles.path, width)}>
          <Breadcrumb size="large" aria-label="Path">
            {one && listed ? <>
              <BreadcrumbItem><BreadcrumbButton onClick={() => void show(section)}>{names[section]}</BreadcrumbButton></BreadcrumbItem>
              <BreadcrumbDivider />
              <BreadcrumbItem><BreadcrumbButton current>{one.name}</BreadcrumbButton></BreadcrumbItem>
            </> : <BreadcrumbItem><BreadcrumbButton current>{names[section]}</BreadcrumbButton></BreadcrumbItem>}
          </Breadcrumb>
          {make}
        </div>
        <div className={mergeClasses(styles.page, width)}>{page()}</div>
      </main>
    </div>
  </div>;
}
