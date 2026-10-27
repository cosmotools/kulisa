// A project's page in Settings (docs/tasks.md, Projects): its name, its Folders, Agents and Profiles (a card each, a
// list with its toolbar), its local addresses; saved as they change. Agents' + → New Account signs in to one there
// (SignIn.tsx), added to the project.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Dropdown, Field, Input, Link, makeStyles, MessageBar, MessageBarActions, MessageBarBody, Option, Persona, Spinner, Text,
  tokens } from '@fluentui/react-components';
import { AddRegular, StarRegular, SubtractRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from './Menus';
import { List } from './List';
import { Group, Tool } from './Group';
import { SignIn } from './SignIn';
import { avatarSrc } from './avatar';
import { refused, type Result } from '../../shared/result';
import type { ProjectAgent, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../shared/types';
import { useCommonStyles } from './theme';
import { ErrorBar } from './ErrorBar';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  inPlace: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  buttons: { display: 'flex', gap: tokens.spacingHorizontalS, justifyContent: 'end' },
  account: { minWidth: 0 },
});

const base = (f: string) => f.split(/[\\/]/).pop()!;
const rowAt = (e: MouseEvent, attr: string) => (e.target as Element).closest<HTMLElement>(`[data-${attr}]`)?.getAttribute(`data-${attr}`) ?? null;
// A list's selection while its row is there: it goes with its row.
const kept = <T,>(sel: string | undefined, rows: T[], key: (r: T) => string) => (rows.some((r) => key(r) === sel) ? sel : undefined);

// The profiles changed elsewhere (a tasks' window, the agent): the page shown reads its own again (one listener: kulisa.on
// has no off).
const changed = new Set<() => void>();
kulisa.on('settings:changed', () => { for (const f of changed) f(); });

export function ProjectPage({ id, onSaved, onLoaded, saveRef }: { id: string; onSaved: () => void; onLoaded: () => void; saveRef: { current: () => Promise<void> } }) {
  const styles = useStyles(), common = useCommonStyles();
  const [s, setS] = useState<ProjectSettings | null>(null);
  const [name, setName] = useState(''), [local, setLocal] = useState(''), [error, setError] = useState('');
  const [folders, setFolders] = useState<ProjectFolder[]>([]), [github, setGithub] = useState<ProjectGitHub | null>(null);
  const [mine, setMine] = useState<ProjectAgent[]>([]), [profiles, setProfiles] = useState<ProjectProfile[]>([]), [others, setOthers] = useState<ProjectProfile[]>([]);
  const [folderPick, setFolderSel] = useState<string>(), [agentPick, setAgentSel] = useState<string>(), [profilePick, setProfileSel] = useState<string>();
  const folderSel = kept(folderPick, folders, (f) => f.folder), agentSel = kept(agentPick, mine, (a) => a.id), profileSel = kept(profilePick, profiles, (p) => p.id);
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
  const saved = useRef(''), loaded = useRef(onLoaded); // told once, as it is first read

  const githubNow = useCallback(async (answer?: Promise<Result<ProjectGitHub>>) => {
    const r = await (answer ?? kulisa.invoke('project:github-get', { id }));
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else setGithub(r);
  }, [id]);
  // The accounts to add as they are now (one made, or deleted in Settings → Agents, meanwhile), and the project's own.
  const agentsNow = async () => {
    const c = await kulisa.invoke('project:settings-get', { id });
    if (!refused(c)) { setS(c); setMine(c.projectAgents); }
  };
  useEffect(() => {
    void kulisa.invoke('project:settings-get', { id }).then((c) => {
      loaded.current();
      if (refused(c)) return;
      setS(c); setName(c.name); setLocal((c.local || []).join(' ')); setFolders(c.folders); setMine(c.projectAgents);
      setProfiles(c.profiles); setOthers(c.others);
      saved.current = JSON.stringify({ name: c.name.trim(), local: c.local || [] });
      void githubNow();
    });
  }, [id, githubNow]);
  useEffect(() => {
    const again = async () => { const c = await kulisa.invoke('project:settings-get', { id }); if (!refused(c)) { setProfiles(c.profiles); setOthers(c.others); } };
    changed.add(again);
    return () => { changed.delete(again); };
  }, [id]);

  // Its name and local addresses, saved on Enter, on leaving them, and before Settings closes or another page shows.
  const look = () => JSON.stringify({ name: name.trim(), local: local.split(/[\s,]+/).filter(Boolean) });
  async function save() {
    const now = look();
    if (now === saved.current || !name.trim()) return;
    saved.current = now;
    const r = await kulisa.invoke('project:settings', { id, ...JSON.parse(now) });
    setError(r?.error || '');
    if (r?.error) saved.current = ''; else onSaved();
  }
  useEffect(() => { saveRef.current = save; });

  async function changeFolders(answer: Promise<Result<{ folders?: ProjectFolder[] }>>) {
    setErrors((e) => ({ ...e, folders: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else if (r.folders) { setFolders(r.folders); void githubNow(); }
    return r;
  }
  const removeFolder = (f = folderSel) => f && changeFolders(kulisa.invoke('project:folder-remove', { id, folder: f }));
  const defaultFolder = (f = folderSel) => f && changeFolders(kulisa.invoke('project:folder-default', { id, folder: f }));
  async function clone() {
    if (!text.trim()) return;
    setCloning(true);
    if (!(await changeFolders(kulisa.invoke('project:folder-clone', { id, url: text })))?.error) { setText(''); setAdding(''); }
    setCloning(false);
  }

  async function agents(answer: Promise<Result<{ agents: ProjectAgent[] }>>) {
    setErrors((e) => ({ ...e, agents: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, agents: r.error })); else setMine(r.agents);
  }
  const isDefault = (a?: string) => !!a && !!mine.find((m) => m.id === a)?.default;
  const defaultAgent = (a: string | null) => agents(kulisa.invoke('project:agent-default', { id, agent: a }));
  const removeAgent = (a = agentSel) => a && agents(kulisa.invoke('project:agent-remove', { id, agent: a }));
  const addable = (s?.agents ?? []).filter((x) => !mine.some((m) => m.id === x.id));
  const agentMenu = (): Item[] => [...addable.map((x) => ({ label: x.name, run: () => agents(kulisa.invoke('project:agent-add', { id, agent: x.id })) })),
    ...(s?.clis.length ? [...(addable.length ? ['-' as const] : []), { heading: 'New Account' },
      ...s.clis.map((c) => ({ label: `${c.name}…`, run: () => { setErrors((e) => ({ ...e, agents: '' })); setSigning(c); } }))] : [])];

  async function profileChange(answer: Promise<Result<{ profiles: ProjectProfile[]; others: ProjectProfile[] }>>) {
    setErrors((e) => ({ ...e, profiles: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, profiles: r.error })); else { setProfiles(r.profiles); setOthers(r.others); onSaved(); }
    return r;
  }
  const removeProfile = (p = profileSel) => p && profileChange(kulisa.invoke('project:profile-remove', { id, profile: p }));
  async function addProfile() {
    if (!text.trim()) return;
    if (!(await profileChange(kulisa.invoke('project:profile-new', { id, name: text })))?.error) { setText(''); setAdding(''); }
  }
  const profileMenu = (): Item[] => [{ label: 'New Profile…', run: () => { setText(''); setAdding('profile'); } },
    ...(others.length ? ['-' as const, { heading: 'Other Profiles' }, ...others.map((p) => ({ label: p.name, sub: p.also.join(', ') || 'in no project',
      avatar: p.avatar, run: () => profileChange(kulisa.invoke('project:profile-add', { id, profile: p.id })) }))] : [])];

  const githubOf = (f: string) => github?.repos.find((g) => g.folder === f);
  const accountName = (a: ProjectGitHub['accounts'][number]) => (a.kind === 'pat' ? `${a.login} (token)` : a.login);
  const stop = () => { setAdding(''); setText(''); };
  // What is added in place under a list: a field with its buttons, Enter submits it, Esc puts it away; the refusal at it.
  const inPlace = (what: 'clone' | 'profile', label: string, placeholder: string, go: () => void, ok: string, error: string) => adding === what &&
    <form className={styles.inPlace} onSubmit={(e) => { e.preventDefault(); go(); }}>
      <Field label={label} validationMessage={error || undefined} className={common.selectable}>
        <Input autoFocus data-name={what === 'profile' || undefined} value={text} placeholder={placeholder} spellCheck={false} onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      </Field>
      <div className={styles.buttons}><Button onClick={stop}>Cancel</Button><Button appearance="primary" type="submit" disabled={cloning} icon={cloning ? <Spinner size="tiny" /> : undefined}>{ok}</Button></div>
    </form>;
  // A refusal not at a field (the field put away, or none).
  const err = (t: string) => t && <ErrorBar>{t}</ErrorBar>;
  if (!s) return null;

  return <div className={styles.page}>
    <Field label="Name" validationMessage={error || undefined}>
      <Input value={name} data-name maxLength={64} spellCheck={false} onChange={(_, d) => { setName(d.value); setError(''); }} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
    </Field>

    <Group title="Folders" hint="The repositories or folders its tasks work on; new tasks get a copy of the default one." tools={<>
      <ButtonMenu items={() => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder-add', { id })) },
        { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }]}><Tool label="Add a folder or a repository" icon={<AddRegular />} /></ButtonMenu>
      <Tool label="Remove from the project (its folder stays)" icon={<SubtractRegular />} disabled={!folderSel} onClick={() => void removeFolder()} />
      <Tool label="Make Default: new tasks' agents start in its copy" icon={<StarRegular />} disabled={!folderSel || folderSel === folders[0]?.folder} onClick={() => void defaultFolder()} />
    </>}>
      <RightClickMenu items={(e) => { const f = rowAt(e, 'folder'); if (!f) return null; setFolderSel(f);
        return [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) }, { label: 'Remove from the Project', run: () => removeFolder(f) }]; }}>
        <List label="Folders" attr="folder" rows={folders} id={(r) => r.folder} rowLabel={(r) => base(r.folder)} selected={folderSel} onSelect={setFolderSel}
          onDelete={(k) => void removeFolder(k)} columns={[
            { label: 'Name', width: '22%', cell: (r) => base(r.folder) },
            { label: 'Folder', cell: (r) => <Text size={200} title={r.folder}>{r.folder}</Text> },
            { label: 'GitHub', width: '24%', cell: (r) => { const g = githubOf(r.folder);
              if (!g?.remote) return null;
              if (g.state === 'not-github') return <Text size={200}>not a GitHub address</Text>;
              if (!github!.accounts.length) return <Text size={200}>no account</Text>;
              return <Dropdown size="small" className={styles.account} aria-label={`GitHub account of ${g.repo}`} placeholder="Choose…"
                value={github!.accounts.find((a) => a.id === g.account) ? accountName(github!.accounts.find((a) => a.id === g.account)!) : ''}
                selectedOptions={g.account ? [g.account] : []}
                // its keys are its own (Delete and the arrows would act on the list's row), but Esc, which closes Settings
                onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
                onOptionSelect={(_, d) => d.optionValue && void githubNow(kulisa.invoke('project:github-set', { id, remote: g.remote!, account: d.optionValue }))}>
                {github!.accounts.map((a) => <Option key={a.id} value={a.id}>{accountName(a)}</Option>)}
              </Dropdown>; } },
            { label: '', width: '108px', cell: (r) => <>{r.git !== 'ok' && <Badge appearance="tint" color="warning">{r.git === 'none' ? 'no git' : 'no commit yet'}</Badge>}
              {r.folder === folders[0]?.folder && folders.length > 1 && <Badge appearance="outline">default</Badge>}</> },
          ]} />
      </RightClickMenu>
      {inPlace('clone', 'Repository URL', 'git@github.com:me/shop.git', () => void clone(), cloning ? 'Cloning…' : 'Clone', errors.folders)}
      {github?.repos.filter((g) => g.why).map((g) => <MessageBar key={g.folder} intent="warning">
        <MessageBarBody>{base(g.folder)}: {g.why}{g.install && ' Install it, or ask its owner to.'}</MessageBarBody>
        {g.install && <MessageBarActions><Link href={g.install} target="_blank">Install it on {g.owner}</Link></MessageBarActions>}
      </MessageBar>)}
      {adding !== 'clone' && err(errors.folders)}
    </Group>

    <Group title="Agents" hint="The agents its tasks run; + makes a task with the default one." tools={<>
      <ButtonMenu items={agentMenu}><Tool label="Add an agent" icon={<AddRegular />} disabled={!!signing || (!addable.length && !s.clis.length)} /></ButtonMenu>
      <Tool label="Remove from the project (its tasks keep it)" icon={<SubtractRegular />} disabled={!agentSel} onClick={() => void removeAgent()} />
      <Tool label={isDefault(agentSel) ? 'No Default: a new task starts with no agent' : 'Make Default: + makes a task with it'} icon={<StarRegular />}
        disabled={!agentSel} onClick={() => agentSel && void defaultAgent(isDefault(agentSel) ? null : agentSel)} />
    </>}>
      {mine.length ? <RightClickMenu items={(e) => { const a = rowAt(e, 'agent'); if (!a) return null; setAgentSel(a);
        return [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
          { label: 'Remove from the Project', run: () => removeAgent(a) }]; }}>
        <List label="Agents" attr="agent" rows={mine} id={(a) => a.id} rowLabel={(a) => a.agent} selected={agentSel} onSelect={setAgentSel}
          onDelete={(k) => void removeAgent(k)} columns={[
            { label: 'Agent', width: '40%', cell: (a) => a.agent },
            { label: 'Account', cell: (a) => <Text size={200}>{a.email ?? '—'}</Text> },
            { label: '', width: '80px', cell: (a) => a.default && <Badge appearance="outline">default</Badge> },
          ]} />
      </RightClickMenu> : !signing && <Text size={200}>No agents yet: its tasks get the terminal only.</Text>}
      {signing && <SignIn project={id} agent={signing} onClose={() => setSigning(null)}
        onDone={(r) => { setSigning(null); if (r.agents) setMine(r.agents); void agentsNow(); }} />}
      {err(errors.agents)}
    </Group>

    <Group title="Profiles" hint="The browser profiles its tasks test as, each task with its own copy." tools={<>
      <ButtonMenu items={profileMenu}><Tool label="Add a profile" icon={<AddRegular />} /></ButtonMenu>
      <Tool label="Remove from the project (asks first)" icon={<SubtractRegular />} disabled={!profileSel} onClick={() => void removeProfile()} />
    </>}>
      {profiles.length ? <RightClickMenu items={(e) => { const p = rowAt(e, 'profile'); if (!p) return null; setProfileSel(p);
        return [{ label: 'Remove from the Project…', run: () => removeProfile(p) }]; }}>
        <List label="Profiles" attr="profile" rows={profiles} id={(p) => p.id} rowLabel={(p) => p.name} rowTitle={(p) => [p.name, p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join('\n')} selected={profileSel} onSelect={setProfileSel}
          onDelete={(k) => void removeProfile(k)} columns={[
            { label: 'Name', width: '36%', cell: (p) => <Persona size="extra-small" name={p.name} avatar={{ image: { src: avatarSrc(p.avatar) } }} /> },
            { label: 'About', cell: (p) => <Text size={200}>{p.description}</Text> },
            { label: 'Also in', width: '24%', cell: (p) => <Text size={200}>{p.also.join(', ')}</Text> },
          ]} />
      </RightClickMenu> : adding !== 'profile' && <Text size={200}>No profiles yet: the browser profiles its tasks test as, signed in once.</Text>}
      {inPlace('profile', 'New profile', 'Its name, e.g. ann@shop.com', () => void addProfile(), 'Create', errors.profiles)}
      {adding !== 'profile' && err(errors.profiles)}
    </Group>

    <Field label="Local addresses" hint="Where Kulisa may type saved test users' passwords besides localhost and your network: a tunnel, dev domains.">
      <Input value={local} spellCheck={false} placeholder="abc.ngrok.app shop.dev" onChange={(_, d) => setLocal(d.value)} onBlur={save} />
    </Field>
  </div>;
}
