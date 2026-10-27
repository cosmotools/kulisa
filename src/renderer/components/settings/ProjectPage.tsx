// A project's page in Settings (docs/tasks.md, Projects): its name, its local addresses, its Folders, Agents and Profiles;
// saved as they change. Add Agent → New Account signs in to one there (SignIn.tsx), added to the project.
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Button, Caption1, Card, CardFooter, CardHeader, Dropdown, Field, Input, Link, MessageBar, MessageBarActions, MessageBarBody, Option, Spinner,
  Subtitle2, Table, TableBody, TableCell, TableCellActions, TableCellLayout, TableRow, createTableColumn, useTableColumnSizing_unstable, useTableFeatures, Tag, TagPicker, TagPickerControl, TagPickerGroup, TagPickerInput,
  Text } from '@fluentui/react-components';
import { AddRegular, FolderRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { useChanged } from './changed';
import { avatarSrc } from '../../lib/common';
import { refused, type Result } from '../../../shared/result';
import type { ProjectAgent, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../../shared/types';
import { ErrorBar } from '../ErrorBar';

const base = (f: string) => f.split(/[\\/]/).pop()!;

type Row = { key: string; name: string; media: ReactElement; badges?: ReactNode; description?: string; data: Record<string, string>; control?: ReactNode };

// A section's things as a Table: a thing's actions behind its ⋯ and its right-click. data-row, aria-label, data-key: the
// tests' handles (docs/testing.md). The right-click is the table's: a menu's trigger wraps its child in a box, which a row
// cannot have.
// A row's control (a folder's GitHub account) in a column of its own; Fluent's column sizing gives the thing's column
// the rest (a fixed Table shares its width equally).
const columns = [createTableColumn<Row>({ columnId: 'thing' }), createTableColumn<Row>({ columnId: 'control' })];
const sizes = { thing: { idealWidth: 480, minWidth: 200 }, control: { idealWidth: 260, minWidth: 200 } };

function Rows({ label, things, menu, empty }: { label: string; things: Row[]; menu: (key: string) => Item[]; empty?: string }) {
  const control = things.some((x) => x.control !== undefined);
  const { columnSizing_unstable: sizing, tableRef } = useTableFeatures({ columns, items: things }, [useTableColumnSizing_unstable({ columnSizingOptions: sizes })]);
  if (!things.length) return empty ? <Text>{empty}</Text> : null;
  const cell = (id: string) => (control ? sizing.getTableCellProps(id) : {});
  return <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k ? menu(k) : null; }}>
    <Table aria-label={label} ref={control ? tableRef : undefined} {...(control ? sizing.getTableProps() : {})}>
      {/* title: what the truncated cell cuts, whole */}
      <TableBody>{things.map((t) => <TableRow key={t.key} data-row="" data-key={t.key} aria-label={t.name} title={[t.name, t.description].filter(Boolean).join('\n')} {...t.data}>
        <TableCell {...cell('thing')}>
          <TableCellLayout media={t.media} description={t.description} truncate>{t.name} {t.badges}</TableCellLayout>
          <TableCellActions>
            <ButtonMenu end items={() => menu(t.key)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label={`More for ${t.name}`} /></ButtonMenu>
          </TableCellActions>
        </TableCell>
        {control && <TableCell {...cell('control')}>{t.control}</TableCell>}
      </TableRow>)}</TableBody>
    </Table>
  </RightClickMenu>;
}

// first: what Settings fetched before it showed (Settings.tsx), its page filled from the start; fetched again here.
export function ProjectPage({ id, first, onSaved, saveRef }: { id: string; first?: ProjectSettings; onSaved: () => void; saveRef: { current: () => Promise<void> } }) {
  const [s, setS] = useState<ProjectSettings | null>(first ?? null);
  const [name, setName] = useState(first?.name ?? ''), [local, setLocal] = useState<string[]>(first?.local || []), [host, setHost] = useState(''), [error, setError] = useState('');
  const [folders, setFolders] = useState<ProjectFolder[]>(first?.folders ?? []), [github, setGithub] = useState<ProjectGitHub | null>(null);
  const [mine, setMine] = useState<ProjectAgent[]>(first?.projectAgents ?? []), [profiles, setProfiles] = useState<ProjectProfile[]>(first?.profiles ?? []), [others, setOthers] = useState<ProjectProfile[]>(first?.others ?? []);
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
  const saved = useRef(first ? JSON.stringify({ name: first.name.trim(), local: first.local || [] }) : '');

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
    <>
      <Field label={label} validationMessage={error || undefined}>
        <Input autoFocus data-name={what === 'profile' || undefined} value={text} placeholder={placeholder} spellCheck={false} onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !cloning) go(); if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      </Field>
      <CardFooter action={<Button appearance="primary" onClick={go} disabled={cloning} icon={cloning ? <Spinner size="tiny" /> : undefined}>{ok}</Button>}>
        <Button onClick={stop}>Cancel</Button>
      </CardFooter>
    </>;
  // A refusal not at a field (the field put away, or none).
  const err = (t: string) => t && <ErrorBar>{t}</ErrorBar>;
  if (!s) return null;

  const folderMenu = (f: string): Item[] => [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) },
    { label: 'Remove from the Project', run: () => removeFolder(f) }];
  const agentRowMenu = (a: string): Item[] => [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
  const add = (label: string, items: () => Item[], disabled?: boolean) =>
    <ButtonMenu end items={items}><Button icon={<AddRegular />} disabled={disabled}>{label}</Button></ButtonMenu>;
  const header = (title: string, action: ReactElement) => <CardHeader header={<Subtitle2>{title}</Subtitle2>} action={action} />;
  const account = (f: string) => { const g = githubOf(f);
    if (!g?.remote) return null;
    if (g.state === 'not-github') return <Caption1>Not a GitHub address</Caption1>;
    if (!github!.accounts.length) return <Caption1>No GitHub account</Caption1>;
    const now = github!.accounts.find((a) => a.id === g.account);
    return <Dropdown size="small" aria-label={`GitHub account of ${g.repo}`} placeholder="GitHub account…"
      value={now ? accountName(now) : ''} selectedOptions={g.account ? [g.account] : []}
      // its keys are its own, but Esc, which closes Settings
      onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
      onOptionSelect={(_, d) => d.optionValue && void githubNow(kulisa.invoke('project:github-set', { id, remote: g.remote!, account: d.optionValue }))}>
      {github!.accounts.map((a) => <Option key={a.id} value={a.id}>{accountName(a)}</Option>)}
    </Dropdown>; };

  return <Card appearance="subtle">
    <Card>
      <Field label="Name" validationMessage={error || undefined}>
        <Input value={name} data-name maxLength={64} spellCheck={false} onChange={(_, d) => { setName(d.value); setError(''); }} onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
      </Field>
      <Field label="Local addresses" hint="Where saved test users' passwords may be typed besides localhost and your network">
        <TagPicker noPopover selectedOptions={local} onOptionSelect={(_, d) => hosts(d.selectedOptions)}>
          <TagPickerControl>
            <TagPickerGroup aria-label="Local addresses kept">{local.map((h) => <Tag key={h} value={h} shape="rounded">{h}</Tag>)}</TagPickerGroup>
            <TagPickerInput aria-label="Local addresses" value={host} spellCheck={false} placeholder={local.length ? undefined : 'abc.ngrok.app'}
              onChange={(e) => setHost(e.target.value)} onBlur={addHost}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === ',') { e.preventDefault(); addHost(); } }} />
          </TagPickerControl>
        </TagPicker>
      </Field>
    </Card>

    <Card role="group" aria-label="Folders">
      {header('Folders', add('Add Folder', () => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder-add', { id })) },
        { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }]))}
      <Rows label="Folders" things={folders.map((f) => ({ key: f.folder, name: base(f.folder), media: <FolderRegular />, description: f.folder, data: { 'data-folder': f.folder },
        badges: <>{f.folder === folders[0]?.folder && folders.length > 1 && <Badge appearance="tint">Default</Badge>}
          {f.git !== 'ok' && <Badge appearance="outline" color="warning">{f.git === 'none' ? 'No git' : 'No commit yet'}</Badge>}</>,
        control: account(f.folder) }))} menu={folderMenu} />
      {inPlace('clone', 'Repository URL', 'git@github.com:me/shop.git', () => void clone(), cloning ? 'Cloning…' : 'Clone', errors.folders)}
      {github?.repos.filter((g) => g.why).map((g) => <MessageBar key={g.folder} intent="warning">
        <MessageBarBody>{base(g.folder)}: {g.why}{g.install && ' Install it, or ask its owner to.'}</MessageBarBody>
        {g.install && <MessageBarActions><Link href={g.install} target="_blank">Install it on {g.owner}</Link></MessageBarActions>}
      </MessageBar>)}
      {adding !== 'clone' && err(errors.folders)}
    </Card>

    <Card role="group" aria-label="Agents">
      {header('Agents', add('Add Agent', agentMenu, !!signing || (!addable.length && !s.clis.length)))}
      <Rows label="Agents" things={mine.map((a) => { const Mark = agentMark(a.cli); return { key: a.id, name: a.agent, media: <Mark width={24} height={24} fontSize={24} />,
        data: { 'data-agent': a.id }, badges: a.default && <Badge appearance="tint">Default</Badge>, description: a.email ?? undefined }; })}
        menu={agentRowMenu} empty={signing ? undefined : 'No agents: its tasks get the terminal only.'} />
      {signing && <SignIn project={id} agent={signing} onClose={() => setSigning(null)}
        onDone={(r) => { setSigning(null); if (r.agents) setMine(r.agents); void agentsNow(); }} />}
      {err(errors.agents)}
    </Card>

    <Card role="group" aria-label="Profiles">
      {header('Profiles', add('Add Profile', profileMenu))}
      <Rows label="Profiles" things={profiles.map((p) => ({ key: p.id, name: p.name, media: <Avatar size={32} name={p.name} image={{ src: avatarSrc(p.avatar) }} />,
        data: { 'data-profile': p.id },
        description: [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') || undefined }))}
        menu={(p) => [{ label: 'Remove from the Project…', run: () => removeProfile(p) }]}
        empty={adding === 'profile' ? undefined : 'No profiles: the browser profiles its tasks test as, signed in once.'} />
      {inPlace('profile', 'New profile', 'Its name, e.g. ann@shop.com', () => void addProfile(), 'Create', errors.profiles)}
      {adding !== 'profile' && err(errors.profiles)}
    </Card>
  </Card>;
}
