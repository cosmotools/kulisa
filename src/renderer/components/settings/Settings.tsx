// Settings: its nav, and a category's page or one thing's under its path (docs/window.md, Settings).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { avatarSrc, useShade, ProjectIcon } from '../../../appearance/renderer';
import { ArrowLeftIcon, BotIcon, EllipsisIcon, GitBranchIcon, InfoIcon, LayoutGridIcon, PlusIcon, ScrollTextIcon, UsersIcon, CircleAlertIcon } from 'lucide-react';
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Sidebar,
  SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, Toaster,
  Alert, AlertDescription, Avatar, AvatarImage, AvatarFallback, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@ui';
import { ButtonMenu } from '../../../menus/renderer';
import { Tip } from '../Tip';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import { AddInPlace, Things, SettingsHeading, SettingsGroup, SettingsLoading, SettingsError, type Thing } from './kit';
import { useChanged } from './changed';
import { useRead } from './read';
import { agents as agentList, loadAccounts, useAccounts } from './agents';
import { useAgentList } from '../../lib/agents';
import type { MenuItem } from '../../../menus/renderer';
import { coverPage } from '../../../layers/renderer';
import { closeSettings, onLeaveSettings } from '../../lib/settings';
import { store as windowStore, useWindow } from '../../lib/store';
import { agentMark } from '../../../agent-presentation/renderer';
import { refused } from '../../../shared/result';
import type { AgentInfo, SettingsProfile } from '../../../shared/types';
import type { SettingsAt } from '../../../shared/ipc';

const icons = { projects: LayoutGridIcon, agents: BotIcon, profiles: UsersIcon, github: GitBranchIcon, log: ScrollTextIcon, about: InfoIcon };
const names = { projects: 'Projects', agents: 'Agents', profiles: 'Profiles', github: 'GitHub', log: 'Log', about: 'About' };
type Section = keyof typeof names;
// What is shown: a category's list without id, one thing's page with it.
interface Place { section: Section; id?: string | null }

export function Settings({ at, className }: { at: SettingsAt; className?: string }) {
  const [place, setPlace] = useState<Place>(() => ({ section: at.section,
    id: at.section === 'projects' ? at.id ?? windowStore.getState().projects.project : at.id })), { section } = place;
  const projects = useWindow((s) => s.projects.projects);
  const agents = useAgentList(agentList, (s) => s.agents), looking = useAgentList(agentList, (s) => s.looking);
  const installing = useAgentList(agentList, (s) => s.installing), { clis } = useAccounts();
  const [signing, setSigning] = useState<string | null>(null); // the agent a new account is signed in to on its page
  const [profileData, readProfiles, setProfiles] = useRead<SettingsProfile[]>();
  const [discovery, discover] = useRead<AgentInfo[]>(agentList.store.getState().agents);
  const profilesData = profileData.data, profiles = profilesData ?? [], checkingAgents = discovery.loading;
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});
  // The page read again each time Settings is asked for one, or one is chosen in its nav (the same one too).
  const [shown, setShown] = useState(0);
  // Cover native pages after the Settings frame is painted, without waiting for its data. Shell discovery starts
  // after that frame too; unrelated requests must not delay revealing the requested page.
  const covered = useRef(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (covered.current) { covered.current = false; coverPage(false); }
      if (before?.isConnected) before.focus();
    };
  }, []);
  useEffect(() => {
    let timer = 0, live = true;
    const frame = requestAnimationFrame(() => { timer = window.setTimeout(() => {
      if (!covered.current) { covered.current = true; coverPage(true); }
      void discover(async () => {
        await agentList.look(true);
        if (live) await agentList.look(false);
        return agentList.store.getState().agents;
      });
    }); });
    return () => { live = false; cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [at, discover]);

  const lists = useCallback(() => readProfiles(async () => (await kulisa.invoke('profiles:list')).profiles), [readProfiles]);
  // Each page asked for, here or by the main process: one fetched after another was asked for shows nothing.
  const asked = useRef(0);
  const show = async (on: Section, id?: string) => {
    const n = ++asked.current;
    await save.current();
    if (n !== asked.current) return;
    if (on !== 'agents' || id !== shownAgent?.id) setSigning(null);
    setPlace({ section: on, id });
    setShown((s) => s + 1);
  };
  // Opened, or asked again, at a page (lib/settings.ts).
  const requested = useRef(at);
  useEffect(() => { void (async () => {
    const n = ++asked.current;
    if (requested.current !== at) {
      await save.current();
      if (n !== asked.current) return;
      requested.current = at;
      setPlace({ section: at.section, id: at.section === 'projects' ? at.id ?? windowStore.getState().projects.project : at.id });
      setShown((n) => n + 1);
    }
    void lists(); void loadAccounts();
  })(); }, [at, lists]);
  useChanged(lists);
  // The one shown; none (or one gone: deleted here or elsewhere), its category's list.
  const shownOf = <T extends { id: string }>(on: Section, all: T[]) => (section === on && place.id ? all.find((x) => x.id === place.id) : undefined);
  const shownProject = shownOf('projects', projects), shownAgent = shownOf('agents', agents), shownProfile = shownOf('profiles', profiles);

  // While an agent installs, it stays.
  const close = useCallback(async () => { if (agentList.store.getState().installing) return; await save.current(); closeSettings(); }, []);
  useEffect(() => {
    onLeaveSettings(close);
    // Esc closing a layer (a menu, a list, a popover, a question) is that layer's, as is one a field keeps (handled). A
    // tooltip handles it too, yet is no layer: one shown under the pointer would take the first Esc. Seen before Radix's
    // own listeners close them.
    let layered = false, tip = false;
    const before = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      layered = [...document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')].some((l) => l.checkVisibility());
      tip = !!document.querySelector('[data-slot="tooltip-content"]');
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !layered && (!e.defaultPrevented || tip)) void close(); };
    addEventListener('keydown', before, true); addEventListener('keydown', esc);
    return () => { onLeaveSettings(null); removeEventListener('keydown', before, true); removeEventListener('keydown', esc); };
  }, [close]);

  async function createProfile() {
    if (!newProfile?.trim()) return;
    const r = await kulisa.invoke('profiles:new', { name: newProfile });
    if (refused(r)) { setProfilesError(r.error); return; }
    setProfiles(r.profiles); setNewProfile(null); setProfilesError(''); void show('profiles', r.id);
  }
  const deleteProject = async (id: string) => { const r = await kulisa.invoke('project:delete', { id }); if (!r?.error) { await lists(); setPlace({ section: 'projects' }); } };
  const deleteProfile = async (id: string) => { const r = await kulisa.invoke('profiles:delete', { profile: id }); if (refused(r)) setProfilesError(r.error ?? ''); else setProfiles(r.profiles); };
  // A new account of an agent: signed in on its page.
  const signIn = async (id: string) => { await show('agents', id); setSigning(id); };
  const newAccount = (): MenuItem[] => [{ heading: 'New Account' }, ...agents.filter((a) => clis.includes(a.id))
    .map((a) => ({ label: `${a.name}…`, agent: a.id, sub: a.installed ? undefined : 'not installed', enabled: !!a.installed && !signing, run: () => signIn(a.id) }))];

  // What acts on one thing of a category: its row's ⋯ and right-click, its page's ⋯.
  const projectMenu = (id: string): MenuItem[] => [{ label: 'Delete Project…', run: () => deleteProject(id) }];
  const profileMenu = (id: string): MenuItem[] => [{ label: 'Delete Profile…', run: () => deleteProfile(id) }];
  const agentMenu = (id: string): MenuItem[] => {
    const a = agents.find((x) => x.id === id);
    return a ? [{ label: 'Install', enabled: !a.installed && !!a.install && !installing, run: () => agentList.install(a.id) },
      { label: 'New Account…', enabled: clis.includes(a.id) && !!a.installed && !signing, run: () => signIn(a.id) }] : [];
  };
  const shade = useShade();
  const one = shownProject ? { id: shownProject.id, name: shownProject.name, menu: projectMenu } : shownAgent ? { id: shownAgent.id, name: shownAgent.name, menu: agentMenu }
    : shownProfile ? { id: shownProfile.id, name: shownProfile.name, menu: profileMenu } : undefined;

  // Beside its heading: one thing's ⋯; a category's button making one of its things (no New Project: docs/window.md).
  const make: ReactNode = one ? <ButtonMenu end items={() => one.menu(one.id)}><Button variant="ghost" size="icon-sm" aria-label="More"><EllipsisIcon /></Button></ButtonMenu>
    : section === 'agents' ? <ButtonMenu end items={newAccount}><Button variant="outline" disabled={!clis.length}><PlusIcon data-icon="inline-start" />New Account</Button></ButtonMenu>
    : section === 'profiles' ? <Button variant="outline" disabled={profilesData === null} onClick={() => setNewProfile('')}><PlusIcon data-icon="inline-start" />New Profile</Button> : null;

  // Category lists share the same group boundary as detail pages.
  const list = (label: string, things: Omit<Thing, 'open'>[], menu: (id: string) => MenuItem[], empty: ReactNode) => (things.length > 0 || empty) && <SettingsGroup>
    <Things label={label} menu={menu} empty={empty} things={things.map((t) => ({ ...t, open: () => void show(section, t.key) }))} />
  </SettingsGroup>;

  const page = (): ReactNode => {
    if (section === 'projects') return shownProject ? <ProjectPage key={`${shownProject.id}:${shown}`} project={shownProject} saveRef={save} onSaved={() => void lists()} action={make} />
      : <div className="flex flex-col gap-6">
        <SettingsHeading title="Projects" description="Manage the folders, agents and browser profiles your tasks use." />
        <SettingsGroup>
          <Things label="Projects" menu={projectMenu} things={projects.map((p) => ({ key: p.id, name: p.name,
            media: <ProjectIcon p={p} size={32} />, description: p.folders.join(' · ') || 'No folders added', open: () => void show('projects', p.id),
            control: <span className="text-xs whitespace-nowrap text-muted-foreground">{p.folders.length} {p.folders.length === 1 ? 'folder' : 'folders'} · {p.tasks.length} {p.tasks.length === 1 ? 'task' : 'tasks'}</span> }))}
            empty={<Empty><EmptyHeader><EmptyMedia variant="icon"><LayoutGridIcon /></EmptyMedia><EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>Create a project from the project sidebar to get started.</EmptyDescription></EmptyHeader></Empty>} />
        </SettingsGroup>
      </div>;
    if (section === 'agents') return shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} checking={checkingAgents || looking} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} action={make} />
      : <>
        <SettingsHeading title="Agents" description="Coding assistants installed on this computer and their connected accounts." action={make} />
        <SettingsError error={discovery.error} />
        {(checkingAgents || looking) && <SettingsLoading>{agents.length ? 'Checking installed agents…' : 'Loading agents…'}</SettingsLoading>}
        {list('Agents', agents.map((a) => { const Mark = agentMark(a.id); return { key: a.id, name: a.name, media: <Mark className="size-6" />,
        badges: !a.installed && <Badge variant="secondary">Not installed</Badge>,
        description: a.installed ? [a.version, a.path].filter(Boolean).join(' · ') || undefined : a.maker }; }),
      agentMenu, !checkingAgents && !looking && !discovery.error && 'No agents.')}
      </>;
    // Keyed by its id alone: a field being typed in stays as the profile changes (saved, or elsewhere).
    if (section === 'profiles') return shownProfile ? <ProfilePage key={shownProfile.id} profile={shownProfile} refreshing={profileData.loading} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setPlace({ section: 'profiles', id: r.id }); }} action={make} />
      : <>
        <SettingsHeading title="Profiles" description="Browser identities for testing. Sign in once for every task." action={make} />
        <SettingsError error={profileData.error} />
        {profilesData === null && !profileData.error && <SettingsGroup><SettingsLoading>Loading profiles…</SettingsLoading></SettingsGroup>}
        {profilesData !== null && profileData.loading && <SettingsLoading>Updating profiles…</SettingsLoading>}
        {newProfile !== null && <SettingsGroup><div className="p-4">
          <AddInPlace label="New profile" placeholder="Its name, e.g. ann@shop.com" value={newProfile} name ok="Create" error={profilesError || undefined}
            onChange={(v) => { setNewProfile(v); setProfilesError(''); }} go={() => void createProfile()} stop={() => { setNewProfile(null); setProfilesError(''); }} />
        </div></SettingsGroup>}
        {newProfile === null && profilesError && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{profilesError}</span></AlertDescription></Alert>}
        {list('Profiles', profiles.map((p) => ({ key: p.id, name: p.name, media: <Avatar size="sm"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback>{p.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>,
          description: [p.description, p.projects.length ? `in ${p.projects.join(', ')}` : 'in no project'].filter(Boolean).join(' · ') })),
        profileMenu, profilesData !== null && newProfile === null && 'No profiles yet.')}
      </>;
    return section === 'github' ? <GitHubPage key={shown} /> : section === 'log' ? <LogPage key={shown} /> : <AboutPage key={shown} />;
  };

  // The log fills the available area; the other pages share a reading column.
  const log = section === 'log';
  return <div id="settings" data-section={section} className={`flex min-h-0 min-w-0 border-t bg-background text-foreground ${className ?? ''}`}>
    {/* over the nav's empty foot: at the right the page's buttons are (the log's) */}
    <Toaster theme={shade} position="bottom-left" />
    <div className="h-full w-14 flex-none border-e sm:w-60">
      <SidebarProvider className="h-full min-h-0">
        <Sidebar collapsible="none" className="h-full w-full">
          <SidebarHeader>
            {/* Back to the tasks, as Windows' Settings: a × at the nav's edge reads as closing the nav */}
            <div className="flex items-center gap-1">
              <Tip text="Back (Esc)" side="bottom">
                <Button variant="ghost" size="icon-sm" aria-label="Back (Esc)" onClick={() => void close()}><ArrowLeftIcon /></Button>
              </Tip>
              <span className="hidden text-sm font-medium sm:inline">Settings</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup><SidebarGroupContent>
              <nav aria-label="Settings"><SidebarMenu>
                {(Object.keys(names) as Section[]).map((k) => { const Icon = icons[k]; return <SidebarMenuItem key={k}>
                  <SidebarMenuButton data-key={k} aria-label={names[k]} title={names[k]} isActive={section === k} aria-current={section === k ? 'page' : undefined} onClick={() => void show(k)}>
                    <Icon /><span className="hidden sm:inline">{names[k]}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>; })}
              </SidebarMenu></nav>
            </SidebarGroupContent></SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>

    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-11 w-full shrink-0 items-center border-b px-6 py-1">
        <Breadcrumb aria-label="Path" className="min-w-0 flex-1">
          <BreadcrumbList>
            {one ? <>
              <BreadcrumbItem><BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); void show(section); }}>{names[section]}</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="min-w-0"><span className="block truncate">{one.name}</span></BreadcrumbPage></BreadcrumbItem>
            </> : <BreadcrumbItem><BreadcrumbPage>{names[section]}</BreadcrumbPage></BreadcrumbItem>}
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      {/* padding, not a box's width: the page's scrollbar stays at the window's edge */}
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto py-6', log ? 'px-6' : 'px-5')}>
        <div className={cn('@container/settings flex w-full flex-col gap-5', log ? 'min-h-0 flex-1' : 'mx-auto max-w-170')}>{page()}</div>
      </div>
    </main>
  </div>;
}
