// A project's page in Settings (docs/tasks.md, Projects): its name, its local addresses, its Folders, Agents and Profiles;
// saved as they change. Add Agent → New Account signs in to one there (SignIn.tsx), added to the project.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Button, Caption1, Dropdown, Field, Input, Link, makeStyles, MessageBar, MessageBarActions, MessageBarBody, Option, Spinner, Tag, TagPicker, TagPickerControl, TagPickerGroup, TagPickerInput,
  tokens } from '@fluentui/react-components';
import { AddRegular, FolderRegular, GlobeRegular, RenameRegular } from '@fluentui/react-icons';
import { ButtonMenu, type Item } from '../Menus';
import { Row, Section } from './Row';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { useChanged } from './changed';
import { avatarSrc } from '../../lib/common';
import { refused, type Result } from '../../../shared/result';
import type { ProjectAgent, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../../shared/types';
import { useCommonStyles } from '../theme';
import { ErrorBar } from '../ErrorBar';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  field: { width: '300px' },
  inPlace: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  buttons: { display: 'flex', gap: tokens.spacingHorizontalS, justifyContent: 'end' },
  account: { minWidth: 0 },
});

const base = (f: string) => f.split(/[\\/]/).pop()!;

export function ProjectPage({ id, onSaved, saveRef }: { id: string; onSaved: () => void; saveRef: { current: () => Promise<void> } }) {
  const styles = useStyles(), common = useCommonStyles();
  const [s, setS] = useState<ProjectSettings | null>(null);
  const [name, setName] = useState(''), [local, setLocal] = useState<string[]>([]), [host, setHost] = useState(''), [error, setError] = useState('');
  const [folders, setFolders] = useState<ProjectFolder[]>([]), [github, setGithub] = useState<ProjectGitHub | null>(null);
  const [mine, setMine] = useState<ProjectAgent[]>([]), [profiles, setProfiles] = useState<ProjectProfile[]>([]), [others, setOthers] = useState<ProjectProfile[]>([]);
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
  const saved = useRef('');

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
      if (refused(c)) return;
      setS(c); setName(c.name); setLocal(c.local || []); setFolders(c.folders); setMine(c.projectAgents);
      setProfiles(c.profiles); setOthers(c.others);
      saved.current = JSON.stringify({ name: c.name.trim(), local: c.local || [] });
      void githubNow();
    });
  }, [id, githubNow]);
  useChanged(useCallback(async () => {
    const c = await kulisa.invoke('project:settings-get', { id });
    if (!refused(c)) { setProfiles(c.profiles); setOthers(c.others); }
  }, [id]));

  // Its name saved on Enter, on leaving it, and before Settings closes or another page shows; its local addresses as one
  // is added or removed (a host typed: on Enter, a space or a comma, or leaving it).
  const look = (l = local) => JSON.stringify({ name: name.trim(), local: l });
  async function save(l = local) {
    const now = look(l);
    if (now === saved.current || !name.trim()) return;
    saved.current = now;
    const r = await kulisa.invoke('project:settings', { id, ...JSON.parse(now) });
    setError(r?.error || '');
    if (r?.error) saved.current = ''; else onSaved();
  }
  useEffect(() => { saveRef.current = () => save(); });
  const hosts = (l: string[]) => { setLocal(l); void save(l); };
  const addHost = () => { const typed = host.split(/[\s,]+/).filter(Boolean); setHost(''); if (typed.length) hosts([...new Set([...local, ...typed])]); };

  async function changeFolders(answer: Promise<Result<{ folders?: ProjectFolder[] }>>) {
    setErrors((e) => ({ ...e, folders: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else if (r.folders) { setFolders(r.folders); void githubNow(); }
    return r;
  }
  const removeFolder = (f: string) => changeFolders(kulisa.invoke('project:folder-remove', { id, folder: f }));
  const defaultFolder = (f: string) => changeFolders(kulisa.invoke('project:folder-default', { id, folder: f }));
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
  const removeAgent = (a: string) => agents(kulisa.invoke('project:agent-remove', { id, agent: a }));
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
  const removeProfile = (p: string) => profileChange(kulisa.invoke('project:profile-remove', { id, profile: p }));
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

  const folderMenu = (f: string): Item[] => [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) },
    { label: 'Remove from the Project', run: () => removeFolder(f) }];
  const agentRowMenu = (a: string): Item[] => [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
  const add = (label: string, items: () => Item[], disabled?: boolean) =>
    <ButtonMenu end items={items}><Button icon={<AddRegular />} disabled={disabled}>{label}</Button></ButtonMenu>;
  const account = (f: string) => { const g = githubOf(f);
    if (!g?.remote) return null;
    if (g.state === 'not-github') return <Caption1>Not a GitHub address</Caption1>;
    if (!github!.accounts.length) return <Caption1>No GitHub account</Caption1>;
    const now = github!.accounts.find((a) => a.id === g.account);
    return <Dropdown size="small" className={styles.account} aria-label={`GitHub account of ${g.repo}`} placeholder="GitHub account…"
      value={now ? accountName(now) : ''} selectedOptions={g.account ? [g.account] : []}
      // its keys are its own, but Esc, which closes Settings
      onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
      onOptionSelect={(_, d) => d.optionValue && void githubNow(kulisa.invoke('project:github-set', { id, remote: g.remote!, account: d.optionValue }))}>
      {github!.accounts.map((a) => <Option key={a.id} value={a.id}>{accountName(a)}</Option>)}
    </Dropdown>; };

  return <div className={styles.page}>
    <Row image={<RenameRegular />} title="Name" action={<Field validationMessage={error || undefined} className={styles.field}>
      <Input value={name} aria-label="Name" data-name maxLength={64} spellCheck={false} onChange={(_, d) => { setName(d.value); setError(''); }} onBlur={() => void save()}
        onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
    </Field>} />
    <Row image={<GlobeRegular />} title="Local addresses" description="Where saved test users' passwords may be typed besides localhost and your network"
      action={<TagPicker noPopover selectedOptions={local} onOptionSelect={(_, d) => hosts(d.selectedOptions)}>
        <TagPickerControl className={styles.field}>
          <TagPickerGroup aria-label="Local addresses kept">{local.map((h) => <Tag key={h} value={h} shape="rounded">{h}</Tag>)}</TagPickerGroup>
          <TagPickerInput aria-label="Local addresses" value={host} spellCheck={false} placeholder={local.length ? undefined : 'abc.ngrok.app'}
            onChange={(e) => setHost(e.target.value)} onBlur={addHost}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === ',') { e.preventDefault(); addHost(); } }} />
        </TagPickerControl>
      </TagPicker>} />

    <Section title="Folders" action={add('Add Folder', () => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder-add', { id })) },
      { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }])}>
      {folders.map((f) => <Row key={f.folder} image={<FolderRegular />} title={base(f.folder)} data={{ 'data-folder': f.folder }} menu={() => folderMenu(f.folder)}
        badges={<>{f.folder === folders[0]?.folder && folders.length > 1 && <Badge appearance="tint">Default</Badge>}
          {f.git !== 'ok' && <Badge appearance="outline" color="warning">{f.git === 'none' ? 'No git' : 'No commit yet'}</Badge>}</>}
        description={f.folder} action={account(f.folder)} />)}
      {inPlace('clone', 'Repository URL', 'git@github.com:me/shop.git', () => void clone(), cloning ? 'Cloning…' : 'Clone', errors.folders)}
      {github?.repos.filter((g) => g.why).map((g) => <MessageBar key={g.folder} intent="warning">
        <MessageBarBody>{base(g.folder)}: {g.why}{g.install && ' Install it, or ask its owner to.'}</MessageBarBody>
        {g.install && <MessageBarActions><Link href={g.install} target="_blank">Install it on {g.owner}</Link></MessageBarActions>}
      </MessageBar>)}
      {adding !== 'clone' && err(errors.folders)}
    </Section>

    <Section title="Agents" action={add('Add Agent', agentMenu, !!signing || (!addable.length && !s.clis.length))}>
      {mine.map((a) => { const Mark = agentMark(a.cli); return <Row key={a.id} image={<Mark />} title={a.agent} data={{ 'data-agent': a.id }} menu={() => agentRowMenu(a.id)}
        badges={a.default && <Badge appearance="tint">Default</Badge>} description={a.email ?? undefined} />; })}
      {!mine.length && !signing && <Caption1>No agents: its tasks get the terminal only.</Caption1>}
      {signing && <SignIn project={id} agent={signing} onClose={() => setSigning(null)}
        onDone={(r) => { setSigning(null); if (r.agents) setMine(r.agents); void agentsNow(); }} />}
      {err(errors.agents)}
    </Section>

    <Section title="Profiles" action={add('Add Profile', profileMenu)}>
      {profiles.map((p) => <Row key={p.id} image={<Avatar size={32} name={p.name} image={{ src: avatarSrc(p.avatar) }} />} title={p.name} data={{ 'data-profile': p.id }}
        description={[p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') || undefined}
        menu={() => [{ label: 'Remove from the Project…', run: () => removeProfile(p.id) }]} />)}
      {!profiles.length && adding !== 'profile' && <Caption1>No profiles: the browser profiles its tasks test as, signed in once.</Caption1>}
      {inPlace('profile', 'New profile', 'Its name, e.g. ann@shop.com', () => void addProfile(), 'Create', errors.profiles)}
      {adding !== 'profile' && err(errors.profiles)}
    </Section>
  </div>;
}
