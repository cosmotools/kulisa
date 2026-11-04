// A project's page in Settings (docs/tasks.md, Projects): its name, its local addresses, its Folders, Agents and Profiles;
// saved as they change. Add Agent → New Account signs in to one there (SignIn.tsx), added to the project.
import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarSrc } from '../../lib/common';
import { BotIcon, FolderIcon, PlusIcon, UsersIcon, XIcon, CircleAlertIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, SelectGroup, Avatar, AvatarImage, AvatarFallback, Field, FieldContent, FieldDescription, FieldError, FieldLabel,
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@ui';
import { ButtonMenu } from '../Menus';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { ProjectIcon } from '../ProjectIcon';
import { AddInPlace, Things, SettingsHeading, SettingsGroup, SettingsFields } from './kit';
import { useChanged } from './changed';
import type { MenuItem } from '../../lib/menu';
import { refused, type Result } from '../../../shared/result';
import type { ProjectAgent, ProjectEntry, ProjectFolder, ProjectGitHub, ProjectProfile, ProjectSettings } from '../../../shared/types';

const base = (f: string) => f.split(/[\\/]/).pop()!;

// first: what Settings fetched just before it showed (Settings.tsx), its page filled from the start.
export function ProjectPage({ project, first, onSaved, saveRef }: { project: ProjectEntry; first?: ProjectSettings; onSaved: () => void; saveRef: { current: () => Promise<void> } }) {
  const { id } = project;
  // The project as the main process has it; its name and local addresses as typed (saved), never replaced by a read.
  const [s, setS] = useState<ProjectSettings | null>(first ?? null);
  const patch = (p: Partial<ProjectSettings>) => setS((x) => x && { ...x, ...p });
  const folders = s?.folders ?? [], mine = s?.projectAgents ?? [], profiles = s?.profiles ?? [], others = s?.others ?? [];
  const [name, setName] = useState(first?.name ?? ''), [local, setLocal] = useState<string[]>(first?.local || []), [host, setHost] = useState(''), [error, setError] = useState('');
  const [github, setGithub] = useState<ProjectGitHub | null>(null);
  const [adding, setAdding] = useState<'' | 'clone' | 'profile'>(''), [text, setText] = useState(''), [cloning, setCloning] = useState(false);
  const [errors, setErrors] = useState({ folders: '', agents: '', profiles: '' });
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
  const saved = useRef(first ? JSON.stringify({ name: first.name.trim(), local: first.local || [] }) : '');
  const filled = useRef(!!first);

  const githubNow = useCallback(async (answer?: Promise<Result<ProjectGitHub>>) => {
    const r = await (answer ?? kulisa.invoke('project:github:get', { id }));
    if (refused(r)) setErrors((e) => ({ ...e, folders: r.error })); else setGithub(r);
  }, [id]);
  // Read again: an account made, or one deleted in Settings → Agents, meanwhile; the profiles changed elsewhere. The
  // first read (none given) fills the name and local addresses too.
  const reload = useCallback(async () => {
    const c = await kulisa.invoke('project:settings:get', { id });
    if (refused(c)) return;
    setS(c);
    if (filled.current) return;
    filled.current = true;
    setName(c.name); setLocal(c.local || []);
    saved.current = JSON.stringify({ name: c.name.trim(), local: c.local || [] });
  }, [id]);
  useEffect(() => { void (filled.current ? githubNow() : reload().then(() => githubNow())); }, [reload, githubNow]);
  useChanged(reload);

  // Its name saved on Enter, on leaving it, and before Settings closes or another page shows; its local addresses as one
  // is added or removed (a host typed: on Enter, a space or a comma, or leaving it).
  const look = (l = local) => JSON.stringify({ name: name.trim(), local: l });
  async function save(l = local) {
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
  if (!s) return null;

  const folderMenu = (f: string): MenuItem[] => [{ label: 'Make Default', enabled: folders[0]?.folder !== f, run: () => defaultFolder(f) },
    { label: 'Remove from the Project', run: () => removeFolder(f) }];
  const agentRowMenu = (a: string): MenuItem[] => [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
  const add = (label: string, items: () => MenuItem[], disabled?: boolean) =>
    <ButtonMenu end items={items}><Button variant="ghost" size="sm" disabled={disabled}><PlusIcon data-icon="inline-start" />{label}</Button></ButtonMenu>;
  const muted = (t: string) => <span className="text-sm text-muted-foreground">{t}</span>;
  const account = (f: ProjectFolder) => { const g = githubOf(f.folder);
    // GitHub not answered yet (a request per account): the room its Select takes, so the sections below it stay in place.
    if (!github && f.remote) return <Select disabled><SelectTrigger size="sm" className="w-48 min-w-0" aria-label="GitHub account"><SelectValue placeholder="GitHub account…" /></SelectTrigger></Select>;
    if (!g?.remote) return null;
    if (g.state === 'not-github') return muted('Not a GitHub address');
    if (!github!.accounts.length) return muted('No GitHub account');
    return <Select value={g.account ?? ''} onValueChange={(v) => void githubNow(kulisa.invoke('project:github:set', { id, remote: g.remote!, account: v }))}>
      <SelectTrigger size="sm" className="w-48 min-w-0" aria-label={`GitHub account of ${g.repo}`}><SelectValue placeholder="GitHub account…" /></SelectTrigger>
      <SelectContent><SelectGroup>{github!.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{accountName(a)}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>; };

  return <div className="flex flex-col gap-5">
    <SettingsHeading title={project.name} description="Changes save automatically." media={<ProjectIcon p={project} size={32} />} />

    <SettingsGroup><SettingsFields>
      <Field orientation="responsive" data-invalid={error ? true : undefined}>
        <FieldContent><FieldLabel htmlFor="project-name">Name</FieldLabel>
          <FieldDescription>Shown in the project sidebar and task menus.</FieldDescription>
          {error && <FieldError><span data-selectable>{error}</span></FieldError>}
        </FieldContent>
        <Input id="project-name" className="min-w-0 @md/field-group:w-64 @md/field-group:min-w-64 @md/field-group:max-w-64" aria-invalid={error ? true : undefined} value={name} maxLength={64} spellCheck={false} onChange={(e) => { setName(e.target.value); setError(''); }} onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
      </Field>
    </SettingsFields></SettingsGroup>

    <SettingsGroup title="Folders" count={folders.length} description="New tasks start in the default folder."
      action={add('Add Folder', () => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder:add', { id })) },
        { label: 'Clone from URL…', run: () => { setText(''); setAdding('clone'); } }])}>
      <Things label="Folders" menu={folderMenu} empty={<Empty><EmptyHeader><EmptyMedia variant="icon"><FolderIcon /></EmptyMedia><EmptyTitle>No folders yet</EmptyTitle><EmptyDescription>Add a local folder or clone a repository to give your agents a place to work.</EmptyDescription></EmptyHeader></Empty>} things={folders.map((f) => ({ key: f.folder, name: base(f.folder), media: <FolderIcon className="size-5" />,
        description: f.folder, data: { 'data-folder': f.folder },
        badges: <>{f.folder === folders[0]?.folder && folders.length > 1 && <Badge variant="secondary">Default</Badge>}
          {f.git !== 'ok' && <Badge variant="outline"><span className="text-warning">{f.git === 'none' ? 'No git' : 'No commit yet'}</span></Badge>}</>,
        control: account(f) }))} />
      {adding === 'clone' && <div className="p-3"><AddInPlace label="Repository URL" placeholder="git@github.com:me/shop.git" value={text} onChange={setText} go={() => void clone()} stop={stop}
        ok={cloning ? 'Cloning…' : 'Clone'} busy={cloning} error={errors.folders || undefined} /></div>}
      {github?.repos.filter((g) => g.why).map((g) => <Alert key={g.folder}>
        <AlertDescription><span data-selectable>{base(g.folder)}: {g.why}{g.install && ' Install it, or ask its owner to.'}</span></AlertDescription>
        {g.install && <AlertAction><Button variant="outline" size="sm" asChild><a href={g.install} target="_blank" rel="noreferrer">Install it on {g.owner}</a></Button></AlertAction>}
      </Alert>)}
      {adding !== 'clone' && err(errors.folders)}
    </SettingsGroup>

    <SettingsGroup title="Agents" count={mine.length} description="Accounts available to work on your tasks."
      action={add('Add Agent', agentMenu, !!signing || (!addable.length && !s.clis.length))}>
      <Things label="Agents" menu={agentRowMenu} empty={signing ? undefined : <Empty><EmptyHeader><EmptyMedia variant="icon"><BotIcon /></EmptyMedia><EmptyTitle>No agents added</EmptyTitle><EmptyDescription>Tasks start with a terminal. Add an agent to work with a coding assistant.</EmptyDescription></EmptyHeader></Empty>}
        things={mine.map((a) => { const Mark = agentMark(a.cli); return { key: a.id, name: a.agent, media: <Mark className="size-6" />,
          data: { 'data-agent': a.id }, badges: a.default && <Badge variant="secondary">Default</Badge>, description: a.email ?? undefined }; })} />
      {signing && <SignIn project={id} agent={signing} onClose={() => setSigning(null)}
        onDone={(r) => { setSigning(null); if (r.agents) patch({ projectAgents: r.agents }); void reload(); }} />}
      {err(errors.agents)}
    </SettingsGroup>

    <SettingsGroup title="Profiles" count={profiles.length} description="Browser identities for testing. Sign in once for every task."
      action={add('Add Profile', profileMenu)}>
      <Things label="Profiles" menu={(p) => [{ label: 'Remove from the Project…', run: () => removeProfile(p) }]}
        empty={adding === 'profile' ? undefined : <Empty><EmptyHeader><EmptyMedia variant="icon"><UsersIcon /></EmptyMedia><EmptyTitle>No profiles added</EmptyTitle><EmptyDescription>Add a profile to test your app as a signed-in user.</EmptyDescription></EmptyHeader></Empty>}
        things={profiles.map((p) => ({ key: p.id, name: p.name, media: <Avatar size="sm"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback>{p.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>, data: { 'data-profile': p.id },
          description: [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') || undefined }))} />
      {adding === 'profile' && <div className="p-3"><AddInPlace label="New profile" placeholder="Its name, e.g. ann@shop.com" value={text} onChange={setText} go={() => void addProfile()}
        stop={stop} ok="Create" name error={errors.profiles || undefined} /></div>}
      {adding !== 'profile' && err(errors.profiles)}
    </SettingsGroup>

    <SettingsGroup label="Local addresses"><SettingsFields>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel htmlFor="project-local-addresses">Local addresses</FieldLabel>
          <FieldDescription>Additional addresses where agents may type saved test users' passwords, besides localhost and your network.</FieldDescription>
        </FieldContent>
        <div className="flex min-w-0 flex-col gap-2 @md/field-group:w-64 @md/field-group:min-w-64 @md/field-group:max-w-64">
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
      </Field>
    </SettingsFields></SettingsGroup>
  </div>;
}
