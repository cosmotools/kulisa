// A project's page in Settings (docs/tasks.md, Projects): its name, its local addresses, its Folders, Agents and Profiles;
// saved as they change. Add Agent → New Account signs in to one there (SignIn.tsx), added to the project.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { avatarSrc, ProjectIcon } from '../../../appearance/renderer';
import { BotIcon, FolderIcon, PlusIcon, UsersIcon, XIcon, CircleAlertIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, SelectGroup, Avatar, AvatarImage, AvatarFallback,
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, Spinner } from '@ui';
import { ButtonMenu } from '../../../menus/renderer';
import { agentMark } from '../../../agent-presentation/renderer';
import { SignIn } from '../SignIn';
import { AddInPlace, Things, SettingsHeading, SettingsGroup, SettingsFields, SettingsField, SettingsLoading, SettingsError } from './kit';
import { useChanged } from './changed';
import { useRead } from './read';
import type { MenuItem } from '../../../menus/renderer';
import { refused, type Result } from '../../../shared/result';
import type { ProjectAgent, ProjectEntry, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../../shared/types';

const base = (f: string) => f.split(/[\\/]/).pop()!;

export function ProjectPage({ project, onSaved, saveRef, action }: { project: ProjectEntry; onSaved: () => void; saveRef: { current: () => Promise<void> }; action?: ReactNode }) {
  const { id } = project;
  // The project as the main process has it; its name and local addresses as typed (saved), never replaced by a read.
  const [{ data: s, loading, error: loadError }, readSettings, setS] = useRead<ProjectSettings>();
  const patch = (p: Partial<ProjectSettings>) => setS((x) => x && { ...x, ...p });
  const folders = s?.folders ?? [], mine = s?.projectAgents ?? [], profiles = s?.profiles ?? [], others = s?.others ?? [];
  const [name, setName] = useState(project.name), [local, setLocal] = useState<string[]>([]), [host, setHost] = useState(''), [error, setError] = useState('');
  const [{ data: github, loading: githubLoading, error: githubError }, readGitHub] = useRead<ProjectGitHub>();
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
  const saved = useRef(''), filled = useRef(false);
  const githubNow = useCallback((answer?: Promise<Result<ProjectGitHub>>) => readGitHub(() => answer ?? kulisa.invoke('project:github:get', { id })), [id, readGitHub]);
  // Refresh memberships without overwriting fields being edited. Only the first read fills editable values.
  const reload = useCallback(() => readSettings(() => kulisa.invoke('project:settings:get', { id }), (c) => {
    if (filled.current) return;
    filled.current = true;
    setName(c.name); setLocal(c.local || []);
    saved.current = JSON.stringify({ name: c.name.trim(), local: c.local || [] });
  }), [id, readSettings]);
  useEffect(() => { void reload(); void githubNow(); }, [reload, githubNow]);
  useChanged(reload);

  // Its name saved on Enter, on leaving it, and before Settings closes or another page shows; its local addresses as one
  // is added or removed (a host typed: on Enter, a space or a comma, or leaving it).
  const look = (l = local) => JSON.stringify({ name: name.trim(), local: l });
  async function save(l = local) {
    if (!s) return;
    const now = look(l);
    if (now === saved.current || !name.trim()) return;
    saved.current = now;
    const r = await kulisa.invoke('project:settings:set', { id, ...JSON.parse(now) });
    setError(r?.error || '');
    if (r?.error) saved.current = ''; else onSaved();
  }
  useEffect(() => { saveRef.current = () => save(); });
  const hosts = (l: string[]) => { setLocal(l); void save(l); };
  const addHost = () => { const typed = host.split(/[\s,]+/).filter(Boolean); setHost(''); if (typed.length) hosts([...new Set([...local, ...typed])]); };

  async function changeFolders(answer: Promise<Result<{ folders?: ProjectFolder[] }>>) {
    setErrors((e) => ({ ...e, folders: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else if (r.folders) { patch({ folders: r.folders }); void githubNow(); }
    return r;
  }
  const removeFolder = (f: string) => changeFolders(kulisa.invoke('project:folder:remove', { id, folder: f }));
  const defaultFolder = (f: string) => changeFolders(kulisa.invoke('project:folder:set-default', { id, folder: f }));
  async function clone() {
    if (!text.trim()) return;
    setCloning(true);
    if (!(await changeFolders(kulisa.invoke('project:folder:clone', { id, url: text })))?.error) { setText(''); setAdding(''); }
    setCloning(false);
  }

  async function agents(answer: Promise<Result<{ agents: ProjectAgent[] }>>) {
    setErrors((e) => ({ ...e, agents: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, agents: r.error })); else patch({ projectAgents: r.agents });
  }
  const isDefault = (a?: string) => !!a && !!mine.find((m) => m.id === a)?.default;
  const defaultAgent = (a: string | null) => agents(kulisa.invoke('project:agent:set-default', { id, agent: a }));
  const removeAgent = (a: string) => agents(kulisa.invoke('project:agent:remove', { id, agent: a }));
  const addable = (s?.agents ?? []).filter((x) => !mine.some((m) => m.id === x.id));
  const agentMenu = (): MenuItem[] => [...addable.map((x) => ({ label: x.name, run: () => agents(kulisa.invoke('project:agent:add', { id, agent: x.id })) })),
    ...(s?.clis.length ? [...(addable.length ? ['-' as const] : []), { heading: 'New Account' },
      ...s.clis.map((c) => ({ label: `${c.name}…`, agent: c.id, run: () => { setErrors((e) => ({ ...e, agents: '' })); setSigning(c); } }))] : [])];

  async function profileChange(answer: Promise<Result<{ profiles: ProjectProfile[]; others: ProjectProfile[] }>>) {
    setErrors((e) => ({ ...e, profiles: '' }));
    const r = await answer;
    if (refused(r)) setErrors((e) => ({ ...e, profiles: r.error })); else { patch({ profiles: r.profiles, others: r.others }); onSaved(); }
    return r;
  }
  const removeProfile = (p: string) => profileChange(kulisa.invoke('project:profile:remove', { id, profile: p }));
  async function addProfile() {
    if (!text.trim()) return;
    if (!(await profileChange(kulisa.invoke('project:profile:new', { id, name: text })))?.error) { setText(''); setAdding(''); }
  }
  const profileMenu = (): MenuItem[] => [{ label: 'New Profile…', run: () => { setText(''); setAdding('profile'); } },
    ...(others.length ? ['-' as const, { heading: 'Other Profiles' }, ...others.map((p) => ({ label: p.name, sub: p.also.join(', ') || 'in no project',
      avatar: p.avatar, run: () => profileChange(kulisa.invoke('project:profile:add', { id, profile: p.id })) }))] : [])];

  const githubOf = (f: string) => github?.repos.find((g) => g.folder === f);
  const accountName = (a: ProjectGitHub['accounts'][number]) => (a.kind === 'pat' ? `${a.login} (token)` : a.login);
  const stop = () => { setAdding(''); setText(''); };
  // A refusal not at a field (the field put away, or none).
  const err = (t: string) => t && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{t}</span></AlertDescription></Alert>;

  const folderMenu = (f: string): MenuItem[] => [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) },
    { label: 'Remove from the Project', run: () => removeFolder(f) }];
  const agentRowMenu = (a: string): MenuItem[] => [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
  const add = (label: string, items: () => MenuItem[], disabled?: boolean) =>
    <ButtonMenu end items={items}><Button variant="ghost" size="sm" disabled={disabled}><PlusIcon data-icon="inline-start" />{label}</Button></ButtonMenu>;
  const muted = (t: string) => <span className="text-sm text-muted-foreground">{t}</span>;
  const account = (f: Pick<ProjectFolder, 'folder' | 'remote'>) => { const g = githubOf(f.folder);
    if (!github && f.remote && githubLoading) return <span role="status" className="inline-flex w-48 min-w-0 items-center gap-2 text-sm text-muted-foreground"><Spinner role={undefined} aria-hidden />Loading GitHub account…</span>;
    if (!g?.remote) return null;
    if (g.state === 'not-github') return muted('Not a GitHub address');
    if (!github!.accounts.length) return muted('No GitHub account');
    return <Select value={g.account ?? ''} onValueChange={(v) => void githubNow(kulisa.invoke('project:github:set', { id, remote: g.remote!, account: v }))}>
      <SelectTrigger size="sm" className="w-48 min-w-0" aria-label={`GitHub account of ${g.repo}`}><SelectValue placeholder="GitHub account…" /></SelectTrigger>
      <SelectContent><SelectGroup>{github!.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{accountName(a)}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>; };

  return <div className="flex flex-col gap-5">
    <SettingsHeading title={project.name} description="Changes save automatically." media={<ProjectIcon p={project} size={32} />} action={action} />
    <SettingsError error={loadError} />
    {s && loading && <SettingsLoading>Updating project settings…</SettingsLoading>}

    <SettingsGroup><SettingsFields>
      <SettingsField id="project-name" label="Name" description="Shown in the project sidebar and task menus." error={error}>
        <Input id="project-name" disabled={!s} aria-invalid={error ? true : undefined} value={name} maxLength={64} spellCheck={false} onChange={(e) => { setName(e.target.value); setError(''); }} onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
      </SettingsField>
    </SettingsFields></SettingsGroup>

    <SettingsGroup title="Folders" count={s ? folders.length : project.folders.length} description="New tasks start in the default folder."
      action={add('Add Folder', () => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder:add', { id })) },
        { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }], !s)}>
      <Things label="Folders" menu={folderMenu} menuDisabled={!s} empty={s && <Empty><EmptyHeader><EmptyMedia variant="icon"><FolderIcon /></EmptyMedia><EmptyTitle>No folders yet</EmptyTitle><EmptyDescription>Add a local folder or clone a repository to give your agents a place to work.</EmptyDescription></EmptyHeader></Empty>} things={(s ? folders : project.folders.map((folder) => ({ folder, git: null, remote: null }))).map((f) => ({ key: f.folder, name: base(f.folder), media: <FolderIcon className="size-5" />,
        description: f.folder, data: { 'data-folder': f.folder },
        badges: <>{f.folder === folders[0]?.folder && folders.length > 1 && <Badge variant="secondary">Default</Badge>}
          {f.git !== null && f.git !== 'ok' && <Badge variant="outline"><span className="text-warning">{f.git === 'none' ? 'No git' : 'No commit yet'}</span></Badge>}</>,
        control: account(f) }))} />
      {!s && !loadError && <SettingsLoading>Checking folders…</SettingsLoading>}
      {github && githubLoading && <SettingsLoading>Checking repository access…</SettingsLoading>}
      {adding === 'clone' && <div className="p-3"><AddInPlace label="Repository URL" placeholder="git@github.com:me/shop.git" value={text} onChange={setText} go={() => void clone()} stop={stop}
        ok={cloning ? 'Cloning…' : 'Clone'} busy={cloning} error={errors.folders || undefined} /></div>}
      {github?.repos.filter((g) => g.why).map((g) => <Alert key={g.folder}>
        <AlertDescription><span data-selectable>{base(g.folder)}: {g.why}{g.install && ' Install it, or ask its owner to.'}</span></AlertDescription>
        {g.install && <AlertAction><Button variant="outline" size="sm" asChild><a href={g.install} target="_blank" rel="noreferrer">Install it on {g.owner}</a></Button></AlertAction>}
      </Alert>)}
      <SettingsError error={githubError} />
      {adding !== 'clone' && err(errors.folders)}
    </SettingsGroup>

    <SettingsGroup title="Agents" count={s ? mine.length : undefined} description="Accounts available to work on your tasks."
      action={add('Add Agent', agentMenu, !s || !!signing || (!addable.length && !s.clis.length))}>
      {!s && !loadError && <SettingsLoading>Loading project agents…</SettingsLoading>}
      {s && <Things label="Agents" menu={agentRowMenu} empty={signing ? undefined : <Empty><EmptyHeader><EmptyMedia variant="icon"><BotIcon /></EmptyMedia><EmptyTitle>No agents added</EmptyTitle><EmptyDescription>Tasks start with a terminal. Add an agent to work with a coding assistant.</EmptyDescription></EmptyHeader></Empty>}
        things={mine.map((a) => { const Mark = agentMark(a.cli); return { key: a.id, name: a.agent, media: <Mark className="size-6" />,
          data: { 'data-agent': a.id }, badges: a.default && <Badge variant="secondary">Default</Badge>, description: a.email ?? undefined }; })} />}
      {signing && <SignIn project={id} agent={signing} onClose={() => setSigning(null)}
        onDone={(r) => { setSigning(null); if (r.agents) patch({ projectAgents: r.agents }); void reload(); }} />}
      {err(errors.agents)}
    </SettingsGroup>

    <SettingsGroup title="Profiles" count={s ? profiles.length : undefined} description="Browser identities for testing. Sign in once for every task."
      action={add('Add Profile', profileMenu, !s)}>
      {!s && !loadError && <SettingsLoading>Loading project profiles…</SettingsLoading>}
      {s && <Things label="Profiles" menu={(p) => [{ label: 'Remove from the Project…', run: () => removeProfile(p) }]}
        empty={adding === 'profile' ? undefined : <Empty><EmptyHeader><EmptyMedia variant="icon"><UsersIcon /></EmptyMedia><EmptyTitle>No profiles added</EmptyTitle><EmptyDescription>Add a profile to test your app as a signed-in user.</EmptyDescription></EmptyHeader></Empty>}
        things={profiles.map((p) => ({ key: p.id, name: p.name, media: <Avatar size="sm"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback>{p.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>, data: { 'data-profile': p.id },
          description: [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') || undefined }))} />}
      {adding === 'profile' && <div className="p-3"><AddInPlace label="New profile" placeholder="Its name, e.g. ann@shop.com" value={text} onChange={setText} go={() => void addProfile()}
        stop={stop} ok="Create" name error={errors.profiles || undefined} /></div>}
      {adding !== 'profile' && err(errors.profiles)}
    </SettingsGroup>

    <SettingsGroup label="Local addresses">{!s && !loadError && <SettingsLoading>Loading local addresses…</SettingsLoading>}{s && <SettingsFields>
      <SettingsField id="project-local-addresses" label="Local addresses"
        description="Additional addresses where agents may type saved test users' passwords, besides localhost and your network.">
        <div className="flex min-w-0 flex-col gap-2">
          {local.length > 0 && <div role="list" aria-label="Local addresses kept" className="flex flex-wrap gap-1.5">
            {local.map((h) => <Badge key={h} role="listitem" variant="secondary">{h}
              <Button variant="ghost" size="icon-xs" className="-me-1 size-4" data-icon="inline-end" aria-label={`Remove ${h}`}
                onClick={() => hosts(local.filter((x) => x !== h))}><XIcon /></Button>
            </Badge>)}
          </div>}
          <Input id="project-local-addresses" value={host} spellCheck={false} placeholder="abc.ngrok.app" onChange={(e) => setHost(e.target.value)} onBlur={addHost}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === ',') { e.preventDefault(); addHost(); } }} />
          <p className="text-xs text-muted-foreground">Press Enter to add an address.</p>
        </div>
      </SettingsField>
    </SettingsFields>}</SettingsGroup>
  </div>;
}
