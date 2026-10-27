// Settings' window on React and Fluent UI (the probe; docs/window.md, Settings): a nav on the left (Projects, Agents,
// Profiles, each with its own under it; GitHub, Log, About), the chosen one's page on the right under its path. Saved as
// it changes. Esc closes it unless a layer was open; the OS's × asks the page first (settings:closing).
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AriaLiveAnnouncer, Avatar, Badge, Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Button, Field, FluentProvider, Input,
  makeStyles, NavDivider, NavDrawer, NavDrawerBody, NavItem, NavSectionHeader, Text, tokens, Tooltip } from '@fluentui/react-components';
import { AddRegular, BranchFilled, BranchRegular, bundleIcon, DocumentBulletListFilled, DocumentBulletListRegular, InfoFilled, InfoRegular,
  MoreHorizontalRegular } from '@fluentui/react-icons';
import { dark, light, shade, ThemeShown } from './theme';
import { ButtonMenu, RightClickMenu, type Item } from './Menus';
import { Ask } from './Ask';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
import { install, installing, loadAccounts, loadAgents, useAgents } from './agents';
import { avatarSrc } from './avatar';
import { agentMark } from './AgentMark';
import { ProjectIcon } from './ProjectIcon';
import { refused } from '../../shared/result';
import type { ProjectEntry, SettingsProfile } from '../../shared/types';
import type { SettingsAt } from '../../shared/ipc';
import { ErrorBar } from './ErrorBar';

// A nav item's icon is filled while it is the one chosen (NavItem's own styles switch them).
const GitHubIcon = bundleIcon(BranchFilled, BranchRegular), LogIcon = bundleIcon(DocumentBulletListFilled, DocumentBulletListRegular),
  AboutIcon = bundleIcon(InfoFilled, InfoRegular);

// The layout in a div, not FluentProvider's className, which Fluent copies to every portal's node (App.tsx).
const useStyles = makeStyles({
  root: { display: 'flex', height: '100vh', background: tokens.colorNeutralBackground1 },
  nav: { height: '100%', width: '240px' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalSNudge, minWidth: 0 },
  newProfile: { margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, userSelect: 'text' },
  error: { margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}` },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: `0 ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalXXL}`,
    background: tokens.colorNeutralBackground2 },
  path: { position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacingVerticalMNudge} 0`,
    background: tokens.colorNeutralBackground2 },
});

type Section = 'projects' | 'agents' | 'profiles' | 'github' | 'log' | 'about';

// The page asked for, kept from the start: it may come before React has mounted the page that shows it.
let asked: SettingsAt | null = null, onAsked: ((at: SettingsAt) => void) | null = null;
kulisa.on('settings:show', (at) => { asked = at; onAsked?.(at); });

function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => { kulisa.on('theme', (t) => { document.documentElement.dataset.theme = t; setTheme(t); }); }, []);
  return shade(theme) === 'dark' ? dark : light;
}

export function Settings() {
  const theme = useTheme(), styles = useStyles();
  const [section, setSection] = useState<Section>('projects');
  const [projects, setProjects] = useState<ProjectEntry[]>([]), [editing, setEditing] = useState<string | null>(null);
  const { list: agents, clis, looking, install: inst } = useAgents();
  const [agentPick, setAgentAt] = useState<string>(), [signing, setSigning] = useState<string | null>(null); // signing: the agent a new account is signed in to on its page
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]), [profilePick, setProfileAt] = useState<string>();
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});
  // The project's page read again each time Settings is asked for a page (shown), and when it is there (loaded).
  const [shown, setShown] = useState(0), loaded = useRef(() => {});
  const pageLoaded = useCallback(() => loaded.current(), []);

  const lists = async () => {
    const [list, p] = await Promise.all([kulisa.invoke('projects:list'), kulisa.invoke('profiles:list')]);
    setProjects(list!.projects); setProfiles(p.profiles);
    return { list: list!, profiles: p.profiles };
  };
  const show = async (on: Section, id?: string) => {
    await save.current();
    if (on !== 'agents' || id !== agentAt) setSigning(null);
    setSection(on);
    if (on === 'projects' && id) setEditing(id);
    if (on === 'agents' && id) setAgentAt(id);
    if (on === 'profiles' && id) setProfileAt(id);
  };
  // Opened, or brought to the front, at a page (settings-window.ts); shown once all of it is there (settings:ready).
  useEffect(() => { onAsked = async ({ section: on, id }) => {
    await save.current();
    const { list, profiles: all } = await lists();
    // As last found, looked for again behind them; never looked for yet (nothing in the window has asked), the first
    // look is waited for: a window shown with its agents coming after jumps.
    const cached = loadAgents(true), agentsShown = cached.then((got) => got || loadAgents(false));
    void loadAccounts();
    const at = (on === 'profiles' ? 'profiles' : on === 'log' || on === 'about' ? on : 'projects') as Section;
    const project = at === 'projects' ? (id ?? list.project ?? list.projects[0]?.id ?? null) : (list.project ?? list.projects[0]?.id ?? null);
    const pageShown = at === 'projects' && project && new Promise<void>((done) => { loaded.current = done; });
    setSection(at);
    setEditing(project); setShown((n) => n + 1);
    setProfileAt(at === 'profiles' && id ? id : all[0]?.id);
    await Promise.all([agentsShown, pageShown]);
    if (await cached) void loadAgents(false);
    await document.fonts.ready;
    kulisa.send('settings:ready');
  }; if (asked) onAsked(asked); }, []);
  useEffect(() => { kulisa.on('settings:changed', () => { void lists(); }); }, []);
  // The one chosen, or the first while none is (or the chosen one is gone: deleted here or elsewhere).
  const agentAt = agents.some((a) => a.id === agentPick) ? agentPick : agents[0]?.id;
  const profileAt = profiles.some((p) => p.id === profilePick) ? profilePick : profiles[0]?.id;

  // While an agent installs, it stays.
  const close = async () => { if (installing()) return; await save.current(); kulisa.send('settings:close'); };
  useEffect(() => {
    kulisa.on('settings:closing', () => void close());
    let layered = false;
    // shown ones only: a focused Dropdown keeps its listbox, hidden
    const before = () => { layered = [...document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')].some((l) => l.checkVisibility()); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !layered && !e.defaultPrevented) void close(); };
    addEventListener('keydown', before, true); addEventListener('keydown', esc);
    return () => { removeEventListener('keydown', before, true); removeEventListener('keydown', esc); };
  }, []);

  async function createProfile() {
    if (!newProfile?.trim()) return;
    const r = await kulisa.invoke('profiles:new', { name: newProfile });
    if (refused(r)) { setProfilesError(r.error); return; }
    setProfiles(r.profiles); setNewProfile(null); setProfilesError(''); void show('profiles', r.id);
  }
  const deleteProject = async (id: string) => { const r = await kulisa.invoke('project:delete', { id }); if (!r?.error) { const { list } = await lists(); setEditing(list.projects[0]?.id ?? null); } };
  const deleteProfile = async (id: string) => { const r = await kulisa.invoke('profiles:delete', { profile: id }); if (refused(r)) setProfilesError(r.error ?? ''); else setProfiles(r.profiles); };
  // A new account of an agent: signed in on its page.
  const signIn = async (id: string) => { await show('agents', id); setSigning(id); };
  const newAccount = (): Item[] => [{ heading: 'New Account' }, ...agents.filter((a) => clis.includes(a.id))
    .map((a) => ({ label: `${a.name}…`, sub: a.installed ? undefined : 'not installed', enabled: !!a.installed && !signing, run: () => signIn(a.id) }))];

  // What acts on a row of the nav: its page's ⋯ and its right-click.
  const actions = (key: string): Item[] => {
    const [kind, id] = key.split(':') as [string, string];
    if (kind === 'p') return [{ label: 'Delete Project…', run: () => deleteProject(id) }];
    if (kind === 'f') return [{ label: 'Delete Profile…', run: () => deleteProfile(id) }];
    const a = agents.find((x) => x.id === id);
    if (kind === 'a' && a) return [{ label: 'Install', enabled: !a.installed && !!a.install && !inst?.running, run: () => install(a.id) },
      { label: 'New Account…', enabled: clis.includes(a.id) && !!a.installed && !signing, run: () => signIn(a.id) }];
    return [];
  };
  const chosen = section === 'projects' ? editing && `p:${editing}` : section === 'agents' ? agentAt && `a:${agentAt}` : section === 'profiles' ? profileAt && `f:${profileAt}` : section;
  const shownProfile = profiles.find((p) => p.id === profileAt), shownAgent = agents.find((a) => a.id === agentAt), shownProject = projects.find((p) => p.id === editing);
  const path = section === 'projects' ? ['Projects', shownProject?.name] : section === 'agents' ? ['Agents', shownAgent?.name] : section === 'profiles' ? ['Profiles', shownProfile?.name]
    : [{ github: 'GitHub', log: 'Log', about: 'About' }[section]];

  const head = (title: string, add?: ReactNode) => <div className={styles.head}>
    <NavSectionHeader>{title}</NavSectionHeader>{add}</div>;
  const item = (key: string, label: string, icon: ReactElement, extra?: ReactNode) =>
    <NavItem key={key} value={key} data-key={key} icon={icon} title={label}>
      <span className={styles.label}><Text truncate wrap={false}>{label}</Text>{extra}</span>
    </NavItem>;

  return <ThemeShown.Provider value={theme}><FluentProvider theme={theme}><AriaLiveAnnouncer><div className={styles.root}>
    <RightClickMenu items={(e) => { const k = (e.target as Element).closest('[data-key]')?.getAttribute('data-key'); if (!k) return null;
      const [kind, id] = k.split(':'); if (kind === 'p') void show('projects', id); else if (kind === 'f') void show('profiles', id); else if (kind === 'a') void show('agents', id);
      const it = actions(k); return it.length ? it : null; }}>
      <NavDrawer open type="inline" selectedValue={chosen || ''} className={styles.nav} aria-label="Settings"
        onNavItemSelect={(_, d) => { const [kind, id] = String(d.value).split(':');
          void (kind === 'p' ? show('projects', id) : kind === 'a' ? show('agents', id) : kind === 'f' ? show('profiles', id) : show(kind as Section)); }}>
        <NavDrawerBody>
          {head('Projects')}
          {projects.map((p) => item(`p:${p.id}`, p.name, <ProjectIcon p={p} />))}
          {head('Agents', <ButtonMenu items={newAccount}><Button appearance="subtle" size="small" icon={<AddRegular />} aria-label="New Account" disabled={!clis.length} /></ButtonMenu>)}
          {agents.map((a) => { const Mark = agentMark(a.id); return item(`a:${a.id}`, a.name, <Mark />, !a.installed && <Badge appearance="tint" size="small">not installed</Badge>); })}
          {item('github', 'GitHub', <GitHubIcon />)}
          {head('Profiles', <Tooltip content="New Profile…" relationship="label"><Button appearance="subtle" size="small" icon={<AddRegular />} onClick={() => setNewProfile('')} /></Tooltip>)}
          {profiles.map((p) => item(`f:${p.id}`, p.name, <Avatar size={16} image={{ src: avatarSrc(p.avatar) }} />))}
          {newProfile !== null ? <form onSubmit={(e) => { e.preventDefault(); void createProfile(); }}><Field size="small" validationMessage={profilesError || undefined} className={styles.newProfile}>
            <Input autoFocus data-name value={newProfile} placeholder="Its name, e.g. ann@shop.com" aria-label="New profile"
              onChange={(_, d) => { setNewProfile(d.value); setProfilesError(''); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setNewProfile(null); } }} />
          </Field></form> : profilesError && <ErrorBar className={styles.error}>{profilesError}</ErrorBar>}
          <NavDivider />
          {item('log', 'Log', <LogIcon />)}
          {item('about', 'About', <AboutIcon />)}
        </NavDrawerBody>
      </NavDrawer>
    </RightClickMenu>

    <main className={styles.main}>
      <div className={styles.path}>
        <Breadcrumb aria-label="Path">{path.filter(Boolean).flatMap((p, i, all) => [
          <BreadcrumbItem key={i}><BreadcrumbButton current={i === all.length - 1}>{p}</BreadcrumbButton></BreadcrumbItem>,
          ...(i < all.length - 1 ? [<BreadcrumbDivider key={`d${i}`} />] : [])])}</Breadcrumb>
        {chosen && section !== 'github' && section !== 'log' && section !== 'about' && <ButtonMenu end items={() => actions(chosen)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label="More" /></ButtonMenu>}
      </div>
      {section === 'projects' && (editing ? <ProjectPage key={`${editing}:${shown}`} id={editing} saveRef={save} onSaved={() => void lists()} onLoaded={pageLoaded} /> : <Text>No projects yet.</Text>)}
      {section === 'profiles' && (shownProfile ? <ProfilePage key={JSON.stringify(shownProfile)} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setProfileAt(r.id); }} />
        : <Text>No profiles yet.</Text>)}
      {section === 'github' && <GitHubPage />}
      {section === 'about' && <AboutPage />}
      {section === 'log' && <LogPage />}
      {section === 'agents' && (shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
        : <Text>{looking ? 'Looking for agents on this computer…' : 'No agents.'}</Text>)}
    </main>
    <Ask />
  </div></AriaLiveAnnouncer></FluentProvider></ThemeShown.Provider>;
}
