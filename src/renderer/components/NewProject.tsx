// New Project, step by step (docs/tasks.md, Projects): Code, Agents, Profiles, then Create; its state and rules in
// lib/new-project.ts. A dialog of a tasks' window (New Project…), and the welcome's own (Welcome.tsx: under a question
// each, Back on the first step leaves for the slides before it).
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Avatar, Badge, Button, Checkbox, Dialog, DialogSurface, DialogTitle, Divider, Field, Input, List, ListItem, Tab, TabList, Text, ToggleButton, Tooltip } from '@fluentui/react-components';
import { FolderIcon, FolderPlusIcon, GitBranchIcon, MinusIcon, PlusIcon, StarIcon, XIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { SignIn } from './SignIn';
import { InstallProgress } from './AgentPicker';
import { agentMark } from './AgentMark';
import { avatarSrc } from './avatar';
import { useAgentList } from '../lib/agents';
import { askName, isDefault, STEPS, useWizard, whereOf, wizard, type From, type Wizard as W } from '../lib/new-project';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';

const red = { color: 'var(--colorPaletteRedForeground1)', userSelect: 'text' } as const; // an error: text to copy and search for
const hint = { color: 'var(--colorNeutralForeground3)' };
// A one-line field's label beside it: every kind's form fits the smallest window (640×400) unscrolled, Browse… in sight.
const LABEL_BESIDE = { gridTemplateColumns: '96px minmax(0, 1fr)' };
const KINDS: { value: From; label: string; icon: ReactElement }[] = [{ value: 'new', label: 'New Folder', icon: <FolderPlusIcon /> },
  { value: 'folder', label: 'Folders on Disk', icon: <FolderIcon /> }, { value: 'clone', label: 'Clone from URL', icon: <GitBranchIcon /> }];

// 1. Its code, as JetBrains' New Project: the kinds on the left, the form on the right.
function CodeStep({ w, nameRef }: { w: W; nameRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useWizard(w, (x) => x);
  const [chosen, setChosen] = useState<string>();
  const folder = s.from === 'folder';
  const rows = folder ? s.sources : s.urls.map((u) => ({ folder: u, state: '' }));
  const remove = () => { w.removeSource(chosen); setChosen(undefined); };
  const where = whereOf(s, w.single);
  return <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
    <TabList vertical aria-label="Start from" selectedValue={s.from} onTabSelect={(_, d) => w.change({ from: d.value as From })}
      style={{ flex: 'none', width: 180, padding: 8 }}>
      {KINDS.map((k) => <Tab key={k.value} value={k.value} icon={k.icon}>{k.label}</Tab>)}
    </TabList>
    <Divider vertical style={{ flex: 'none' }} />
    <div style={{ flex: 1, minWidth: 0, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* One folder or URL (the welcome's): taken as it is left, or at Next */}
      {s.from !== 'new' && w.single && <Field label={folder ? 'Folder' : 'URL'}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={s.typed} spellCheck={false} style={{ flex: 1 }} placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'}
            onChange={(_, d) => w.set({ typed: d.value, error: '' })} onBlur={() => void w.addSource()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
          {folder && <Button onClick={() => void w.browse(true)}>Browse…</Button>}
        </div>
      </Field>}
      {/* Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list, under
          it once there is one. Its label is for the field (htmlFor): Field otherwise names the field by it over the
          field's own aria-label. */}
      {s.from !== 'new' && !w.single && <Field label={{ children: folder ? 'Folders' : 'URLs', htmlFor: 'npsource' }}>
        <div role="group" aria-label={folder ? 'Folders' : 'URLs'} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input id="npsource" value={s.typed} spellCheck={false} aria-label={folder ? 'A folder' : 'A repository URL'} style={{ flex: 1, minWidth: 0 }}
              placeholder={folder ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'} onChange={(_, d) => w.set({ typed: d.value, error: '' })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void w.addSource(); } }} />
            <Button onClick={() => void w.addSource()}>Add</Button>
            {folder && <Tooltip content="Add Folder…" relationship="label"><Button icon={<PlusIcon />} onClick={() => void w.browse(true)} /></Tooltip>}
            <Tooltip content="Leave Out" relationship="label"><Button icon={<MinusIcon />} disabledFocusable={!chosen} onClick={remove} /></Tooltip>
          </div>
          {rows.length > 0 && <List aria-label={folder ? 'Folders' : 'URLs'} navigationMode="items" selectionMode="single"
            selectedItems={chosen ? [chosen] : []} onSelectionChange={(_, d) => setChosen(d.selectedItems[0] as string | undefined)}
            onKeyDown={(e) => { if (e.key === 'Delete') remove(); }}
            style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--colorNeutralStroke1)', borderRadius: 'var(--borderRadiusMedium)' }}>
            {rows.map((x, i) => <ListItem key={x.folder} value={x.folder} data-source={x.folder} aria-label={x.folder} checkmark={null}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
              <Text truncate wrap={false} title={x.folder} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{x.folder}</Text>
              {x.state && <Badge appearance="outline" size="small">{x.state === 'repo' ? 'git' : 'no git'}</Badge>}
              {!i && rows.length > 1 && <Badge appearance="outline" size="small">default</Badge>}
            </ListItem>)}
          </List>}
        </div>
      </Field>}
      {askName(s, w.single) && <Field orientation="horizontal" style={LABEL_BESIDE} label={w.single ? 'Project name' : 'Name'}>
        <Input input={{ ref: nameRef }} value={s.name} maxLength={64} placeholder="e.g. tenant-audit" spellCheck={false}
          onChange={(_, d) => w.change({ name: d.value })} />
      </Field>}
      {!folder && <Field orientation="horizontal" style={LABEL_BESIDE} label="Location">
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={s.place} spellCheck={false} style={{ flex: 1, minWidth: 0 }} onChange={(_, d) => w.change({ place: d.value })} />
          <Button onClick={() => void w.browse()}>Browse…</Button>
        </div>
      </Field>}
      {where && <Text role="status" aria-label="What will happen" style={hint}>{where}</Text>}
      {w.single && s.from !== 'new' && <Text style={hint}>A frontend and a backend? Add the other {folder ? 'folder' : 'repository'} later in Settings.</Text>}
    </div>
  </div>;
}

// 2. Its agents: the accounts there are first, then a new one of Claude Code or Codex.
function AgentStep({ w }: { w: W }) {
  const { accounts, chosen, main, signing, clis } = useWizard(w, useShallow((s) => ({ accounts: s.accounts, chosen: s.chosen, main: s.main, signing: s.signing, clis: s.clis })));
  const agents = useAgentList(w.installs, (s) => s.agents), installing = useAgentList(w.installs, (s) => s.installing);
  const addable = agents.filter((a) => clis.includes(a.id));
  const st = { chosen, main } as Parameters<typeof isDefault>[0];
  return <div style={{ flex: 1, minWidth: 0, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Text style={hint}>Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the default one; the others
      open beside it). Change it any time in Settings.</Text>
    <div role="group" aria-label="Accounts" style={{ display: 'flex', flexDirection: 'column' }}>
      {accounts.map((a) => {
        const Mark = agentMark(a.agent), on = chosen.includes(a.id), def = on && isDefault(st, a.id);
        return <div key={a.id} data-account={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
          <Checkbox checked={on} onChange={(_, d) => w.choose(a.id, !!d.checked)}
            label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mark />{`${a.name} · ${a.email || a.id}`}</span>} />
          {on && <Tooltip content={def ? 'The default: a new task starts it' : 'Make Default'} relationship="description">
            <ToggleButton size="small" appearance="subtle" checked={def} aria-label="Default" icon={<StarIcon />} onClick={() => w.set({ main: a.id })} /></Tooltip>}
          {def && <Badge appearance="outline" size="small">default</Badge>}
        </div>;
      })}
      {!accounts.length && <Text style={hint}>No accounts yet: add one below, or go on without (a task then starts with a terminal).</Text>}
    </div>
    <Text weight="semibold">Add account</Text>
    {signing ? <SignIn agent={signing} onDone={w.signedIn} onClose={() => w.set({ signing: null })} /> : <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {addable.map((a) => { const Mark = agentMark(a.id); return <Button key={a.id} data-add={a.id} icon={<Mark />} disabled={installing || (!a.installed && !a.install)}
          title={a.installed ? `Sign in to an account of ${a.name}` : `${a.name} is installed first (its maker's installer), then you sign in`}
          onClick={() => void w.addAccount(a)}>{a.name}</Button>; })}
      </div>
      <InstallProgress list={w.installs} />
    </>}
  </div>;
}

// 3. Its profiles: new ones (a name, who it is) and any of those there are already.
function ProfilesStep({ w }: { w: W }) {
  const { fresh, others, taken } = useWizard(w, useShallow((s) => ({ fresh: s.fresh, others: s.others, taken: s.taken })));
  const edit = (i: number, c: Partial<{ name: string; description: string }>) => w.set({ fresh: fresh.map((f, j) => (j === i ? { ...f, ...c } : f)) });
  return <div role="group" aria-label="Profiles" style={{ flex: 1, minWidth: 0, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Text style={hint}>The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can approve refunds").
      You sign in to them when the agent asks. None now: the agent makes those it needs.</Text>
    {fresh.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8 }}>
      <Input value={f.name} maxLength={64} placeholder="ann@shop.com" spellCheck={false} aria-label="Name" style={{ flex: '0 1 200px' }} onChange={(_, d) => edit(i, { name: d.value })} />
      <Input value={f.description} maxLength={500} placeholder="Who it is in your app" aria-label="Who it is" style={{ flex: 1 }} onChange={(_, d) => edit(i, { description: d.value })} />
      <Tooltip content="Leave Out" relationship="label"><Button appearance="subtle" icon={<XIcon />} onClick={() => w.set({ fresh: fresh.filter((_, j) => j !== i) })} /></Tooltip>
    </div>)}
    <div><Button icon={<PlusIcon />} onClick={() => w.set({ fresh: [...fresh, { name: '', description: '' }] })}>Add Profile</Button></div>
    {!!others.length && <>
      <Text weight="semibold" style={{ marginTop: 8 }}>Your profiles</Text>
      {others.map((p) => <div key={p.id} data-profile={p.id}>
        <Checkbox checked={taken.includes(p.id)} onChange={(_, d) => w.set({ taken: d.checked ? [...taken, p.id] : taken.filter((x) => x !== p.id) })}
          label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar size={20} image={{ src: avatarSrc(p.avatar) }} />{p.name}
            <Text size={200} style={hint}>{p.description}</Text></span>} />
      </div>)}
    </>}
  </div>;
}

// The steps and their buttons, of a wizard made as they are shown (w). head: what is over them (the welcome's question);
// else the steps' names, the shown one marked. leave: Back on the first step (the welcome's); cancel: the dialog's.
export function Wizard({ w, head, leave, cancel, done }: { w: W; head?: (step: number) => ReactNode; leave?: () => void; cancel?: () => void; done?: () => void }) {
  const { ready, step, saving, error, from } = useWizard(w, useShallow((s) => ({ ready: s.ready, step: s.step, saving: s.saving, error: s.error, from: s.from })));
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void w.reset(); }, [w]);
  useEffect(() => { if (ready) nameRef.current?.focus(); }, [ready]); // the keyboard in its name, once its defaults are there
  if (!ready) return null;
  const last = step === STEPS.length - 1;
  const next = async () => { if (await w.next()) done?.(); };
  return <form aria-label="New Project's steps" onSubmit={(e) => { e.preventDefault(); void next(); }}
    style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    {head ? head(step) : <><ol aria-label="Steps" style={{ display: 'flex', gap: 24, margin: 0, padding: '8px 16px', listStyle: 'none' }}>
      {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Badge shape="circular" appearance={i === step ? 'filled' : i < step ? 'tint' : 'outline'} color={i <= step ? 'brand' : 'subtle'}>{i + 1}</Badge>
        <Text weight={i === step ? 'semibold' : 'regular'} style={i === step ? undefined : hint}>{s}</Text></li>)}
    </ol><Divider style={{ flex: 'none' }} /></>}
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {step === 0 && <CodeStep w={w} nameRef={nameRef} />}
      {step === 1 && <AgentStep w={w} />}
      {step === 2 && <ProfilesStep w={w} />}
    </div>
    {error && <Text role="alert" style={{ ...red, margin: '0 16px 8px' }}>{error}</Text>}
    <Divider style={{ flex: 'none' }} />
    <div style={{ display: 'flex', gap: 8, padding: 16 }}>
      {(step > 0 || leave) && <Button onClick={() => (step ? w.back() : leave?.())}>Back</Button>}
      <span style={{ flex: 1 }} />
      {cancel && <Button disabled={saving} onClick={cancel}>Cancel</Button>}
      <Button type="submit" appearance="primary" disabled={saving}>{saving ? (from === 'clone' ? 'Cloning…' : 'Creating…') : last ? 'Create' : 'Next'}</Button>
    </div>
  </form>;
}

// The dialog (New Project… in the sidebar), its steps anew each time it opens; a Create under way (a clone takes a
// while) keeps it open.
export function NewProject() {
  const { open, setOpen } = useCovered('hide');
  const [w, setW] = useState<W | null>(null);
  useEffect(() => { registerDialog('newproject', { open: async () => { setW(wizard(false)); setOpen(true); } }); }, [setOpen]);
  return <Dialog open={open && !!w} onOpenChange={(_, d) => { if (!d.open) setOpen(false); }}>
    <DialogSurface aria-label="New Project" style={{ width: 'min(760px, 92vw)', maxWidth: 'none', padding: 0, display: 'flex' }}>
      {w && <Body w={w} close={() => setOpen(false)} />}
    </DialogSurface>
  </Dialog>;
}
function Body({ w, close }: { w: W; close: () => void }) {
  const saving = useWizard(w, (s) => s.saving);
  const leave = () => { if (!saving) close(); };
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'min(480px, 85vh)', maxHeight: '90vh' }}
    onKeyDown={(e) => { if (e.key === 'Escape' && saving) e.preventDefault(); }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 4px 16px' }}>
      <DialogTitle style={{ flex: 1 }}>New Project</DialogTitle>
      <Button appearance="subtle" aria-label="Close" icon={<XIcon />} disabled={saving} onClick={leave} />
    </div>
    <Wizard w={w} cancel={leave} done={close} />
  </div>;
}
