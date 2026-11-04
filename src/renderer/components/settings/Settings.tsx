// Settings: its nav, and a category's page or one thing's under its path (docs/window.md, Settings).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { avatarSrc } from '../../lib/common';
import { ArrowLeftIcon, BotIcon, EllipsisIcon, GitBranchIcon, InfoIcon, LayoutGridIcon, PlusIcon, ScrollTextIcon, UsersIcon, CircleAlertIcon } from 'lucide-react';
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Sidebar,
  SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, Toaster, Spinner,
  Alert, AlertDescription, Avatar, AvatarImage, AvatarFallback, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@ui';
import { ButtonMenu } from '../Menus';
import { Tip } from '../Tip';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import { AddInPlace, Things, SettingsHeading, SettingsGroup, type Thing } from './kit';
import { useChanged } from './changed';
import { agents as agentList, loadAccounts, useAccounts } from './agents';
import { useAgentList } from '../../lib/agents';
import type { MenuItem } from '../../lib/menu';
import { coverPage } from '../../lib/cover';
import { useShade } from '../../lib/theme';
import { closeSettings, onLeaveSettings } from '../../lib/settings';
import { agentMark } from '../AgentMark';
import { ProjectIcon } from '../ProjectIcon';
import { refused } from '../../../shared/result';
import type { ProjectEntry, ProjectSettings, SettingsProfile } from '../../../shared/types';
import type { SettingsAt } from '../../../shared/ipc';

const icons = { projects: LayoutGridIcon, agents: BotIcon, profiles: UsersIcon, github: GitBranchIcon, log: ScrollTextIcon, about: InfoIcon };
const names = { projects: 'Projects', agents: 'Agents', profiles: 'Profiles', github: 'GitHub', log: 'Log', about: 'About' };
type Section = keyof typeof names;
// What is shown: a category's list without id, one thing's page with it.
interface Place { section: Section; id?: string | null }

export function Settings({ at, className }: { at: SettingsAt; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [first, setFirst] = useState<{ id: string; page: ProjectSettings } | null>(null); // the project's page it opens at, filled
  const [place, setPlace] = useState<Place>({ section: 'projects' }), { section } = place;
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const agents = useAgentList(agentList, (s) => s.agents), looking = useAgentList(agentList, (s) => s.looking);
  const installing = useAgentList(agentList, (s) => s.installing), { clis } = useAccounts();
  const [signing, setSigning] = useState<string | null>(null); // the agent a new account is signed in to on its page
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});
  // The page read again each time Settings is asked for one, or one is chosen in its nav (the same one too).
  const [shown, setShown] = useState(0);
  // The pages of the profiles hidden while it is shown, the keys its own, as a dialog's. Hidden once its first frame is
  // drawn under them (a frame, then a turn: the frame is out), not before: the window stays as it is until Settings is
  // drawn in one go, the panes never empty between. Closed, the keyboard goes back where it was.
  // The agents looked for again then too (the user's shell, each one's --version): before, they slow its first frame.
  const covered = useRef(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (covered.current) { covered.current = false; coverPage(false); }
      if (before?.isConnected) before.focus();
    };
  }, []);
  useEffect(() => {
    if (!loaded || covered.current) return;
    let timer = 0;
    const frame = requestAnimationFrame(() => { timer = window.setTimeout(() => { covered.current = true; coverPage(true); void agentList.look(false); }); });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [loaded]);

  const lists = useCallback(async () => {
    const [list, p] = await Promise.all([kulisa.invoke('project:list'), kulisa.invoke('profiles:list')]);
    setProjects(list!.projects); setProfiles(p.profiles);
    return { list: list!, profiles: p.profiles };
  }, []);
  // Each page asked for, here or by the main process: one fetched after another was asked for shows nothing.
  const asked = useRef(0);
  const show = async (on: Section, id?: string) => {
    const n = ++asked.current;
    await save.current();
    if (n !== asked.current) return;
    if (on !== 'agents' || id !== shownAgent?.id) setSigning(null);
    setFirst(null); // what it opened at is as it was then: a page shown later fetches its own
    setPlace({ section: on, id });
    setShown((s) => s + 1);
  };
  // Opened, or asked again, at a page (lib/settings.ts).
  useEffect(() => { void (async () => {
    const n = ++asked.current;
    await save.current();
    const { list, profiles: all } = await lists();
    // As last found (looked for again once it is drawn): only the Agents page lists them, saying so while there is no
    // list yet.
    const cached = agentList.look(true);
    void loadAccounts();
    // the gear: the window's project; Profiles from a task: their list
    const project = at.section === 'projects' ? (at.id ?? list.project ?? null) : null;
    // Its page waited for: shown as it comes, it jumps.
    const filled = project && await kulisa.invoke('project:settings:get', { id: project });
    await cached;
    if (n !== asked.current) return;
    setFirst(project && filled && !refused(filled) ? { id: project, page: filled } : null);
    setPlace({ section: at.section, id: at.section === 'projects' ? project : at.section === 'profiles' && all.some((p) => p.id === at.id) ? at.id : undefined });
    setShown((n) => n + 1);
    setLoaded(true);
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
  if (!loaded) return null;
  const one = shownProject ? { id: shownProject.id, name: shownProject.name, menu: projectMenu } : shownAgent ? { id: shownAgent.id, name: shownAgent.name, menu: agentMenu }
    : shownProfile ? { id: shownProfile.id, name: shownProfile.name, menu: profileMenu } : undefined;

  // At its path: one thing's ⋯; a category's button making one of its things (no New Project: docs/window.md).
  const make: ReactNode = one ? <ButtonMenu end items={() => one.menu(one.id)}><Button variant="ghost" size="icon-sm" aria-label="More"><EllipsisIcon /></Button></ButtonMenu>
    : section === 'agents' ? <ButtonMenu end items={newAccount}><Button variant="outline" disabled={!clis.length}><PlusIcon data-icon="inline-start" />New Account</Button></ButtonMenu>
    : section === 'profiles' ? <Button variant="outline" onClick={() => setNewProfile('')}><PlusIcon data-icon="inline-start" />New Profile</Button> : null;

  // Category lists share the same group boundary as detail pages.
  const list = (label: string, things: Omit<Thing, 'open'>[], menu: (id: string) => MenuItem[], empty: ReactNode) => (things.length > 0 || empty) && <SettingsGroup>
    <Things label={label} menu={menu} empty={empty} things={things.map((t) => ({ ...t, open: () => void show(section, t.key) }))} />
  </SettingsGroup>;

  const page = (): ReactNode => {
    if (section === 'projects') return shownProject ? <ProjectPage key={`${shownProject.id}:${shown}`} project={shownProject} first={first?.id === shownProject.id ? first.page : undefined} saveRef={save} onSaved={() => void lists()} />
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
    if (section === 'agents') return shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
      : <>
        <SettingsHeading title="Agents" description="Coding assistants installed on this computer and their connected accounts." />
        {list('Agents', agents.map((a) => { const Mark = agentMark(a.id); return { key: a.id, name: a.name, media: <Mark className="size-6" />,
        badges: !a.installed && <Badge variant="secondary">Not installed</Badge>,
        description: a.installed ? [a.version, a.path].filter(Boolean).join(' · ') || undefined : a.maker }; }),
      agentMenu, looking ? <div role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Spinner role={undefined} aria-hidden />Looking for agents on this computer…</div> : 'No agents.')}
      </>;
    // Keyed by its id alone: a field being typed in stays as the profile changes (saved, or elsewhere).
    if (section === 'profiles') return shownProfile ? <ProfilePage key={shownProfile.id} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setPlace({ section: 'profiles', id: r.id }); }} />
      : <>
        <SettingsHeading title="Profiles" description="Browser identities for testing. Sign in once for every task." />
        {newProfile !== null && <SettingsGroup><div className="p-4">
          <AddInPlace label="New profile" placeholder="Its name, e.g. ann@shop.com" value={newProfile} name ok="Create" error={profilesError || undefined}
            onChange={(v) => { setNewProfile(v); setProfilesError(''); }} go={() => void createProfile()} stop={() => { setNewProfile(null); setProfilesError(''); }} />
        </div></SettingsGroup>}
        {newProfile === null && profilesError && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{profilesError}</span></AlertDescription></Alert>}
        {list('Profiles', profiles.map((p) => ({ key: p.id, name: p.name, media: <Avatar size="sm"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback>{p.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>,
          description: [p.description, p.projects.length ? `in ${p.projects.join(', ')}` : 'in no project'].filter(Boolean).join(' · ') })),
        profileMenu, newProfile === null && 'No profiles yet.')}
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
      <div className={cn('flex min-h-12 w-full flex-wrap items-center justify-between gap-3 pt-6 pb-4', log ? 'px-6' : 'mx-auto max-w-180 px-5')}>
        <Breadcrumb aria-label="Path" className="min-w-0 flex-1">
          <BreadcrumbList>
            {log ? <BreadcrumbItem><h1 className="text-xl tracking-tight"><BreadcrumbPage><span className="font-semibold">Log</span></BreadcrumbPage></h1></BreadcrumbItem> : one ? <>
              <BreadcrumbItem><BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); void show(section); }}>{names[section]}</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="min-w-0"><span className="block truncate">{one.name}</span></BreadcrumbPage></BreadcrumbItem>
            </> : <BreadcrumbItem><BreadcrumbPage>{names[section]}</BreadcrumbPage></BreadcrumbItem>}
          </BreadcrumbList>
        </Breadcrumb>
        {make}
      </div>
      {/* padding, not a box's width: the page's scrollbar stays at the window's edge */}
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto pb-6', log ? 'px-6' : 'px-5')}>
        <div className={cn('@container/settings flex w-full flex-col gap-5', log ? 'min-h-0 flex-1' : 'mx-auto max-w-170')}>{page()}</div>
      </div>
    </main>
  </div>;
}
