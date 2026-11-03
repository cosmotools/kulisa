// New Project's map (docs/tasks.md, Projects): shared by welcome and the window's dialog. The draft owns validation
// and creation; these nodes explain repositories, agents and optional testing before the human has seen a task.
import { createElement, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, BotIcon, CheckIcon, ChevronDownIcon, CircleAlertIcon, FolderGit2Icon, FolderOpenIcon,
  FolderPlusIcon, GlobeIcon, PlusIcon, SquareTerminalIcon, StarIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, Avatar, AvatarImage, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Checkbox, Collapsible, CollapsibleContent, CollapsibleTrigger, Dialog, DialogContent, DialogHeader, DialogTitle,
  Field, FieldDescription, FieldError, FieldLabel, Input, Spinner, Tabs, TabsList, TabsTrigger, Toggle } from '@ui';
import { SignIn } from './SignIn';
import { InstallProgress } from './AgentPicker';
import { agentMark } from './AgentMark';
import { Tip } from './Tip';
import { AppLogo } from './ProjectIcon';
import { avatarSrc } from '../lib/common';
import { useAgentList } from '../lib/agents';
import { isDefault, projectDraft, refusalOf, useProjectDraft, whereOf, type From, type ProjectDraft } from '../lib/new-project';
import { registerDialog } from '../lib/dialogs';

function Node({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return <Card role="group" aria-label={title} className="min-w-0">
    <CardHeader>
      <div className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-muted">{icon}</div>
      <CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent><div className="flex flex-col gap-4">{children}</div></CardContent>
  </Card>;
}

function Repositories({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x), id = useId();
  const [editing, setEditing] = useState(false);
  const folder = s.from === 'folder', refusal = refusalOf(s), where = whereOf(s);
  const error = s.errorAt === 'source' ? s.error : refusal;
  const rows = folder ? s.sources.map((f) => ({ value: f.folder, git: f.state === 'repo' })) : s.urls.map((u) => ({ value: u, git: true }));
  const change = (from: From) => { d.change({ from, typed: '', errorAt: '' }); setEditing(true); };
  return <Node title="Repositories & folders" description="Where your agent works on the code." icon={<FolderGit2Icon className="size-5" />}>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => change('clone')}><PlusIcon />Add repository</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => change('folder')}><PlusIcon />Add folder</Button>
    </div>
    {(editing || s.from === 'new') && <div className="flex flex-col gap-3">
      {editing && <Tabs value={s.from} onValueChange={(v) => change(v as From)}>
        <TabsList aria-label="Start from" className="w-full">
          <TabsTrigger value="new"><FolderPlusIcon />New</TabsTrigger>
          <TabsTrigger value="folder"><FolderOpenIcon />On disk</TabsTrigger>
          <TabsTrigger value="clone"><FolderGit2Icon />Clone</TabsTrigger>
        </TabsList>
      </Tabs>}
      {s.from === 'new' ? <>
        <div className="flex items-center gap-2 text-sm font-medium"><FolderPlusIcon className="size-4" />A new folder for your project</div>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor={`${id}-location`}>Create in</FieldLabel>
          <div className="flex gap-2">
            <Input id={`${id}-location`} value={s.place} spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => d.change({ place: e.target.value })} />
            <Button type="button" variant="outline" size="icon" aria-label="Browse location" onClick={() => void d.browse()}><FolderOpenIcon /></Button>
          </div>
          <FieldDescription>The project name becomes its folder name.</FieldDescription>
        </Field>
      </> : <Field data-invalid={!!error || undefined}>
        <FieldLabel htmlFor={`${id}-source`}>{folder ? 'Folder on disk' : 'Repository URL'}</FieldLabel>
        <div className="flex gap-2">
          <Input id={`${id}-source`} value={s.typed} spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined}
            placeholder={folder ? 'Path to your code' : 'git@github.com:you/project.git'}
            onChange={(e) => d.set({ typed: e.target.value, error: '' })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void d.addSource(); } }} />
          <Button type="button" variant="outline" size="icon" aria-label={folder ? 'Browse folder' : 'Add repository URL'}
            onClick={() => void (folder ? d.browse(true) : d.addSource())}>{folder ? <FolderOpenIcon /> : <PlusIcon />}</Button>
        </div>
        {folder && <Button type="button" variant="outline" size="sm" onClick={() => void d.addSource()}>Use this folder</Button>}
      </Field>}
      {s.from === 'clone' && <Field>
        <FieldLabel htmlFor={`${id}-clone-location`}>Clone into</FieldLabel>
        <div className="flex gap-2">
          <Input id={`${id}-clone-location`} value={s.place} spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => d.change({ place: e.target.value })} />
          <Button type="button" variant="outline" size="icon" aria-label="Browse clone location" onClick={() => void d.browse()}><FolderOpenIcon /></Button>
        </div>
      </Field>}
    </div>}
    {s.from !== 'new' && rows.map((row, i) => <div key={row.value} role="group" aria-label={row.value} className="flex min-w-0 items-start gap-2 rounded-lg border p-3">
      {row.git ? <FolderGit2Icon className="mt-0.5 size-4 shrink-0" /> : <FolderOpenIcon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={row.value}>{row.value.split(/[\\/]/).pop()}</p>
        <p className="truncate text-xs text-muted-foreground" title={row.value}>{row.value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.git ? 'Tasks can work on separate branches.' : 'Tasks work directly in this folder.'}</p>
        {!i && rows.length > 1 && <Badge variant="outline">Default</Badge>}
      </div>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Leave out ${row.value}`} onClick={() => d.removeSource(row.value)}><XIcon /></Button>
    </div>)}
    {where && <p role="status" aria-label="What will happen" className="text-xs break-all text-muted-foreground">{where}</p>}
    {error && <FieldError id={`${id}-error`}><span data-selectable>{error}</span></FieldError>}
  </Node>;
}

function Agents({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x);
  const agents = useAgentList(d.installs, (x) => x.agents), installing = useAgentList(d.installs, (x) => x.installing);
  const looking = useAgentList(d.installs, (x) => x.looking);
  return <Node title="Agents" description="Choose who develops and checks your app." icon={<BotIcon className="size-5" />}>
    {s.accounts.map((a) => {
      const selected = s.chosen.includes(a.id), def = selected && isDefault(s, a.id);
      return <Field key={a.id} orientation="horizontal">
        <Checkbox id={`map-${a.id}`} checked={selected} onCheckedChange={(c) => d.choose(a.id, c === true)} />
        <FieldLabel htmlFor={`map-${a.id}`}>
          {createElement(agentMark(a.agent), { className: 'size-4 shrink-0' })}
          <span className="min-w-0"><span className="block">{a.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{a.email || a.id}</span></span>
        </FieldLabel>
        {selected && <Tip text={def ? 'Starts in a new task' : 'Make default'}><Toggle size="sm" pressed={def} aria-label={`Default agent ${a.name}`} onPressedChange={() => d.set({ main: a.id })}>
          <StarIcon className={def ? 'fill-current' : undefined} /></Toggle></Tip>}
      </Field>;
    })}
    {s.signing ? <SignIn agent={s.signing} onDone={d.signedIn} onClose={() => d.set({ signing: null })} /> : <div className="flex flex-wrap gap-2">
      {agents.filter((a) => s.clis.includes(a.id)).map((a) => <Button key={a.id} type="button" variant="outline" disabled={installing || (!a.installed && !a.install)}
        onClick={() => void d.addAccount(a)}>{createElement(agentMark(a.id))}{a.name}</Button>)}
    </div>}
    {looking && <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner role={undefined} aria-hidden />Finding your agents…</div>}
    <InstallProgress list={d.installs} />
    <p className="text-xs text-muted-foreground">{s.chosen.length ? 'The starred agent starts your first task. You can open others alongside it.' : 'Add an account to get started, or continue with a terminal and choose an agent later.'}</p>
  </Node>;
}

function Testing({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x);
  const [open, setOpen] = useState(false);
  const edit = (i: number, patch: Partial<{ name: string; description: string }>) => d.set({ fresh: s.fresh.map((f, j) => j === i ? { ...f, ...patch } : f) });
  return <Node title="Run & check" description="Your app, visible to you and your agent." icon={<CheckIcon className="size-5" />}>
    <div className="flex items-start gap-3"><GlobeIcon className="mt-0.5 size-4 shrink-0" /><div>
      <p className="text-sm font-medium">Browser profiles</p><p className="mt-1 text-xs text-muted-foreground">Try your web app as different users, each with their own sign-in.</p>
    </div></div>
    <div className="flex items-start gap-3"><SquareTerminalIcon className="mt-0.5 size-4 shrink-0" /><div>
      <p className="text-sm font-medium">Interactive terminals</p><p className="mt-1 text-xs text-muted-foreground">Run CLI apps and work with their screens, prompts and keyboard controls.</p>
    </div></div>
    <p className="text-sm text-muted-foreground">Start a task and tell your agent what to build. It can open the browsers and terminals it needs as you work.</p>
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm"><ChevronDownIcon className={open ? 'rotate-180' : undefined} />Set up browser profiles now</Button></CollapsibleTrigger>
      <CollapsibleContent><div role="group" aria-label="Profiles" className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Optional. Add roles now if you know them; sign in when needed.</p>
        {s.fresh.map((f, i) => <div key={i} className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input value={f.name} maxLength={64} placeholder="e.g. Customer" aria-label={`Profile ${i + 1} name`} onChange={(e) => edit(i, { name: e.target.value })} />
            <Input value={f.description} maxLength={500} placeholder="What this user can do" aria-label={`Profile ${i + 1} role`} onChange={(e) => edit(i, { description: e.target.value })} />
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Leave out profile ${i + 1}`} onClick={() => d.set({ fresh: s.fresh.filter((_, j) => j !== i) })}><XIcon /></Button>
        </div>)}
        {s.others.map((p) => <Field key={p.id} orientation="horizontal">
          <Checkbox id={`map-profile-${p.id}`} checked={s.taken.includes(p.id)} onCheckedChange={(c) => d.set({ taken: c === true ? [...s.taken, p.id] : s.taken.filter((x) => x !== p.id) })} />
          <FieldLabel htmlFor={`map-profile-${p.id}`}><Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar>{p.name}</FieldLabel>
        </Field>)}
        <div><Button type="button" variant="outline" size="sm" onClick={() => d.set({ fresh: [...s.fresh, { name: '', description: '' }] })}><PlusIcon />Add profile</Button></div>
      </div></CollapsibleContent>
    </Collapsible>
    {!open && (s.fresh.length > 0 || s.taken.length > 0) && <p className="text-xs text-muted-foreground">{s.fresh.filter((p) => p.name.trim()).length + s.taken.length} profiles selected</p>}
  </Node>;
}

export function ProjectMap({ draft: d, back, done }: { draft: ProjectDraft; back?: () => void; done?: () => void }) {
  const s = useProjectDraft(d, (x) => x), nameRef = useRef<HTMLInputElement>(null), id = useId();
  const installing = useAgentList(d.installs, (x) => x.installing);
  useEffect(() => { void d.reset(); }, [d]);
  useEffect(() => { if (s.ready) nameRef.current?.focus(); }, [s.ready]);
  const submit = async () => {
    if (await d.create()) done?.();
    else if (d.store.getState().errorAt === 'name') nameRef.current?.focus();
  };
  if (!s.ready) return <div role="status" className="flex items-center justify-center gap-2 p-8"><Spinner />Preparing your project…</div>;
  return <form aria-label="New Project" className="flex min-h-0 flex-1 flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    <div className="min-h-0 overflow-auto p-1">
      <fieldset disabled={s.saving} className="relative grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)_minmax(0,1fr)]">
        {/* A fixed map, not a graph editor: plain connectors collapse away with the single-column layout. */}
        <svg aria-hidden="true" className="pointer-events-none absolute top-12 hidden h-24 w-full overflow-visible text-border lg:block" preserveAspectRatio="none" viewBox="0 0 1000 100">
          <path d="M300 70 H355 Q375 70 375 50 H440 M560 50 H625 Q645 50 645 70 H700" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="relative min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1"><Repositories draft={d} /></div>
        <div className="relative min-w-0 max-lg:order-first lg:col-start-2 lg:row-start-1">
          <Card><CardHeader><div className="mb-2"><AppLogo size={40} /></div>
            <CardTitle>Your project</CardTitle><CardDescription>One place for everything you are building.</CardDescription></CardHeader>
            <CardContent><Field data-invalid={s.errorAt === 'name' || undefined}>
              <FieldLabel htmlFor={`${id}-name`}>Project name</FieldLabel>
              <Input id={`${id}-name`} ref={nameRef} value={s.name} maxLength={64} spellCheck={false} placeholder="e.g. my-next-app" aria-invalid={s.errorAt === 'name' || undefined} aria-describedby={s.errorAt === 'name' ? `${id}-name-error` : undefined}
                onChange={(e) => d.change({ name: e.target.value, errorAt: '' })} />
              {s.errorAt === 'name' && <FieldError id={`${id}-name-error`}><span data-selectable>{s.error}</span></FieldError>}
            </Field></CardContent>
          </Card>
          <div aria-hidden="true" className="mx-auto -mb-5 hidden h-5 w-px bg-border lg:block" />
        </div>
        <div className="relative min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1"><Testing draft={d} /></div>
        <div className="relative min-w-0 lg:col-start-2 lg:row-start-2"><Agents draft={d} /></div>
      </fieldset>
      {s.error && !s.errorAt && <div className="mt-4"><Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{s.error}</span></AlertDescription></Alert></div>}
    </div>
    <div className="flex shrink-0 items-center gap-3 border-t pt-4">
      {back && <Button type="button" variant="ghost" disabled={s.saving || installing} onClick={back}><ArrowLeftIcon />Back</Button>}
      <p className="me-auto text-xs text-muted-foreground">You can change your project setup later.</p>
      <Button type="submit" size="lg" disabled={s.saving || !!s.signing || installing}>{s.saving ? <><Spinner />{s.from === 'clone' ? 'Cloning…' : 'Creating…'}</> : <>Create project<ArrowRightIcon /></>}</Button>
    </div>
  </form>;
}

export function NewProject() {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<ProjectDraft | null>(null);
  useEffect(() => { registerDialog('newproject', { open: async () => { setDraft(projectDraft()); setOpen(true); } }); }, []);
  const close = () => { if (!draft?.store.getState().saving && !draft?.installs.store.getState().installing) setOpen(false); };
  return <Dialog open={open && !!draft} onOpenChange={(o) => { if (!o) close(); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-6xl" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
      <div className="flex max-h-[78vh] min-h-0 flex-col">{draft && <ProjectMap draft={draft} done={() => setOpen(false)} />}</div>
    </DialogContent>
  </Dialog>;
}
