// New Project, step by step (docs/tasks.md, Projects): Code, Agents, Profiles, then Create; its state and rules in
// lib/new-project.ts. A dialog of a tasks' window (New Project…), and the welcome's own (Welcome.tsx: under a question
// each, Back on the first step leaves for the slides before it).
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Button, Caption1, Card, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Field,
  Input, List, ListItem, Tab, TabList, Spinner, Text, ToggleButton, Tooltip } from '@fluentui/react-components';
import { AddRegular, BranchFilled, BranchRegular, DismissRegular, FolderAddFilled, FolderAddRegular, FolderFilled, FolderRegular, StarFilled, StarRegular, SubtractRegular,
  bundleIcon } from '@fluentui/react-icons';
import { useShallow } from 'zustand/react/shallow';
import { SignIn } from './SignIn';
import { InstallProgress } from './AgentPicker';
import { agentMark } from './AgentMark';
import { avatarSrc } from '../lib/common';
import { useAgentList } from '../lib/agents';
import { askName, isDefault, refusalOf, STEPS, useWizard, whereOf, wizard, type From, type Wizard as W } from '../lib/new-project';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';
import { ErrorBar } from './ErrorBar';
import common from './common.module.css';
import css from './NewProject.module.css';

// An error at its field: text to copy and search for (the body is not).
const invalid = (text: string | false | undefined) => (text ? <span className={common.selectable}>{text}</span> : undefined);
// What will happen, said under its field as it is typed (the tests' handle: its name), and a line more.
const said = (where: string, more?: string) => (where || more ? <>{where && <div role="status" aria-label="What will happen">{where}</div>}{more && <div>{more}</div>}</> : undefined);
const FolderAdd = bundleIcon(FolderAddFilled, FolderAddRegular), Folder = bundleIcon(FolderFilled, FolderRegular), Branch = bundleIcon(BranchFilled, BranchRegular);
const Star = bundleIcon(StarFilled, StarRegular);
const KINDS: { value: From; label: string; icon: ReactElement }[] = [{ value: 'new', label: 'New Folder', icon: <FolderAdd /> },
  { value: 'folder', label: 'Folders on Disk', icon: <Folder /> }, { value: 'clone', label: 'Clone from URL', icon: <Branch /> }];

// 1. Its code: its kind (a new folder, folders there are, a clone), the form under it.
function CodeStep({ w, nameRef }: { w: W; nameRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useWizard(w, (x) => x);
  const [chosen, setChosen] = useState<string>();
  const folder = s.from === 'folder';
  const rows = folder ? s.sources : s.urls.map((u) => ({ folder: u, state: '' }));
  const remove = () => { w.removeSource(chosen); setChosen(undefined); };
  const refusal = refusalOf(s), where = refusal ? '' : whereOf(s, w.single), at = (field: 'source' | 'name') => s.errorAt === field && s.error;
  const later = w.single && s.from !== 'new' ? `A frontend and a backend? Add the other ${folder ? 'folder' : 'repository'} later in Settings.` : '';
  return <div className={css.column}>
    <TabList aria-label="Start from" selectedValue={s.from} onTabSelect={(_, d) => w.change({ from: d.value as From })}>
      {KINDS.map((k) => <Tab key={k.value} value={k.value} icon={k.icon}>{k.label}</Tab>)}
    </TabList>
    {/* One folder or URL (the welcome's): taken as it is left, or at Next */}
    {s.from !== 'new' && w.single && <Field label={folder ? 'Folder' : 'URL'} validationMessage={invalid(at('source'))} hint={said(folder ? where : '', later)}>
      <div className={css.line}>
        <Input value={s.typed} spellCheck={false} placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'}
          onChange={(_, d) => w.set({ typed: d.value, error: '' })} onBlur={() => void w.addSource()}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
        {folder && <Button onClick={() => void w.browse(true)}>Browse…</Button>}
      </div>
    </Field>}
    {/* Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list, under
        it once there is one. Its label is for the field (htmlFor): Field otherwise names the field by it over the
        field's own aria-label. */}
    {s.from !== 'new' && !w.single && <Field label={{ children: folder ? 'Folders' : 'URLs', htmlFor: 'npsource' }}
      validationMessage={invalid(at('source'))} hint={said(folder ? where : '')}>
      <div role="group" aria-label={folder ? 'Folders' : 'URLs'} className={css.sources}>
        <div className={css.line}>
          <Input id="npsource" value={s.typed} spellCheck={false} aria-label={folder ? 'A folder' : 'A repository URL'}
            placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'} onChange={(_, d) => w.set({ typed: d.value, error: '' })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
          <Button onClick={() => void w.addSource()}>Add</Button>
          {folder && <Tooltip content="Add Folder…" relationship="label"><Button icon={<AddRegular />} onClick={() => void w.browse(true)} /></Tooltip>}
          <Tooltip content="Leave Out" relationship="label"><Button icon={<SubtractRegular />} disabledFocusable={!chosen} onClick={remove} /></Tooltip>
        </div>
        {rows.length > 0 && <Card appearance="outline" size="small"><div className={css.list}><List aria-label={folder ? 'Folders' : 'URLs'} navigationMode="items"
          selectionMode="single" selectedItems={chosen ? [chosen] : []} onSelectionChange={(_, d) => setChosen(d.selectedItems[0] as string | undefined)}
          onKeyDown={(e) => { if (e.key === 'Delete') remove(); }}>
          {rows.map((x, i) => <ListItem key={x.folder} value={x.folder} data-source={x.folder} aria-label={x.folder} checkmark={null}>
            <div className={css.item}>
              <span className={css.path}><Text truncate wrap={false} block title={x.folder}>{x.folder}</Text></span>
              {x.state && <Badge appearance="outline" size="small">{x.state === 'repo' ? 'git' : 'no git'}</Badge>}
              {!i && rows.length > 1 && <Badge appearance="outline" size="small">default</Badge>}
            </div>
          </ListItem>)}
        </List></div></Card>}
      </div>
    </Field>}
    {askName(s, w.single) && <Field orientation="horizontal" label={w.single ? 'Project name' : 'Name'}
      validationMessage={invalid(at('name'))}>
      <Input input={{ ref: nameRef }} value={s.name} maxLength={64} placeholder="e.g. tenant-audit" spellCheck={false}
        onChange={(_, d) => w.change({ name: d.value })} />
    </Field>}
    {!folder && <Field orientation="horizontal" label="Location" validationMessage={invalid(refusal)} hint={said(where)}>
      <div className={css.line}>
        <Input value={s.place} spellCheck={false} onChange={(_, d) => w.change({ place: d.value })} />
        <Button onClick={() => void w.browse()}>Browse…</Button>
      </div>
    </Field>}
  </div>;
}

// 2. Its agents: the accounts there are first, then a new one of Claude Code or Codex.
function AgentStep({ w }: { w: W }) {
  const { accounts, chosen, main, signing, clis } = useWizard(w, useShallow((s) => ({ accounts: s.accounts, chosen: s.chosen, main: s.main, signing: s.signing, clis: s.clis })));
  const agents = useAgentList(w.installs, (s) => s.agents), installing = useAgentList(w.installs, (s) => s.installing);
  const addable = agents.filter((a) => clis.includes(a.id));
  const st = { chosen, main } as Parameters<typeof isDefault>[0];
  return <div className={css.column}>
    <Text>Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the default one; the others
      open beside it). Change it any time in Settings.</Text>
    <div role="group" aria-label="Accounts" className={css.accounts}>
      {accounts.map((a) => {
        const Mark = agentMark(a.agent), on = chosen.includes(a.id), def = on && isDefault(st, a.id);
        return <div key={a.id} data-account={a.id} className={css.account}>
          <Checkbox checked={on} onChange={(_, d) => w.choose(a.id, !!d.checked)}
            label={<span className={css.labelled}><Mark />{`${a.name} · ${a.email || a.id}`}</span>} />
          {on && <Tooltip content={def ? 'The default: a new task starts it' : 'Make Default'} relationship="description">
            <ToggleButton size="small" appearance="subtle" checked={def} aria-label="Default" icon={<Star />} onClick={() => w.set({ main: a.id })} /></Tooltip>}
          {def && <Badge appearance="outline" size="small">default</Badge>}
        </div>;
      })}
      {!accounts.length && <Text>No accounts yet: add one below, or go on without (a task then starts with a terminal).</Text>}
    </div>
    <Text weight="semibold">Add account</Text>
    {signing ? <SignIn agent={signing} onDone={w.signedIn} onClose={() => w.set({ signing: null })} /> : <>
      <div className={css.wrap}>
        {addable.map((a) => { const Mark = agentMark(a.id); return <Tooltip key={a.id} relationship="description"
          content={a.installed ? `Sign in to an account of ${a.name}` : `${a.name} is installed first (its maker's installer), then you sign in`}>
          <Button data-add={a.id} icon={<Mark />} disabledFocusable={installing || (!a.installed && !a.install)} onClick={() => void w.addAccount(a)}>{a.name}</Button>
        </Tooltip>; })}
      </div>
      <InstallProgress list={w.installs} />
    </>}
  </div>;
}

// 3. Its profiles: new ones (a name, who it is) and any of those there are already.
function ProfilesStep({ w }: { w: W }) {
  const { fresh, others, taken } = useWizard(w, useShallow((s) => ({ fresh: s.fresh, others: s.others, taken: s.taken })));
  const edit = (i: number, c: Partial<{ name: string; description: string }>) => w.set({ fresh: fresh.map((f, j) => (j === i ? { ...f, ...c } : f)) });
  return <div role="group" aria-label="Profiles" className={css.column}>
    <Text>The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can approve refunds").
      You sign in to them when the agent asks. None now: the agent makes those it needs.</Text>
    {fresh.map((f, i) => <div key={i} className={css.profile}>
      <Input value={f.name} maxLength={64} placeholder="ann@shop.com" spellCheck={false} aria-label="Name" onChange={(_, d) => edit(i, { name: d.value })} />
      <Input value={f.description} maxLength={500} placeholder="Who it is in your app" aria-label="Who it is" onChange={(_, d) => edit(i, { description: d.value })} />
      <Tooltip content="Leave Out" relationship="label"><Button appearance="subtle" icon={<DismissRegular />} onClick={() => w.set({ fresh: fresh.filter((_, j) => j !== i) })} /></Tooltip>
    </div>)}
    <div><Button icon={<AddRegular />} onClick={() => w.set({ fresh: [...fresh, { name: '', description: '' }] })}>Add Profile</Button></div>
    {!!others.length && <>
      <Text weight="semibold">Your profiles</Text>
      {others.map((p) => <div key={p.id} data-profile={p.id}>
        <Checkbox checked={taken.includes(p.id)} onChange={(_, d) => w.set({ taken: d.checked ? [...taken, p.id] : taken.filter((x) => x !== p.id) })}
          label={<span className={css.labelled}><Avatar size={20} image={{ src: avatarSrc(p.avatar) }} />{p.name}
            <Caption1>{p.description}</Caption1></span>} />
      </div>)}
    </>}
  </div>;
}

// The steps and their buttons, of a wizard made as they are shown (w), in a form (Enter is Next): its parts laid out by
// what shows it, the dialog in DialogTitle, DialogContent and DialogActions, the welcome in a Card's header and footer.
// leave: Back on the first step (the welcome's).
export interface WizardParts { step: number; saving: boolean; steps: ReactNode; error: ReactNode; back: ReactNode; go: ReactElement }
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
      steps: <div className={css.fill}>
        {step === 0 && <CodeStep w={w} nameRef={nameRef} />}
        {step === 1 && <AgentStep w={w} />}
        {step === 2 && <ProfilesStep w={w} />}
      </div>,
      error: error && !errorAt && <ErrorBar>{error}</ErrorBar>,
      back: (step > 0 || leave) && <Button onClick={() => (step ? w.back() : leave?.())}>Back</Button>,
      go: <Button type="submit" appearance="primary" disabled={saving} icon={saving ? <Spinner size="tiny" /> : undefined}>{saving ? (from === 'clone' ? 'Cloning…' : 'Creating…') : last ? 'Create' : 'Next'}</Button>,
    })}
  </form>;
}

// The steps' names, the shown one marked (the dialog's; the welcome asks a question each).
function StepNames({ step }: { step: number }) {
  return <ol aria-label="Steps" className={css.stepNames}>
    {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={css.stepName}>
      <Badge shape="circular" appearance={i === step ? 'filled' : i < step ? 'tint' : 'outline'} color={i <= step ? 'brand' : 'subtle'}>{i + 1}</Badge>
      <Text weight={i === step ? 'semibold' : 'regular'}>{s}</Text></li>)}
  </ol>;
}

// The dialog (New Project… in the sidebar), its steps anew each time it opens; a Create under way (a clone takes a
// while) keeps it open, however it would close (Esc, a click outside, ×, Cancel).
export function NewProject() {
  const { open, setOpen } = useCovered('hide');
  const [w, setW] = useState<W | null>(null);
  useEffect(() => { registerDialog('newproject', { open: async () => { setW(wizard(false)); setOpen(true); } }); }, [setOpen]);
  return <Dialog open={open && !!w} onOpenChange={(_, d) => { if (!d.open && !w?.store.getState().saving) setOpen(false); }}>
    <DialogSurface aria-label="New Project">
      {w && <Wizard w={w} done={() => setOpen(false)}>{({ step, saving, steps, error, back, go }) =>
        <DialogBody>
          <DialogTitle action={<DialogTrigger action="close"><Button appearance="subtle" aria-label="Close" icon={<DismissRegular />} disabled={saving} /></DialogTrigger>}>
            New Project
          </DialogTitle>
          <DialogContent><div className={css.content}>
            <StepNames step={step} />
            {steps}
            {error}
          </div></DialogContent>
          {back && <DialogActions position="start">{back}</DialogActions>}
          <DialogActions position="end">
            <DialogTrigger action="close"><Button disabled={saving}>Cancel</Button></DialogTrigger>
            {go}
          </DialogActions>
        </DialogBody>}
      </Wizard>}
    </DialogSurface>
  </Dialog>;
}
