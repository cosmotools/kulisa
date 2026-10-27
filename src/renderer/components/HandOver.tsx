// Change Agent: the task handed to another agent (docs/tasks.md, Several agents in a task). What goes along is shown
// between the two, and how far the new one has read the conversation (task_history: handover:read, its real progress);
// its tab, in front under the dialog, is shown once it has read it all, or at once when it needs the human or stops
// reading: a dialog that never waits for an agent waiting for the human. Show now any time.
import { createElement, useEffect, type ReactElement } from 'react';
import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { AvatarGroup, AvatarGroupItem, Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, List, ListItem,
  MessageBar, MessageBarBody, ProgressBar, Radio, RadioGroup, Tag, Text, tokens } from '@fluentui/react-components';
import { BookOpenTextIcon, GitBranchIcon, GlobeIcon, SquareTerminalIcon, XIcon } from 'lucide-react';
import { agentMark } from './AgentMark';
import { act, shownTask, store, useWindow } from '../lib/store';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';
import { plural } from '../lib/common';
import { avatarSrc } from './avatar';
import { refused } from '../../shared/result';
import type { Terminal } from '../../shared/types';

// No part read for this long: an agent that thinks before it reads, or never does.
const IDLE = 30_000;
interface HandOverState {
  from: Terminal | null; chosen: string | undefined; going: boolean; error: string;
  handed: number | null; // the new agent's tab once open
  read: { part: number; parts: number } | null; // what it has read
}
const state = createStore<HandOverState>()(() => ({ from: null, chosen: undefined, going: false, error: '', handed: null, read: null }));
let inTask: string | null = null, idle = 0, close = () => {};
let seen = false; // its tab has been in the window's list

const agentsOf = (s = store.getState()) => (s.projects.open.find((o) => o.id === s.projects.project)?.agents || []).filter((a) => a.cli !== 'shell');
// "Claude Code · me@x.com": the agent, then its account.
const parts = (name: string) => { const [agent = '', ...account] = name.split(' · '); return { agent, account: account.join(' · ') }; };

async function hand() {
  const { from, chosen, going } = state.getState();
  if (!from || !chosen || going) return;
  state.setState({ going: true });
  inTask = store.getState().current;
  const r = await act('agent:hand-over', { id: from.id, agent: chosen });
  if (!state.getState().going) return; // closed meanwhile: the tab is there, behind
  if (refused(r)) { state.setState({ going: false, error: r.error || 'The agent did not start.' }); return; }
  seen = false;
  state.setState({ handed: r.id });
  waitIdle();
}
const waitIdle = () => { clearTimeout(idle); idle = window.setTimeout(show, IDLE); };
// Its tab shown (in front again, if the human chose another meanwhile), the dialog closed: once it has read it all, or
// the human does not wait (Show now, ×).
function show() {
  clearTimeout(idle);
  const { handed } = state.getState();
  if (handed !== null && store.getState().current === inTask) void act('terminal:show', { id: handed });
  state.setState({ handed: null, going: false });
  close();
}
kulisa.on('handover:read', ({ task, id, part, parts: all }) => {
  if (task !== inTask || id !== state.getState().handed) return;
  state.setState({ read: { part, parts: all } });
  if (part >= all) show(); else waitIdle();
});
// It needs the human (a permission, a sign-in, a limit: its hooks say it waits), or its tab is gone (once it was there:
// the window may hear of it after the answer).
store.subscribe((s) => {
  const { handed } = state.getState();
  if (handed === null) return;
  const t = s.terminals.list.find((x) => x.id === handed);
  if (t) seen = true;
  if (t?.state === 'waiting' || (!t && seen && s.current === inTask)) show();
});

// One of the two agents: its mark, its name and account, the conversation.
function Side({ cli, name, conv }: { cli?: string; name?: string; conv: string }) {
  const p = parts(name ?? '');
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, textAlign: 'center' }}>
    <span style={{ fontSize: 40, height: 40, marginBottom: 6, display: 'flex' }}>{cli && createElement(agentMark(cli))}</span>
    <Text weight="semibold">{p.agent}</Text>
    <Text size={200} truncate wrap={false} style={{ maxWidth: '100%', color: tokens.colorNeutralForeground3 }}>{p.account}</Text>
    <Text size={200} truncate wrap={false} style={{ maxWidth: '100%', color: tokens.colorNeutralForeground3 }}>{conv}</Text>
  </div>;
}

export function HandOver() {
  const { open, setOpen } = useCovered('hide');
  const { from, chosen, going, error, read } = useStore(state);
  const agents = useWindow(useShallow((s) => agentsOf(s))), profiles = useWindow((s) => s.profiles);
  const branch = useWindow((s) => shownTask(s)?.branch), shells = useWindow((s) => s.terminals.list).filter((t) => !t.agent);
  useEffect(() => {
    close = () => setOpen(false);
    registerDialog('handover', {
      async open(t) {
        // Another agent first (the reason to hand over is most often this one's limit), else another account, else the same.
        const list = agentsOf(), cli = t.agent!.cli;
        const pick = (list.find((a) => a.cli !== cli) || list.find((a) => a.id !== t.agent!.account) || list[0])?.id;
        state.setState({ from: t, chosen: pick, going: false, handed: null, read: null, error: '' });
        setOpen(true);
      },
    });
  }, [setOpen]);
  const to = agents.find((a) => a.id === chosen), tabs = profiles.reduce((n, p) => n + p.tabs.length, 0);
  const progress = !going || !to ? '' : read ? `${parts(to.name).agent} is reading “${from?.name}”: part ${read.part} of ${read.parts}` : `${parts(to.name).agent} is starting…`;
  const onClose = () => { if (state.getState().going) show(); else setOpen(false); };
  const along = (icon: ReactElement, text: string, title?: string) => <ListItem><Tag size="small" appearance="outline" media={icon} title={title}>{text}</Tag></ListItem>;
  return <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
    <DialogSurface aria-label="Change Agent" style={{ maxWidth: 640 }}>
      <DialogBody>
        <DialogTitle action={<Button appearance="subtle" aria-label="Close" icon={<XIcon />} onClick={onClose} />}>Change Agent</DialogTitle>
        <DialogContent>
          {from?.agent && <Card appearance="filled-alternative" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
            marginBottom: tokens.spacingVerticalL }}>
            <Side cli={from.agent.cli} name={from.agent.name} conv={`“${from.name}”`} />
            <List aria-label="Goes along" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              {branch && along(<GitBranchIcon />, branch, `branch ${branch}`)}
              {profiles.length > 0 && along(<AvatarGroup size={16} layout="stack">{profiles.map((p) => <AvatarGroupItem key={p.id} name={p.name} image={{ src: avatarSrc(p.avatar) }} />)}</AvatarGroup>,
                `${plural(profiles.length, 'profile')}, signed in`)}
              {tabs > 0 && along(<GlobeIcon />, plural(tabs, 'tab'))}
              {shells.length > 0 && along(<SquareTerminalIcon />, `${shells.length === 1 ? shells[0]!.name : plural(shells.length, 'terminal')}, running`)}
              {along(<BookOpenTextIcon />, 'the whole conversation')}
            </List>
            <Side cli={to?.cli} name={to?.name} conv="a new tab" />
          </Card>}
          <Field hint={going ? undefined : `It reads this conversation first, then tells you in a few lines what is done and what is next. Its own hidden
            reasoning, permissions given and its account's settings stay behind. This tab stays until you close it.`}>
            <RadioGroup aria-label="Agent" value={chosen ?? ''} disabled={going} onChange={(_, d) => state.setState({ chosen: d.value })}>
              {agents.map((a) => { const Mark = agentMark(a.cli); return <div key={a.id} data-agent={a.id} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <Radio value={a.id} label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mark />{a.name}</span>} />
                {a.id === from?.agent?.account && <Text size={200} style={{ marginInlineStart: 'auto', color: tokens.colorNeutralForeground3 }}>this one, afresh</Text>}
              </div>; })}
            </RadioGroup>
          </Field>
          {going && <Field validationMessage={{ children: progress, role: 'status' }} validationState="none" style={{ marginTop: tokens.spacingVerticalM }}>
            <ProgressBar value={read ? read.part / read.parts : undefined} />
          </Field>}
          {error && <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalM }}><MessageBarBody style={{ userSelect: 'text' }}>{error}</MessageBarBody></MessageBar>}
        </DialogContent>
        <DialogActions>
          {going ? <Button appearance="primary" onClick={show}>Show now</Button> : <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!chosen} onClick={() => void hand()}>Hand over</Button>
          </>}
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
