// New Project, step by step (docs/tasks.md, Projects): Code, Agents, Profiles, then Create; its state and rules in
// lib/new-project.ts. A dialog of a tasks' window (New Project…), and the welcome's own (Welcome.tsx: under a question
// each, Back on the first step leaves for the slides before it).
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Button, Card, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Divider, Field,
  Input, List, ListItem, Tab, TabList, Spinner, Text, ToggleButton, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { AddRegular, BranchFilled, BranchRegular, DismissRegular, FolderAddFilled, FolderAddRegular, FolderFilled, FolderRegular, StarFilled, StarRegular, SubtractRegular,
  bundleIcon } from '@fluentui/react-icons';
import { useShallow } from 'zustand/react/shallow';
import { SignIn } from './SignIn';
import { InstallProgress } from './AgentPicker';
import { agentMark } from './AgentMark';
import { avatarSrc } from './avatar';
import { useAgentList } from '../lib/agents';
import { askName, isDefault, refusalOf, STEPS, useWizard, whereOf, wizard, type From, type Wizard as W } from '../lib/new-project';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';
import { useCommonStyles } from './theme';
import { ErrorBar } from './ErrorBar';

const useStyles = makeStyles({
  // An error: text to copy and search for (the body is not); at its field, or over the buttons.
  // A one-line field's label beside it: every kind's form fits the smallest window (640×400) unscrolled, Browse… in sight.
  beside: { gridTemplateColumns: '96px minmax(0, 1fr)' },
  fill: { flex: 1, display: 'flex', minHeight: 0 },
  column: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  row: { display: 'flex', gap: tokens.spacingHorizontalS },
  grow: { flex: 1, minWidth: 0 },
  kinds: { flex: 'none', width: '180px' },
  divider: { flex: 'none' },
  form: { paddingInlineStart: tokens.spacingHorizontalL },
  sources: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, minWidth: 0 },
  list: { maxHeight: '144px', overflow: 'auto' },
  item: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: `${tokens.spacingVerticalXS} 0` },
  path: { flex: 1, minWidth: 0, overflow: 'hidden' },
  accounts: { display: 'flex', flexDirection: 'column' },
  account: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minHeight: '32px' },
  labelled: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  wrap: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalS },
  name: { flex: '0 1 200px' },
  description: { flex: 1 },
  heading: { marginTop: tokens.spacingVerticalS },
  stepNames: { display: 'flex', gap: tokens.spacingHorizontalXXL, margin: 0, padding: 0, listStyle: 'none' },
  stepName: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalSNudge },
  surface: { width: 'min(760px, 92vw)', maxWidth: 'none' },
  // Its height its own, so the steps do not change it (docs/ui.md, It fits the smallest window).
  body: { minHeight: 'min(480px, 85vh)' },
  content: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
});
const invalid = (text: string | false | undefined, className: string) => (text ? { children: text, className } : undefined);
// What will happen, said under its field as it is typed (the tests' handle: its name), and a line more.
const said = (where: string, more?: string) => (where || more ? <>{where && <div role="status" aria-label="What will happen">{where}</div>}{more && <div>{more}</div>}</> : undefined);
const FolderAdd = bundleIcon(FolderAddFilled, FolderAddRegular), Folder = bundleIcon(FolderFilled, FolderRegular), Branch = bundleIcon(BranchFilled, BranchRegular);
const Star = bundleIcon(StarFilled, StarRegular);
const KINDS: { value: From; label: string; icon: ReactElement }[] = [{ value: 'new', label: 'New Folder', icon: <FolderAdd /> },
  { value: 'folder', label: 'Folders on Disk', icon: <Folder /> }, { value: 'clone', label: 'Clone from URL', icon: <Branch /> }];

// 1. Its code, as JetBrains' New Project: the kinds on the left, the form on the right.
function CodeStep({ w, nameRef }: { w: W; nameRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useWizard(w, (x) => x), styles = useStyles(), common = useCommonStyles();
  const [chosen, setChosen] = useState<string>();
  const folder = s.from === 'folder';
  const rows = folder ? s.sources : s.urls.map((u) => ({ folder: u, state: '' }));
  const remove = () => { w.removeSource(chosen); setChosen(undefined); };
  const refusal = refusalOf(s), where = refusal ? '' : whereOf(s, w.single), at = (field: 'source' | 'name') => s.errorAt === field && s.error;
  const later = w.single && s.from !== 'new' ? `A frontend and a backend? Add the other ${folder ? 'folder' : 'repository'} later in Settings.` : '';
  return <div className={styles.fill}>
    <TabList vertical aria-label="Start from" selectedValue={s.from} onTabSelect={(_, d) => w.change({ from: d.value as From })}
      className={styles.kinds}>
      {KINDS.map((k) => <Tab key={k.value} value={k.value} icon={k.icon}>{k.label}</Tab>)}
    </TabList>
    <Divider vertical className={styles.divider} />
    <div className={mergeClasses(styles.column, styles.form)}>
      {/* One folder or URL (the welcome's): taken as it is left, or at Next */}
      {s.from !== 'new' && w.single && <Field label={folder ? 'Folder' : 'URL'} validationMessage={invalid(at('source'), common.selectable)} hint={said(folder ? where : '', later)}>
        <div className={styles.row}>
          <Input value={s.typed} spellCheck={false} className={styles.description} placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'}
            onChange={(_, d) => w.set({ typed: d.value, error: '' })} onBlur={() => void w.addSource()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
          {folder && <Button onClick={() => void w.browse(true)}>Browse…</Button>}
        </div>
      </Field>}
      {/* Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list, under
          it once there is one. Its label is for the field (htmlFor): Field otherwise names the field by it over the
          field's own aria-label. */}
      {s.from !== 'new' && !w.single && <Field label={{ children: folder ? 'Folders' : 'URLs', htmlFor: 'npsource' }}
        validationMessage={invalid(at('source'), common.selectable)} hint={said(folder ? where : '')}>
        <div role="group" aria-label={folder ? 'Folders' : 'URLs'} className={styles.sources}>
          <div className={styles.row}>
            <Input id="npsource" value={s.typed} spellCheck={false} aria-label={folder ? 'A folder' : 'A repository URL'} className={styles.grow}
              placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'} onChange={(_, d) => w.set({ typed: d.value, error: '' })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
            <Button onClick={() => void w.addSource()}>Add</Button>
            {folder && <Tooltip content="Add Folder…" relationship="label"><Button icon={<AddRegular />} onClick={() => void w.browse(true)} /></Tooltip>}
            <Tooltip content="Leave Out" relationship="label"><Button icon={<SubtractRegular />} disabledFocusable={!chosen} onClick={remove} /></Tooltip>
          </div>
          {rows.length > 0 && <Card appearance="outline" size="small"><List aria-label={folder ? 'Folders' : 'URLs'} navigationMode="items" selectionMode="single"
            selectedItems={chosen ? [chosen] : []} onSelectionChange={(_, d) => setChosen(d.selectedItems[0] as string | undefined)}
            onKeyDown={(e) => { if (e.key === 'Delete') remove(); }} className={styles.list}>
            {rows.map((x, i) => <ListItem key={x.folder} value={x.folder} data-source={x.folder} aria-label={x.folder} checkmark={null}
              className={styles.item}>
              <Text truncate wrap={false} title={x.folder} className={styles.path}>{x.folder}</Text>
              {x.state && <Badge appearance="outline" size="small">{x.state === 'repo' ? 'git' : 'no git'}</Badge>}
              {!i && rows.length > 1 && <Badge appearance="outline" size="small">default</Badge>}
            </ListItem>)}
          </List></Card>}
        </div>
      </Field>}
      {askName(s, w.single) && <Field orientation="horizontal" className={styles.beside} label={w.single ? 'Project name' : 'Name'}
        validationMessage={invalid(at('name'), common.selectable)}>
        <Input input={{ ref: nameRef }} value={s.name} maxLength={64} placeholder="e.g. tenant-audit" spellCheck={false}
          onChange={(_, d) => w.change({ name: d.value })} />
      </Field>}
      {!folder && <Field orientation="horizontal" className={styles.beside} label="Location" validationMessage={invalid(refusal, common.selectable)} hint={said(where)}>
        <div className={styles.row}>
          <Input value={s.place} spellCheck={false} className={styles.grow} onChange={(_, d) => w.change({ place: d.value })} />
          <Button onClick={() => void w.browse()}>Browse…</Button>
        </div>
      </Field>}
    </div>
  </div>;
}

// 2. Its agents: the accounts there are first, then a new one of Claude Code or Codex.
function AgentStep({ w }: { w: W }) {
  const { accounts, chosen, main, signing, clis } = useWizard(w, useShallow((s) => ({ accounts: s.accounts, chosen: s.chosen, main: s.main, signing: s.signing, clis: s.clis })));
  const agents = useAgentList(w.installs, (s) => s.agents), installing = useAgentList(w.installs, (s) => s.installing);
  const addable = agents.filter((a) => clis.includes(a.id));
  const st = { chosen, main } as Parameters<typeof isDefault>[0], styles = useStyles(), common = useCommonStyles();
  return <div className={styles.column}>
    <Text className={common.muted}>Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the default one; the others
      open beside it). Change it any time in Settings.</Text>
    <div role="group" aria-label="Accounts" className={styles.accounts}>
      {accounts.map((a) => {
        const Mark = agentMark(a.agent), on = chosen.includes(a.id), def = on && isDefault(st, a.id);
        return <div key={a.id} data-account={a.id} className={styles.account}>
          <Checkbox checked={on} onChange={(_, d) => w.choose(a.id, !!d.checked)}
            label={<span className={styles.labelled}><Mark />{`${a.name} · ${a.email || a.id}`}</span>} />
          {on && <Tooltip content={def ? 'The default: a new task starts it' : 'Make Default'} relationship="description">
            <ToggleButton size="small" appearance="subtle" checked={def} aria-label="Default" icon={<Star />} onClick={() => w.set({ main: a.id })} /></Tooltip>}
          {def && <Badge appearance="outline" size="small">default</Badge>}
        </div>;
      })}
      {!accounts.length && <Text className={common.muted}>No accounts yet: add one below, or go on without (a task then starts with a terminal).</Text>}
    </div>
    <Text weight="semibold">Add account</Text>
    {signing ? <SignIn agent={signing} onDone={w.signedIn} onClose={() => w.set({ signing: null })} /> : <>
      <div className={styles.wrap}>
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
  const styles = useStyles(), common = useCommonStyles();
  return <div role="group" aria-label="Profiles" className={styles.column}>
    <Text className={common.muted}>The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can approve refunds").
      You sign in to them when the agent asks. None now: the agent makes those it needs.</Text>
    {fresh.map((f, i) => <div key={i} className={styles.row}>
      <Input value={f.name} maxLength={64} placeholder="ann@shop.com" spellCheck={false} aria-label="Name" className={styles.name} onChange={(_, d) => edit(i, { name: d.value })} />
      <Input value={f.description} maxLength={500} placeholder="Who it is in your app" aria-label="Who it is" className={styles.description} onChange={(_, d) => edit(i, { description: d.value })} />
      <Tooltip content="Leave Out" relationship="label"><Button appearance="subtle" icon={<DismissRegular />} onClick={() => w.set({ fresh: fresh.filter((_, j) => j !== i) })} /></Tooltip>
    </div>)}
    <div><Button icon={<AddRegular />} onClick={() => w.set({ fresh: [...fresh, { name: '', description: '' }] })}>Add Profile</Button></div>
    {!!others.length && <>
      <Text weight="semibold" className={styles.heading}>Your profiles</Text>
      {others.map((p) => <div key={p.id} data-profile={p.id}>
        <Checkbox checked={taken.includes(p.id)} onChange={(_, d) => w.set({ taken: d.checked ? [...taken, p.id] : taken.filter((x) => x !== p.id) })}
          label={<span className={styles.labelled}><Avatar size={20} image={{ src: avatarSrc(p.avatar) }} />{p.name}
            <Text size={200} className={common.muted}>{p.description}</Text></span>} />
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
  const nameRef = useRef<HTMLInputElement>(null), styles = useStyles();
  useEffect(() => { void w.reset(); }, [w]);
  useEffect(() => { if (ready) nameRef.current?.focus(); }, [ready]); // the keyboard in its name, once its defaults are there
  if (!ready) return null;
  const last = step === STEPS.length - 1;
  const next = async () => { if (await w.next()) done?.(); };
  return <form aria-label="New Project's steps" className={className} onSubmit={(e) => { e.preventDefault(); void next(); }}>
    {children({
      step, saving,
      steps: <div className={styles.fill}>
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
  const styles = useStyles(), common = useCommonStyles();
  return <ol aria-label="Steps" className={styles.stepNames}>
    {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={styles.stepName}>
      <Badge shape="circular" appearance={i === step ? 'filled' : i < step ? 'tint' : 'outline'} color={i <= step ? 'brand' : 'subtle'}>{i + 1}</Badge>
      <Text weight={i === step ? 'semibold' : 'regular'} className={i === step ? undefined : common.muted}>{s}</Text></li>)}
  </ol>;
}

// The dialog (New Project… in the sidebar), its steps anew each time it opens; a Create under way (a clone takes a
// while) keeps it open, however it would close (Esc, a click outside, ×, Cancel).
export function NewProject() {
  const { open, setOpen } = useCovered('hide');
  const [w, setW] = useState<W | null>(null), styles = useStyles();
  useEffect(() => { registerDialog('newproject', { open: async () => { setW(wizard(false)); setOpen(true); } }); }, [setOpen]);
  return <Dialog open={open && !!w} onOpenChange={(_, d) => { if (!d.open && !w?.store.getState().saving) setOpen(false); }}>
    <DialogSurface aria-label="New Project" className={styles.surface}>
      {w && <Wizard w={w} done={() => setOpen(false)}>{({ step, saving, steps, error, back, go }) =>
        <DialogBody className={styles.body}>
          <DialogTitle action={<DialogTrigger action="close"><Button appearance="subtle" aria-label="Close" icon={<DismissRegular />} disabled={saving} /></DialogTrigger>}>
            New Project
          </DialogTitle>
          <DialogContent className={styles.content}>
            <StepNames step={step} />
            {steps}
            {error}
          </DialogContent>
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
