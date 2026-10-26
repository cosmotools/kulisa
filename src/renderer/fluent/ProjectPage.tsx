// A project's page in Settings (docs/tasks.md, Projects): its name, its Folders, Agents and Profiles (a card each, a
// list with its toolbar), its local addresses; saved as they change. The probe: a new account's sign-in is not here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Button, Dropdown, Field, Input, Link, Option, Text } from '@fluentui/react-components';
import { MinusIcon, PlusIcon, StarIcon } from 'lucide-react';
import { ButtonMenu, RightClickMenu, type Item } from './Menus';
import { List } from './List';
import { Group, Tool } from './Group';
import { avatarSrc } from './avatar';
import { refused, type Result } from '../../shared/result';
import type { ProjectAgent, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../shared/types';

const base = (f: string) => f.split(/[\\/]/).pop()!;
const rowAt = (e: MouseEvent, attr: string) => (e.target as Element).closest<HTMLElement>(`[data-${attr}]`)?.getAttribute(`data-${attr}`) ?? null;

export function ProjectPage({ id, onSaved, saveRef }: { id: string; onSaved: () => void; saveRef: { current: () => Promise<void> } }) {
  const [s, setS] = useState<ProjectSettings | null>(null);
  const [name, setName] = useState(''), [local, setLocal] = useState(''), [error, setError] = useState('');
  const [folders, setFolders] = useState<ProjectFolder[]>([]), [github, setGithub] = useState<ProjectGitHub | null>(null);
  const [mine, setMine] = useState<ProjectAgent[]>([]), [profiles, setProfiles] = useState<ProjectProfile[]>([]), [others, setOthers] = useState<ProjectProfile[]>([]);
  const [folderSel, setFolderSel] = useState<string>(), [agentSel, setAgentSel] = useState<string>(), [profileSel, setProfileSel] = useState<string>();
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const saved = useRef('');

  const githubNow = useCallback(async (answer?: Promise<Result<ProjectGitHub>>) => {
    const r = await (answer ?? kulisa.invoke('project:github-get', { id }));
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else setGithub(r);
  }, [id]);
  useEffect(() => {
    void kulisa.invoke('project:settings-get', { id }).then((c) => {
      if (refused(c)) return;
      setS(c); setName(c.name); setLocal((c.local || []).join(' ')); setFolders(c.folders); setMine(c.projectAgents);
      setProfiles(c.profiles); setOthers(c.others);
      saved.current = JSON.stringify({ name: c.name.trim(), local: c.local || [] });
      void githubNow();
    });
  }, [id, githubNow]);

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
  saveRef.current = save;

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
      ...s.clis.map((c) => ({ label: `${c.name}…`, sub: 'not in the probe', enabled: false, run: () => undefined }))] : [])];

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
  // What is added in place under a list: a field with its buttons, Enter does it, Esc puts it away.
  const inPlace = (what: 'clone' | 'profile', placeholder: string, go: () => void, ok: string) => adding === what &&
    <div style={{ display: 'flex', gap: 8 }}>
      <Input autoFocus style={{ flex: 1 }} value={text} placeholder={placeholder} spellCheck={false} onChange={(_, d) => setText(d.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      <Button onClick={stop}>Cancel</Button><Button appearance="primary" disabled={cloning} onClick={go}>{ok}</Button>
    </div>;
  const err = (t: string) => t && <Text size={200} style={{ color: 'var(--colorPaletteRedForeground1)' }}>{t}</Text>;
  if (!s) return null;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Field label="Name" validationMessage={error || undefined}>
      <Input value={name} maxLength={64} spellCheck={false} onChange={(_, d) => { setName(d.value); setError(''); }} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
    </Field>

    <Group title="Folders" hint="The repositories or folders its tasks work on; new tasks get a copy of the default one." tools={<>
      <ButtonMenu items={() => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder-add', { id })) },
        { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }]}><Tool label="Add a folder or a repository" icon={<PlusIcon />} /></ButtonMenu>
      <Tool label="Remove from the project (its folder stays)" icon={<MinusIcon />} disabled={!folderSel} onClick={() => void removeFolder()} />
      <Tool label="Make Default: new tasks' agents start in its copy" icon={<StarIcon />} disabled={!folderSel || folderSel === folders[0]?.folder} onClick={() => void defaultFolder()} />
    </>}>
      <RightClickMenu items={(e) => { const f = rowAt(e, 'folder'); if (!f) return null; setFolderSel(f);
        return [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) }, { label: 'Remove from the Project', run: () => removeFolder(f) }]; }}>
        <List label="Folders" attr="folder" rows={folders} id={(r) => r.folder} rowLabel={(r) => base(r.folder)} selected={folderSel} onSelect={setFolderSel}
          onDelete={() => void removeFolder()} columns={[
            { label: 'Name', width: '22%', cell: (r) => base(r.folder) },
            { label: 'Folder', cell: (r) => <Text size={200} title={r.folder}>{r.folder}</Text> },
            { label: 'GitHub', width: '24%', cell: (r) => { const g = githubOf(r.folder);
              if (!g?.remote) return null;
              if (g.state === 'not-github') return <Text size={200}>not a GitHub address</Text>;
              if (!github!.accounts.length) return <Text size={200}>no account</Text>;
              return <Dropdown size="small" style={{ minWidth: 0 }} aria-label={`GitHub account of ${g.repo}`} placeholder="Choose…"
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
      {inPlace('clone', 'git@github.com:me/shop.git', () => void clone(), cloning ? 'Cloning…' : 'Clone')}
      {github?.repos.filter((g) => g.why).map((g) => <Text key={g.folder} size={200}>{base(g.folder)}: {g.why}
        {g.install && <> <Link href={g.install} target="_blank">Install it on {g.owner}</Link> (or ask its owner to)</>}</Text>)}
      {err(errors.folders)}
    </Group>

    <Group title="Agents" hint="The agents its tasks run; + makes a task with the default one." tools={<>
      <ButtonMenu items={agentMenu}><Tool label="Add an agent" icon={<PlusIcon />} disabled={!addable.length && !s.clis.length} /></ButtonMenu>
      <Tool label="Remove from the project (its tasks keep it)" icon={<MinusIcon />} disabled={!agentSel} onClick={() => void removeAgent()} />
      <Tool label={isDefault(agentSel) ? 'No Default: a new task starts with no agent' : 'Make Default: + makes a task with it'} icon={<StarIcon />}
        disabled={!agentSel} onClick={() => agentSel && void defaultAgent(isDefault(agentSel) ? null : agentSel)} />
    </>}>
      {mine.length ? <RightClickMenu items={(e) => { const a = rowAt(e, 'agent'); if (!a) return null; setAgentSel(a);
        return [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
          { label: 'Remove from the Project', run: () => removeAgent(a) }]; }}>
        <List label="Agents" attr="agent" rows={mine} id={(a) => a.id} rowLabel={(a) => a.agent} selected={agentSel} onSelect={setAgentSel}
          onDelete={() => void removeAgent()} columns={[
            { label: 'Agent', width: '40%', cell: (a) => a.agent },
            { label: 'Account', cell: (a) => <Text size={200}>{a.email ?? '—'}</Text> },
            { label: '', width: '80px', cell: (a) => a.default && <Badge appearance="outline">default</Badge> },
          ]} />
      </RightClickMenu> : <Text size={200}>No agents yet: its tasks get the terminal only.</Text>}
      {err(errors.agents)}
    </Group>

    <Group title="Profiles" hint="The browser profiles its tasks test as, each task with its own copy." tools={<>
      <ButtonMenu items={profileMenu}><Tool label="Add a profile" icon={<PlusIcon />} /></ButtonMenu>
      <Tool label="Remove from the project (asks first)" icon={<MinusIcon />} disabled={!profileSel} onClick={() => void removeProfile()} />
    </>}>
      {profiles.length ? <RightClickMenu items={(e) => { const p = rowAt(e, 'profile'); if (!p) return null; setProfileSel(p);
        return [{ label: 'Remove from the Project…', run: () => removeProfile(p) }]; }}>
        <List label="Profiles" attr="profile" rows={profiles} id={(p) => p.id} rowLabel={(p) => p.name} selected={profileSel} onSelect={setProfileSel}
          onDelete={() => void removeProfile()} columns={[
            { label: 'Name', width: '36%', cell: (p) => <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size={20} image={{ src: avatarSrc(p.avatar) }} />{p.name}</span> },
            { label: 'About', cell: (p) => <Text size={200}>{p.description}</Text> },
            { label: 'Also in', width: '24%', cell: (p) => <Text size={200}>{p.also.join(', ')}</Text> },
          ]} />
      </RightClickMenu> : adding !== 'profile' && <Text size={200}>No profiles yet: the browser profiles its tasks test as, signed in once.</Text>}
      {inPlace('profile', 'Its name, e.g. ann@shop.com', () => void addProfile(), 'Create')}
      {err(errors.profiles)}
    </Group>

    <Field label="Local addresses" hint="Where Kulisa may type saved test users' passwords besides localhost and your network: a tunnel, dev domains.">
      <Input value={local} spellCheck={false} placeholder="abc.ngrok.app shop.dev" onChange={(_, d) => setLocal(d.value)} onBlur={save} />
    </Field>
  </div>;
}
