// Settings: its nav, and a category's page or one thing's under its path (docs/window.md, Settings).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, BotIcon, EllipsisIcon, GitBranchIcon, InfoIcon, LayoutGridIcon, PlusIcon, ScrollTextIcon, UsersIcon } from 'lucide-react';
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button,
  Card, CardContent, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, Toaster } from '@ui';
import { ButtonMenu } from '../Menus';
import { Tip } from '../Tip';
import { Working } from '../Working';
import { ErrorBar } from '../ErrorBar';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import { AddInPlace, ProfileAvatar, Things, type Thing } from './kit';
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
  // The project's page read again each time Settings is asked for a page.
  const [shown, setShown] = useState(0);
  // The pages of the profiles hidden while it is shown, the keys its own, as a dialog's. Hidden as it is filled, not
  // before: the window stays as it is until Settings is drawn in one go. Closed, the keyboard goes back where it was.
  const covered = useRef(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (covered.current) { covered.current = false; void coverPage(false); }
      if (before?.isConnected) before.focus();
    };
  }, []);

  const lists = useCallback(async () => {
    const [list, p] = await Promise.all([kulisa.invoke('projects:list'), kulisa.invoke('profiles:list')]);
    setProjects(list!.projects); setProfiles(p.profiles);
    return { list: list!, profiles: p.profiles };
  }, []);
  const show = async (on: Section, id?: string) => {
    await save.current();
    if (on !== 'agents' || id !== shownAgent?.id) setSigning(null);
    setFirst(null); // what it opened at is as it was then: a page shown later fetches its own
    setPlace({ section: on, id });
  };
  // Opened, or asked again, at a page (lib/settings.ts).
  useEffect(() => { void (async () => {
    await save.current();
    const { list, profiles: all } = await lists();
    // As last found, looked for again behind them; never looked for yet (nothing in the window has asked), the first
    // look is waited for: a nav shown with its agents coming after jumps.
    const cached = agentList.look(true);
    void loadAccounts();
    // the gear: the window's project; Profiles from a task: their list
    const project = at.section === 'projects' ? (at.id ?? list.project ?? null) : null;
    // Its page waited for too, as the agents are: shown as it comes, it jumps.
    const page = project ? kulisa.invoke('project:settings-get', { id: project }) : null;
    if (!await cached) await agentList.look(false); else void agentList.look(false);
    const filled = page && await page;
    setFirst(project && filled && !refused(filled) ? { id: project, page: filled } : null);
    setPlace({ section: at.section, id: at.section === 'projects' ? project : at.section === 'profiles' && all.some((p) => p.id === at.id) ? at.id : undefined });
    setShown((n) => n + 1);
    if (!covered.current) { covered.current = true; await coverPage(true); }
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
    : section === 'profiles' ? <Button onClick={() => setNewProfile('')}><PlusIcon data-icon="inline-start" />New Profile</Button> : null;

  // A category's things, each row going to its page; nothing to say of none, no card.
  const list = (label: string, things: Omit<Thing, 'open'>[], menu: (id: string) => MenuItem[], empty: ReactNode) => (things.length > 0 || empty) && <Card><CardContent>
    <Things label={label} menu={menu} empty={empty} things={things.map((t) => ({ ...t, open: () => void show(section, t.key) }))} />
  </CardContent></Card>;

  const page = (): ReactNode => {
    if (section === 'projects') return shownProject ? <ProjectPage key={`${shownProject.id}:${shown}`} id={shownProject.id} first={first?.id === shownProject.id ? first.page : undefined} saveRef={save} onSaved={() => void lists()} />
      : list('Projects', projects.map((p) => ({ key: p.id, name: p.name, media: <ProjectIcon p={p} size={24} />,
        description: [`${p.folders.length} ${p.folders.length === 1 ? 'folder' : 'folders'}`, `${p.tasks.length} ${p.tasks.length === 1 ? 'task' : 'tasks'}`].join(' · ') })),
      projectMenu, 'No projects yet.');
    if (section === 'agents') return shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
      : list('Agents', agents.map((a) => { const Mark = agentMark(a.id); return { key: a.id, name: a.name, media: <Mark className="size-6" />,
        badges: !a.installed && <Badge variant="secondary">Not installed</Badge>,
        description: a.installed ? [a.version, a.path].filter(Boolean).join(' · ') || undefined : a.maker }; }),
      agentMenu, looking ? <Working>Looking for agents on this computer…</Working> : 'No agents.');
    // Keyed by its id alone: a field being typed in stays as the profile changes (saved, or elsewhere).
    if (section === 'profiles') return shownProfile ? <ProfilePage key={shownProfile.id} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setPlace({ section: 'profiles', id: r.id }); }} />
      : <>
        {newProfile !== null && <Card><CardContent>
          <AddInPlace label="New profile" placeholder="Its name, e.g. ann@shop.com" value={newProfile} name ok="Create" error={profilesError || undefined}
            onChange={(v) => { setNewProfile(v); setProfilesError(''); }} go={() => void createProfile()} stop={() => { setNewProfile(null); setProfilesError(''); }} />
        </CardContent></Card>}
        {newProfile === null && profilesError && <ErrorBar>{profilesError}</ErrorBar>}
        {list('Profiles', profiles.map((p) => ({ key: p.id, name: p.name, media: <ProfileAvatar name={p.name} avatar={p.avatar} />,
          description: [p.description, p.projects.length ? `in ${p.projects.join(', ')}` : 'in no project'].filter(Boolean).join(' · ') })),
        profileMenu, newProfile === null && 'No profiles yet.')}
      </>;
    return section === 'github' ? <GitHubPage /> : section === 'log' ? <LogPage /> : <AboutPage />;
  };

  // The log as wide and high as the window lets it; the other pages a column from the left, scrolling under the path.
  const wide = section === 'log';
  return <div id="settings" className={`flex min-h-0 min-w-0 border-t bg-background ${className ?? ''}`}>
    {/* over the nav's empty foot: at the right the page's buttons are (the log's) */}
    <Toaster theme={shade} position="bottom-left" />
    <div className="h-full w-60 flex-none border-e">
      <SidebarProvider className="h-full min-h-0">
        <Sidebar collapsible="none" className="h-full w-full">
          <SidebarHeader>
            {/* Back to the tasks, as Windows' Settings: a × at the nav's edge reads as closing the nav */}
            <div className="flex items-center gap-1">
              <Tip text="Back (Esc)" side="bottom">
                <Button variant="ghost" size="icon-sm" aria-label="Back (Esc)" onClick={() => void close()}><ArrowLeftIcon /></Button>
              </Tip>
              <span className="text-sm font-medium">Settings</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup><SidebarGroupContent>
              <nav aria-label="Settings"><SidebarMenu>
                {(Object.keys(names) as Section[]).map((k) => { const Icon = icons[k]; return <SidebarMenuItem key={k}>
                  <SidebarMenuButton data-key={k} isActive={section === k} aria-current={section === k ? 'page' : undefined} onClick={() => void show(k)}>
                    <Icon />{names[k]}
                  </SidebarMenuButton>
                </SidebarMenuItem>; })}
              </SidebarMenu></nav>
            </SidebarGroupContent></SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>

    <main className="flex min-w-0 flex-1 flex-col">
      <div className={`flex min-h-12 items-center justify-between gap-3 pt-6 pb-4 ${wide ? 'px-6' : 'max-w-230 px-10'}`}>
        <Breadcrumb aria-label="Path">
          <BreadcrumbList>
            {one ? <>
              <BreadcrumbItem><BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); void show(section); }}>{names[section]}</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{one.name}</BreadcrumbPage></BreadcrumbItem>
            </> : <BreadcrumbItem><BreadcrumbPage>{names[section]}</BreadcrumbPage></BreadcrumbItem>}
          </BreadcrumbList>
        </Breadcrumb>
        {make}
      </div>
      {/* padding, not a box's width: the page's scrollbar stays at the window's edge */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-auto pb-6 ${wide ? 'px-6' : 'px-10'}`}>
        <div className={`flex flex-col gap-4 ${wide ? 'min-h-0 flex-1' : 'w-full max-w-210'}`}>{page()}</div>
      </div>
    </main>
  </div>;
}
