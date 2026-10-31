// Change Agent: the task handed to another agent (docs/tasks.md, Several agents in a task). What goes along is shown
// between the two, and how far the new one has read the conversation (task_history: handover:read, its real progress);
// its tab, in front under the dialog, is shown once it has read it all, or at once when it needs the human or stops
// reading: a dialog that never waits for an agent waiting for the human. Show now any time.
import { createElement, useEffect, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { BookOpenIcon, GitBranchIcon, GlobeIcon, SquareTerminalIcon, CircleAlertIcon } from 'lucide-react';
import { Avatar, AvatarGroup, AvatarImage, Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldContent,
  FieldDescription, FieldLabel, FieldTitle, Progress, RadioGroup, RadioGroupItem, Spinner, Alert, AlertDescription } from '@ui';
import { agentMark } from './AgentMark';
import { act, shownTask, store, useWindow } from '../lib/store';
import { registerDialog } from '../lib/dialogs';
import { avatarSrc, plural } from '../lib/common';
import { refused } from '../../shared/result';
import type { DevelopmentTerminalInfo } from '../../shared/types';

// No part read for this long: an agent that thinks before it reads, or never does.
const IDLE = 30_000;
interface HandOverState {
  from: DevelopmentTerminalInfo | null; chosen: string | undefined; going: boolean; error: string;
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
  if (handed !== null && store.getState().current === inTask) void act('development-terminal:show', { id: handed });
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
  const t = s.developmentTerminals.list.find((x) => x.id === handed);
  if (t) seen = true;
  if (t?.state === 'waiting' || (!t && seen && s.current === inTask)) show();
});


export function HandOver() {
  const [open, setOpen] = useState(false);
  const { from, chosen, going, error, read } = useStore(state);
  const agents = useWindow(useShallow((s) => agentsOf(s))), profiles = useWindow((s) => s.profiles);
  const branch = useWindow((s) => shownTask(s)?.branch), shells = useWindow((s) => s.developmentTerminals.list).filter((t) => !t.agent);
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
  }, []);
  const to = agents.find((a) => a.id === chosen), tabs = profiles.reduce((n, p) => n + p.tabs.length, 0);
  const progress = !going || !to ? '' : read ? `${parts(to.name).agent} is reading “${from?.name}”: part ${read.part} of ${read.parts}` : `${parts(to.name).agent} is starting…`;
  const onClose = () => { if (state.getState().going) show(); else setOpen(false); };
  return <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Change Agent</DialogTitle></DialogHeader>
      <div className="flex max-h-[60vh] min-h-0 flex-col gap-4 overflow-auto">
        {from?.agent && <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-lg bg-muted p-3">
          {/* one of the two agents: its mark, its name and account, the conversation */}
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="mb-1.5 flex size-10">{from.agent.cli && createElement(agentMark(from.agent.cli), { className: 'size-10' })}</span>
            <span className="font-medium">{parts(from.agent.name ?? '').agent}</span>
            <span className="max-w-full truncate text-xs text-muted-foreground">{parts(from.agent.name ?? '').account}</span>
            <span className="max-w-full truncate text-xs text-muted-foreground">“{from.name}”</span>
          </div>
          <div role="list" aria-label="Goes along" className="flex flex-col items-center gap-1">
            {branch && <div role="listitem"><Badge variant="outline" title={`branch ${branch}`}><GitBranchIcon />{branch}</Badge></div>}
            {profiles.length > 0 && <div role="listitem"><Badge variant="outline"><AvatarGroup>{profiles.map((p) => <Avatar key={p.id} className="size-3"><AvatarImage src={avatarSrc(p.avatar)} alt={p.name} /></Avatar>)}</AvatarGroup>
              {`${plural(profiles.length, 'profile')}, signed in`}</Badge></div>}
            {tabs > 0 && <div role="listitem"><Badge variant="outline"><GlobeIcon />{plural(tabs, 'tab')}</Badge></div>}
            {shells.length > 0 && <div role="listitem"><Badge variant="outline"><SquareTerminalIcon />{`${shells.length === 1 ? shells[0]!.name : plural(shells.length, 'terminal')}, running`}</Badge></div>}
            <div role="listitem"><Badge variant="outline"><BookOpenIcon />the whole conversation</Badge></div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="mb-1.5 flex size-10">{to?.cli && createElement(agentMark(to?.cli), { className: 'size-10' })}</span>
            <span className="font-medium">{parts(to?.name ?? '').agent}</span>
            <span className="max-w-full truncate text-xs text-muted-foreground">{parts(to?.name ?? '').account}</span>
            <span className="max-w-full truncate text-xs text-muted-foreground">a new tab</span>
          </div>
        </div>}
        <div className="flex flex-col gap-2">
          <RadioGroup aria-label="Agent" value={chosen ?? ''} disabled={going} onValueChange={(v) => state.setState({ chosen: v })}>
            {agents.map((a) => <FieldLabel key={a.id} htmlFor={`handover-${a.id}`} data-agent={a.id}>
              <Field orientation="horizontal">
                <RadioGroupItem id={`handover-${a.id}`} value={a.id} aria-label={a.name} />
                <FieldContent>
                  <FieldTitle>{createElement(agentMark(a.cli), { className: 'size-4' })}{a.name}</FieldTitle>
                  {a.id === from?.agent?.account && <FieldDescription>this one, afresh</FieldDescription>}
                </FieldContent>
              </Field>
            </FieldLabel>)}
          </RadioGroup>
          {!going && <FieldDescription>It reads this conversation first, then tells you in a few lines what is done and what is next. Its own hidden
            reasoning, permissions given and its account's settings stay behind. This tab stays until you close it.</FieldDescription>}
        </div>
        {/* how far it has read; before its first part, how long is not known */}
        {going && (read ? <div className="flex flex-col gap-1.5">
          <Progress value={(100 * read.part) / read.parts} aria-label="Read" />
          <p role="status" className="text-muted-foreground">{progress}</p>
        </div> : <div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner role={undefined} aria-hidden />{progress}</div>)}
        {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>}
      </div>
      <DialogFooter>
        {going ? <Button onClick={show}>Show now</Button> : <>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!chosen} onClick={() => void hand()}>Hand over</Button>
        </>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
