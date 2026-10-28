// New Project, step by step (docs/tasks.md, Projects): Code, Agents, Profiles, then Create; its state and rules in
// lib/new-project.ts. A dialog of a tasks' window (New Project…), and the welcome's own (Welcome.tsx: under a question
// each, Back on the first step leaves for the slides before it).
import { createElement, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { FolderGit2Icon, FolderOpenIcon, FolderPlusIcon, MinusIcon, PlusIcon, StarIcon, XIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Avatar, AvatarImage, Badge, Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldDescription, FieldError,
  FieldLabel, FieldLegend, FieldSet, Input, RadioGroup, RadioGroupItem, Spinner, Tabs, TabsList, TabsTrigger, Toggle } from '@ui';
import { SignIn } from './SignIn';
import { InstallProgress } from './AgentPicker';
import { agentMark } from './AgentMark';
import { Tip } from './Tip';
import { avatarSrc } from '../lib/common';
import { useAgentList } from '../lib/agents';
import { askName, isDefault, refusalOf, STEPS, useWizard, whereOf, wizard, type From, type Wizard as W } from '../lib/new-project';
import { registerDialog } from '../lib/dialogs';
import { ErrorBar } from './ErrorBar';

const KINDS: { value: From; label: string; icon: ReactElement }[] = [{ value: 'new', label: 'New Folder', icon: <FolderPlusIcon /> },
  { value: 'folder', label: 'Folders on Disk', icon: <FolderOpenIcon /> }, { value: 'clone', label: 'Clone from URL', icon: <FolderGit2Icon /> }];

// A field of a step: its label, its control, what will happen said under it as it is typed (the tests' handle: its
// name) and a line more, its error (text to copy and search for: the body is not). The control is described by both,
// as a screen reader and the tests read it.
function StepField({ label, error, where, more, children }: { label: ReactNode; error?: string | false; where?: string; more?: string;
  children: (control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode }) {
  const id = useId();
  const described = [where || more ? `${id}-said` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <Field data-invalid={!!error || undefined}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    {children({ id, 'aria-describedby': described, 'aria-invalid': error ? true : undefined })}
    {(where || more) && <FieldDescription id={`${id}-said`}>
      {where && <span role="status" aria-label="What will happen" className="block">{where}</span>}
      {more && <span className="block">{more}</span>}
    </FieldDescription>}
    {error && <FieldError id={`${id}-error`}><span data-selectable>{error}</span></FieldError>}
  </Field>;
}

// The folders or URLs added, one chosen to leave out (Delete, or −); the first the default.
function Sources({ label, rows, chosen, choose, remove }: { label: string; rows: { folder: string; state: string }[]; chosen?: string;
  choose: (f: string | undefined) => void; remove: () => void }) {
  const id = useId();
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Delete') return;
    const list = e.currentTarget;
    remove();
    requestAnimationFrame(() => list.querySelector<HTMLElement>('[role="radio"]')?.focus()); // the keyboard stays in the list
  };
  return <div className="max-h-36 overflow-auto rounded-lg border p-2">
    <RadioGroup aria-label={label} value={chosen ?? ''} loop={false} onValueChange={choose} onKeyDown={keys}>
      {rows.map((x, i) => <Field key={x.folder} orientation="horizontal" data-source={x.folder}>
        <RadioGroupItem id={`${id}-${i}`} value={x.folder} aria-label={x.folder} />
        <FieldLabel htmlFor={`${id}-${i}`} className="min-w-0"><span className="truncate" title={x.folder}>{x.folder}</span></FieldLabel>
        {x.state && <Badge variant="outline">{x.state === 'repo' ? 'git' : 'no git'}</Badge>}
        {!i && rows.length > 1 && <Badge variant="outline">default</Badge>}
      </Field>)}
    </RadioGroup>
  </div>;
}

// 1. Its code: its kind (a new folder, folders there are, a clone), the form under it.
function CodeStep({ w, nameRef }: { w: W; nameRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useWizard(w, (x) => x);
  const [chosen, setChosen] = useState<string>();
  const folder = s.from === 'folder';
  const rows = folder ? s.sources : s.urls.map((u) => ({ folder: u, state: '' }));
  const remove = () => { w.removeSource(chosen); setChosen(undefined); };
  const refusal = refusalOf(s), where = refusal ? '' : whereOf(s, w.single), at = (field: 'source' | 'name') => s.errorAt === field && s.error;
  const later = w.single && s.from !== 'new' ? `A frontend and a backend? Add the other ${folder ? 'folder' : 'repository'} later in Settings.` : '';
  const placeholder = folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git';
  const enter = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } };
  return <div className="flex min-w-0 flex-1 flex-col gap-4">
    <Tabs value={s.from} onValueChange={(v) => w.change({ from: v as From })}>
      <TabsList aria-label="Start from">
        {KINDS.map((k) => <TabsTrigger key={k.value} value={k.value}>{k.icon}{k.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
    {/* One folder or URL (the welcome's): taken as it is left, or at Next */}
    {s.from !== 'new' && w.single && <StepField label={folder ? 'Folder' : 'URL'} error={at('source')} where={folder ? where : ''} more={later}>
      {(c) => <div className="flex gap-2">
        <Input {...c} className="flex-1" value={s.typed} spellCheck={false} placeholder={placeholder}
          onChange={(e) => w.set({ typed: e.target.value, error: '' })} onBlur={() => void w.addSource()} onKeyDown={enter} />
        {folder && <Button type="button" variant="outline" onClick={() => void w.browse(true)}>Browse…</Button>}
      </div>}
    </StepField>}
    {/* Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list, under
        it once there is one. The field is one of them (its own name), the label the list's. */}
    {s.from !== 'new' && !w.single && <StepField label={folder ? 'Folders' : 'URLs'} error={at('source')} where={folder ? where : ''}>
      {(c) => <div role="group" aria-label={folder ? 'Folders' : 'URLs'} className="flex min-w-0 flex-col gap-2">
        <div className="flex gap-2">
          <Input {...c} className="flex-1" value={s.typed} spellCheck={false} placeholder={placeholder} aria-label={folder ? 'A folder' : 'A repository URL'}
            onChange={(e) => w.set({ typed: e.target.value, error: '' })} onKeyDown={enter} />
          <Button type="button" variant="outline" onClick={() => void w.addSource()}>Add</Button>
          {folder && <Tip text="Add Folder…"><Button type="button" variant="outline" size="icon" aria-label="Add Folder…" onClick={() => void w.browse(true)}><PlusIcon /></Button></Tip>}
          <Tip text="Leave Out"><Button type="button" variant="outline" size="icon" aria-label="Leave Out" disabled={!chosen} onClick={remove}><MinusIcon /></Button></Tip>
        </div>
        {rows.length > 0 && <Sources label={folder ? 'Folders' : 'URLs'} rows={rows} chosen={chosen} choose={setChosen} remove={remove} />}
      </div>}
    </StepField>}
    {askName(s, w.single) && <StepField label={w.single ? 'Project name' : 'Name'} error={at('name')}>
      {(c) => <Input {...c} ref={nameRef} value={s.name} maxLength={64} placeholder="e.g. tenant-audit" spellCheck={false}
        onChange={(e) => w.change({ name: e.target.value })} />}
    </StepField>}
    {!folder && <StepField label="Location" error={refusal} where={where}>
      {(c) => <div className="flex gap-2">
        <Input {...c} className="flex-1" value={s.place} spellCheck={false} onChange={(e) => w.change({ place: e.target.value })} />
        <Button type="button" variant="outline" onClick={() => void w.browse()}>Browse…</Button>
      </div>}
    </StepField>}
  </div>;
}

// 2. Its agents: the accounts there are first, then a new one of Claude Code or Codex.
function AgentStep({ w }: { w: W }) {
  const { accounts, chosen, main, signing, clis } = useWizard(w, useShallow((s) => ({ accounts: s.accounts, chosen: s.chosen, main: s.main, signing: s.signing, clis: s.clis })));
  const agents = useAgentList(w.installs, (s) => s.agents), installing = useAgentList(w.installs, (s) => s.installing);
  const addable = agents.filter((a) => clis.includes(a.id));
  const st = { chosen, main } as Parameters<typeof isDefault>[0];
  return <div className="flex min-w-0 flex-1 flex-col gap-3">
    <p>Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the default one; the others
      open beside it). Change it any time in Settings.</p>
    <div role="group" aria-label="Accounts" className="flex flex-col">
      {accounts.map((a) => {
        const on = chosen.includes(a.id), def = on && isDefault(st, a.id), id = `account-${a.id}`;
        return <Field key={a.id} orientation="horizontal" data-account={a.id} className="min-h-8">
          <Checkbox id={id} checked={on} onCheckedChange={(c) => w.choose(a.id, c === true)} />
          <FieldLabel htmlFor={id}>{createElement(agentMark(a.agent), { className: 'size-4' })}{`${a.name} · ${a.email || a.id}`}</FieldLabel>
          {on && <Tip text={def ? 'The default: a new task starts it' : 'Make Default'}>
            <Toggle size="sm" pressed={def} aria-label="Default" onPressedChange={() => w.set({ main: a.id })}>
              <StarIcon className={def ? 'fill-current' : undefined} /></Toggle></Tip>}
          {def && <Badge variant="outline">default</Badge>}
        </Field>;
      })}
      {!accounts.length && <p className="text-muted-foreground">No accounts yet: add one below, or go on without (a task then starts with a terminal).</p>}
    </div>
    <FieldSet>
      <FieldLegend variant="label">Add account</FieldLegend>
      {signing ? <SignIn agent={signing} onDone={w.signedIn} onClose={() => w.set({ signing: null })} /> : <>
        <div className="flex flex-wrap gap-2">
          {addable.map((a) => <Tip key={a.id} text={a.installed ? `Sign in to an account of ${a.name}` : `${a.name} is installed first (its maker's installer), then you sign in`}>
            <Button type="button" variant="outline" data-add={a.id} disabled={installing || (!a.installed && !a.install)} onClick={() => void w.addAccount(a)}>
              {createElement(agentMark(a.id))}{a.name}</Button>
          </Tip>)}
        </div>
        <InstallProgress list={w.installs} />
      </>}
    </FieldSet>
  </div>;
}

// 3. Its profiles: new ones (a name, who it is) and any of those there are already.
function ProfilesStep({ w }: { w: W }) {
  const { fresh, others, taken } = useWizard(w, useShallow((s) => ({ fresh: s.fresh, others: s.others, taken: s.taken })));
  const edit = (i: number, c: Partial<{ name: string; description: string }>) => w.set({ fresh: fresh.map((f, j) => (j === i ? { ...f, ...c } : f)) });
  return <div role="group" aria-label="Profiles" className="flex min-w-0 flex-1 flex-col gap-3">
    <p>The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can approve refunds").
      You sign in to them when the agent asks. None now: the agent makes those it needs.</p>
    {fresh.map((f, i) => <div key={i} className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] gap-2">
      <Input value={f.name} maxLength={64} placeholder="ann@shop.com" spellCheck={false} aria-label="Name" onChange={(e) => edit(i, { name: e.target.value })} />
      <Input value={f.description} maxLength={500} placeholder="Who it is in your app" aria-label="Who it is" onChange={(e) => edit(i, { description: e.target.value })} />
      <Tip text="Leave Out"><Button type="button" variant="ghost" size="icon" aria-label="Leave Out" onClick={() => w.set({ fresh: fresh.filter((_, j) => j !== i) })}><XIcon /></Button></Tip>
    </div>)}
    <div><Button type="button" variant="outline" onClick={() => w.set({ fresh: [...fresh, { name: '', description: '' }] })}><PlusIcon />Add Profile</Button></div>
    {!!others.length && <FieldSet>
      <FieldLegend variant="label">Your profiles</FieldLegend>
      {others.map((p) => <Field key={p.id} orientation="horizontal" data-profile={p.id}>
        <Checkbox id={`profile-${p.id}`} checked={taken.includes(p.id)}
          onCheckedChange={(c) => w.set({ taken: c === true ? [...taken, p.id] : taken.filter((x) => x !== p.id) })} />
        <FieldLabel htmlFor={`profile-${p.id}`}>
          <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar>{p.name}
          <span className="font-normal text-muted-foreground">{p.description}</span>
        </FieldLabel>
      </Field>)}
    </FieldSet>}
  </div>;
}

// The steps and their buttons, of a wizard made as they are shown (w), in a form (Enter is Next): its parts laid out by
// what shows it, the dialog in its header, body and footer, the welcome in a Card's.
// leave: Back on the first step (the welcome's).
interface WizardParts { step: number; saving: boolean; steps: ReactNode; error: ReactNode; back: ReactNode; go: ReactElement }
export function Wizard({ w, leave, done, className, children }: { w: W; leave?: () => void; done?: () => void; className?: string; children: (p: WizardParts) => ReactNode }) {
  const { ready, step, saving, error, errorAt, from } = useWizard(w, useShallow((s) => ({ ready: s.ready, step: s.step, saving: s.saving, error: s.error, errorAt: s.errorAt, from: s.from })));
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void w.reset(); }, [w]);
  useEffect(() => { if (ready) nameRef.current?.focus(); }, [ready]); // the keyboard in its name, once its defaults are there
  if (!ready) return null;
  const last = step === STEPS.length - 1;
  const next = async () => { if (await w.next()) done?.(); };
  return <form aria-label="New Project's steps" className={className} onSubmit={(e) => { e.preventDefault(); void next(); }}>
    {children({
      step, saving,
      steps: <div className="flex min-h-0 flex-1">
        {step === 0 && <CodeStep w={w} nameRef={nameRef} />}
        {step === 1 && <AgentStep w={w} />}
        {step === 2 && <ProfilesStep w={w} />}
      </div>,
      error: error && !errorAt && <ErrorBar>{error}</ErrorBar>,
      back: (step > 0 || leave) && <Button type="button" variant="outline" onClick={() => (step ? w.back() : leave?.())}>Back</Button>,
      go: <Button type="submit" disabled={saving}>{saving && <Spinner role={undefined} aria-hidden />}
        {saving ? (from === 'clone' ? 'Cloning…' : 'Creating…') : last ? 'Create' : 'Next'}</Button>,
    })}
  </form>;
}

// The steps' names, the shown one marked (the dialog's; the welcome asks a question each).
function StepNames({ step }: { step: number }) {
  return <ol aria-label="Steps" className="flex gap-6">
    {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className="flex items-center gap-1.5">
      <span className={i <= step ? 'grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground'
        : 'grid size-5 place-items-center rounded-full border text-xs text-muted-foreground'}>{i + 1}</span>
      <span className={i === step ? 'font-medium' : 'text-muted-foreground'}>{s}</span></li>)}
  </ol>;
}

// The dialog (New Project… in the sidebar), its steps anew each time it opens; a Create under way (a clone takes a
// while) keeps it open, however it would close (Esc, a click outside, ×, Cancel).
export function NewProject() {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState<W | null>(null);
  useEffect(() => { registerDialog('newproject', { open: async () => { setW(wizard(false)); setOpen(true); } }); }, []);
  const close = () => { if (!w?.store.getState().saving) setOpen(false); };
  return <Dialog open={open && !!w} onOpenChange={(o) => { if (!o) close(); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
      {w && <Wizard w={w} done={() => setOpen(false)} className="grid gap-4">{({ step, saving, steps, error, back, go }) => <>
        {/* its height its own, so the steps do not change it; what does not fit scrolls (docs/ui.md, It fits the smallest window) */}
        <div className="flex h-[min(400px,60vh)] min-h-0 flex-col gap-5 overflow-auto">
          <StepNames step={step} />
          {steps}
          {error}
        </div>
        <DialogFooter>
          {back && <div className="me-auto">{back}</div>}
          <Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button>
          {go}
        </DialogFooter>
      </>}</Wizard>}
    </DialogContent>
  </Dialog>;
}
