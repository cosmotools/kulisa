// Settings (docs/window.md, Settings): over the window's area under the title bar, a nav on the left (Projects, Agents,
// Profiles, each with its own under it; GitHub, Log, About), the chosen one's page on the right under its path. Saved as
// it changes. Its ×, Esc (unless a layer was open) and the gear close it, what is typed saved first.
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Breadcrumb, BreadcrumbDivider, BreadcrumbItem, Button, Divider, DrawerHeaderTitle, Field, Input,
  makeStyles, mergeClasses, NavDivider, NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem, NavSectionHeader, Spinner, Text, tokens, Tooltip } from '@fluentui/react-components';
import { AddRegular, BranchFilled, BranchRegular, bundleIcon, DocumentBulletListFilled, DocumentBulletListRegular, DismissRegular, InfoFilled, InfoRegular,
  MoreHorizontalRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { ProjectPage } from './ProjectPage';
import { ProfilePage } from './ProfilePage';
import { AboutPage } from './AboutPage';
import { GitHubPage } from './GitHubPage';
import { LogPage } from './LogPage';
import { AgentPage } from './AgentPage';
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
const GitHubIcon = bundleIcon(BranchFilled, BranchRegular), LogIcon = bundleIcon(DocumentBulletListFilled, DocumentBulletListRegular),
  AboutIcon = bundleIcon(InfoFilled, InfoRegular);

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: tokens.colorNeutralBackground1 },
  line: { flex: 'none' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  // Fluent's nav is drawn on Background4, the darkest, for a frame around the app; here it sits beside a page, so it
  // takes the window's own (the title bar's), its hover and pressed following.
  nav: { height: '100%', '--colorNeutralBackground4': tokens.colorNeutralBackground2,
    '--colorNeutralBackground4Hover': tokens.colorNeutralBackground2Hover, '--colorNeutralBackground4Pressed': tokens.colorNeutralBackground2Pressed },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalSNudge, minWidth: 0 },
  newProfile: { margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}` },
  error: { margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}` },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  path: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacingVerticalM} 0` },
  page: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', paddingBottom: tokens.spacingVerticalXXL },
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
  const show = async (on: Section, id?: string) => {
    await save.current();
    if (on !== 'agents' || id !== agentAt) setSigning(null);
    setSection(on);
    if (on === 'projects' && id) setEditing(id);
    if (on === 'agents' && id) setAgentAt(id);
    if (on === 'profiles' && id) setProfileAt(id);
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
    setEditing(on === 'projects' ? (at.id ?? list.project ?? list.projects[0]?.id ?? null) : (list.project ?? list.projects[0]?.id ?? null)); setShown((n) => n + 1);
    setProfileAt(on === 'profiles' && at.id ? at.id : all[0]?.id);
    if (!await cached) await loadAgents(false); else void loadAgents(false);
    setLoaded(true);
  })(); }, [at, lists]);
  useChanged(lists);
  // The one chosen, or the first while none is (or the chosen one is gone: deleted here or elsewhere).
  const agentAt = agents.some((a) => a.id === agentPick) ? agentPick : agents[0]?.id;
  const profileAt = profiles.some((p) => p.id === profilePick) ? profilePick : profiles[0]?.id;

  // While an agent installs, it stays.
  const close = useCallback(async () => { if (installing()) return; await save.current(); closeSettings(); }, []);
  useEffect(() => {
    onLeaveSettings(close);
    let layered = false;
    // shown ones only: a focused Dropdown keeps its listbox, hidden
    const before = () => { layered = [...document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')].some((l) => l.checkVisibility()); };
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
  if (!loaded) return null;
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

  const width = section === 'log' ? styles.wide : styles.column;
  return <div id="settings" className={mergeClasses(styles.root, className)}>
    <Divider className={styles.line} />
    <div className={styles.body}>
      <RightClickMenu items={(e) => { const k = (e.target as Element).closest('[data-key]')?.getAttribute('data-key'); if (!k) return null;
        const [kind, id] = k.split(':'); if (kind === 'p') void show('projects', id); else if (kind === 'f') void show('profiles', id); else if (kind === 'a') void show('agents', id);
        const it = actions(k); return it.length ? it : null; }}>
        <NavDrawer open type="inline" separator selectedValue={chosen || ''} className={styles.nav} aria-label="Settings"
          onNavItemSelect={(_, d) => { const [kind, id] = String(d.value).split(':');
            void (kind === 'p' ? show('projects', id) : kind === 'a' ? show('agents', id) : kind === 'f' ? show('profiles', id) : show(kind as Section)); }}>
          {/* as the sidebar's (Sidebar.tsx) */}
          <NavDrawerHeader>
            <DrawerHeaderTitle action={<Tooltip content="Close (Esc)" relationship="label">
              <Button appearance="subtle" icon={<DismissRegular />} onClick={() => void close()} /></Tooltip>}>
              <Text size={300} weight="semibold">Settings</Text>
            </DrawerHeaderTitle>
          </NavDrawerHeader>
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
        <div className={mergeClasses(styles.path, width)}>
          <Breadcrumb aria-label="Path">{path.filter(Boolean).flatMap((p, i, all) => [
            <BreadcrumbItem key={i} aria-current={i === all.length - 1 ? 'page' : undefined}><Text weight={i === all.length - 1 ? 'semibold' : 'regular'}>{p}</Text></BreadcrumbItem>,
            ...(i < all.length - 1 ? [<BreadcrumbDivider key={`d${i}`} />] : [])])}</Breadcrumb>
          {chosen && section !== 'github' && section !== 'log' && section !== 'about' && <ButtonMenu end items={() => actions(chosen)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label="More" /></ButtonMenu>}
        </div>
        <div className={mergeClasses(styles.page, width)}>
          {section === 'projects' && (editing ? <ProjectPage key={`${editing}:${shown}`} id={editing} saveRef={save} onSaved={() => void lists()} /> : <Text>No projects yet.</Text>)}
          {section === 'profiles' && (shownProfile ? <ProfilePage key={JSON.stringify(shownProfile)} profile={shownProfile} onChanged={(r) => { setProfiles(r.profiles); if (r.id) setProfileAt(r.id); }} />
            : <Text>No profiles yet.</Text>)}
          {section === 'github' && <GitHubPage />}
          {section === 'about' && <AboutPage />}
          {section === 'log' && <LogPage />}
          {section === 'agents' && (shownAgent ? <AgentPage key={shownAgent.id} agent={shownAgent} signing={signing === shownAgent.id} onSigning={(on) => setSigning(on ? shownAgent.id : null)} />
            : looking ? <Spinner size="tiny" labelPosition="after" label="Looking for agents on this computer…" className={styles.looking} /> : <Text>No agents.</Text>)}
        </div>
      </main>
    </div>
  </div>;
}
