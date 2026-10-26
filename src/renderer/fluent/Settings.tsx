// Settings' window on React and Fluent UI (the probe; docs/window.md, Settings): a nav on the left (Projects, Agents,
// Profiles, each with its own under it; GitHub, Log, About), the chosen one's page on the right under its path. Saved as
// it changes. Esc closes it unless a layer was open; the OS's × asks the page first (settings:closing).
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Button, FluentProvider, Input, MessageBar, MessageBarBody,
  NavDrawer, NavDrawerBody, NavItem, NavSectionHeader, Text, Tooltip } from '@fluentui/react-components';
import { BotIcon, EllipsisIcon, GitBranchIcon, InfoIcon, PlusIcon, ScrollTextIcon } from 'lucide-react';
import { dark, light, shade } from './theme';
import { ButtonMenu, RightClickMenu, type Item } from './Menus';
import { Ask } from './Ask';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { avatarSrc } from './avatar';
import { refused } from '../../shared/result';
import type { AgentInfo, ProjectEntry, SettingsProfile } from '../../shared/types';
import type { SettingsAt } from '../../shared/ipc';

type Section = 'projects' | 'agents' | 'profiles' | 'github' | 'log' | 'about';

// The page asked for, kept from the start: it may come before React has mounted the page that shows it.
let asked: SettingsAt | null = null, onAsked: ((at: SettingsAt) => void) | null = null;
kulisa.on('settings:show', (at) => { asked = at; onAsked?.(at); });

function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => kulisa.on('theme', (t) => { document.documentElement.dataset.theme = t; setTheme(t); }), []);
  return shade(theme) === 'dark' ? dark : light;
}

export function Settings() {
  const theme = useTheme();
  const [section, setSection] = useState<Section>('projects');
  const [projects, setProjects] = useState<ProjectEntry[]>([]), [editing, setEditing] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]), [agentAt, setAgentAt] = useState<string>();
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]), [profileAt, setProfileAt] = useState<string>();
  const [newProfile, setNewProfile] = useState<string | null>(null), [profilesError, setProfilesError] = useState('');
  const save = useRef(async () => {});

  const lists = async () => {
    const [list, p] = await Promise.all([kulisa.invoke('projects:list'), kulisa.invoke('profiles:list')]);
    setProjects(list!.projects); setProfiles(p.profiles);
    return { list: list!, profiles: p.profiles };
  };
  const loadAgents = async (cached: boolean) => { const r = await kulisa.invoke('agents:list', { details: true, cached }); if (r.list) setAgents(r.list); };
  const show = async (on: Section, id?: string) => {
    await save.current();
    setSection(on);
    if (on === 'projects' && id) setEditing(id);
    if (on === 'agents' && id) setAgentAt(id);
    if (on === 'profiles' && id) setProfileAt(id);
  };
  // Opened, or brought to the front, at a page (settings-window.ts); shown once all of it is there (settings:ready).
  useEffect(() => { onAsked = async ({ section: on, id }) => {
    const { list, profiles: all } = await lists();
    void loadAgents(true).then(() => loadAgents(false));
    const at = (on === 'profiles' ? 'profiles' : on === 'log' || on === 'about' ? on : 'projects') as Section;
    setSection(at);
    setEditing(at === 'projects' ? (id ?? list.project ?? list.projects[0]?.id ?? null) : (list.project ?? list.projects[0]?.id ?? null));
    setProfileAt(at === 'profiles' && id ? id : all[0]?.id);
    await document.fonts.ready;
    kulisa.send('settings:ready');
  }; if (asked) onAsked(asked); }, []);
  useEffect(() => kulisa.on('settings:changed', () => { void lists(); }), []);
  useEffect(() => { if (!agents.some((a) => a.id === agentAt)) setAgentAt(agents[0]?.id); }, [agents, agentAt]);

  const close = async () => { await save.current(); kulisa.send('settings:close'); };
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
  const newAccount = (): Item[] => [{ heading: 'New Account' }, ...agents.map((a) => ({ label: `${a.name}…`, sub: 'not in the probe', enabled: false, run: () => undefined }))];

  // What acts on a row of the nav: its page's ⋯ and its right-click.
  const actions = (key: string): Item[] => {
    const [kind, id] = key.split(':') as [string, string];
    if (kind === 'p') return [{ label: 'Delete Project…', run: () => deleteProject(id) }];
    if (kind === 'f') return [{ label: 'Delete Profile…', run: () => deleteProfile(id) }];
    if (kind === 'a') return newAccount();
    return [];
  };
  const chosen = section === 'projects' ? editing && `p:${editing}` : section === 'agents' ? agentAt && `a:${agentAt}` : section === 'profiles' ? profileAt && `f:${profileAt}` : section;
  const shownProfile = profiles.find((p) => p.id === profileAt), shownAgent = agents.find((a) => a.id === agentAt), shownProject = projects.find((p) => p.id === editing);
  const path = section === 'projects' ? ['Projects', shownProject?.name] : section === 'agents' ? ['Agents', shownAgent?.name] : section === 'profiles' ? ['Profiles', shownProfile?.name]
    : [{ github: 'GitHub', log: 'Log', about: 'About' }[section]];

  const head = (title: string, add?: ReactNode) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <NavSectionHeader>{title}</NavSectionHeader>{add}</div>;
  const item = (key: string, label: string, icon: ReactElement, extra?: ReactNode) =>
    <NavItem key={key} value={key} data-key={key} icon={icon} title={label}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>{extra}</span>
    </NavItem>;

  return <FluentProvider theme={theme} style={{ display: 'flex', height: '100vh', background: 'var(--colorNeutralBackground1)' }}>
    <RightClickMenu items={(e) => { const k = (e.target as Element).closest('[data-key]')?.getAttribute('data-key'); if (!k) return null;
      const [kind, id] = k.split(':'); if (kind === 'p') void show('projects', id); else if (kind === 'f') void show('profiles', id); else if (kind === 'a') void show('agents', id);
      const it = actions(k); return it.length ? it : null; }}>
      <NavDrawer open type="inline" selectedValue={chosen || ''} style={{ height: '100%', width: 240 }} aria-label="Settings"
        onNavItemSelect={(_, d) => { const [kind, id] = String(d.value).split(':');
          void (kind === 'p' ? show('projects', id) : kind === 'a' ? show('agents', id) : kind === 'f' ? show('profiles', id) : show(kind as Section)); }}>
        <NavDrawerBody>
          {head('Projects')}
          {projects.map((p) => item(`p:${p.id}`, p.name, <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color }} />))}
          {head('Agents', <ButtonMenu items={newAccount}><Button appearance="subtle" size="small" icon={<PlusIcon />} aria-label="New Account" /></ButtonMenu>)}
          {agents.map((a) => item(`a:${a.id}`, a.name, <BotIcon />, !a.installed && <Text size={100}>not installed</Text>))}
          {item('github', 'GitHub', <GitBranchIcon />)}
          {head('Profiles', <Tooltip content="New Profile…" relationship="label"><Button appearance="subtle" size="small" icon={<PlusIcon />} onClick={() => setNewProfile('')} /></Tooltip>)}
          {profiles.map((p) => item(`f:${p.id}`, p.name, <Avatar size={16} image={{ src: avatarSrc(p.avatar) }} />))}
          {newProfile !== null && <Input autoFocus size="small" value={newProfile} placeholder="Its name, e.g. ann@shop.com" aria-label="New profile" style={{ margin: '4px 8px' }}
            onChange={(_, d) => { setNewProfile(d.value); setProfilesError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void createProfile(); if (e.key === 'Escape') { e.stopPropagation(); setNewProfile(null); } }} />}
          {profilesError && <Text size={200} style={{ margin: '0 8px', color: 'var(--colorPaletteRedForeground1)' }}>{profilesError}</Text>}
          <div style={{ height: 12 }} />
          {item('log', 'Log', <ScrollTextIcon />)}
          {item('about', 'About', <InfoIcon />)}
        </NavDrawerBody>
      </NavDrawer>
    </RightClickMenu>

    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '0 24px 24px', background: 'var(--colorNeutralBackground2)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', background: 'var(--colorNeutralBackground2)' }}>
        <Breadcrumb aria-label="Path">{path.filter(Boolean).flatMap((p, i, all) => [
          <BreadcrumbItem key={i}><BreadcrumbButton current={i === all.length - 1}>{p}</BreadcrumbButton></BreadcrumbItem>,
          ...(i < all.length - 1 ? [<BreadcrumbDivider key={`d${i}`} />] : [])])}</Breadcrumb>
        {chosen && actions(chosen).length > 0 && <ButtonMenu end items={() => actions(chosen)}><Button appearance="subtle" icon={<EllipsisIcon />} aria-label="More" /></ButtonMenu>}
      </div>
      {section === 'projects' && (editing ? <ProjectPage key={editing} id={editing} saveRef={save} onSaved={() => void lists()} /> : <Text>No projects yet.</Text>)}
      {section === 'profiles' && (shownProfile ? <ProfilePage profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setProfileAt(r.id); }} />
        : <Text>No profiles yet.</Text>)}
      {section === 'github' && <GitHubPage />}
      {section === 'about' && <AboutPage />}
      {section === 'log' && <LogPage />}
      {section === 'agents' && <MessageBar><MessageBarBody>This page is not in the probe: Settings on Fluent UI has a project's, a profile's and About.</MessageBarBody></MessageBar>}
    </main>
    <Ask />
  </FluentProvider>;
}
