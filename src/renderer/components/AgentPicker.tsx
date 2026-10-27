// Choosing a task's agent when the one to open is not there or not installed (docs/tasks.md, Choosing the agent): the
// project's accounts and the terminal only, with Install. Asked once the grid it is for is on screen; closed without a
// choice (Cancel, Esc, another task shown), none opens. Also an install's progress, New Project's too (InstallProgress).
import { createElement, useEffect, useState } from 'react';
import { CircleCheckIcon } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FieldDescription, FieldLegend, FieldSet, Label,
  RadioGroup, RadioGroupItem } from '@ui';
import { agentMark } from './AgentMark';
import { agentList, shortPath, useAgentList, type AgentList } from '../lib/agents';
import { whenLeft } from '../lib/grid';
import type { AgentInfo } from '../../shared/types';
import { ErrorBar } from './ErrorBar';
import { Working } from './Working';
import { Details } from './Details';

const list = agentList({ installed: (a) => `${a.name} is installed. Start it; it asks you to sign in.` });
let asking: string | null = null; // the task asked for
let show: ((open: boolean) => void) | null = null; // the dialog's, once mounted

kulisa.on('agent:choose', async ({ task, selected }) => {
  await whenLeft();
  asking = task;
  await list.load(selected ?? undefined, () => show?.(true));
});
const answer = (id: string | null) => { const task = asking; asking = null; kulisa.send('agent:chosen', { task, id }); };

// An install under way or done: a line saying so, the installer's own output under Details (written for programmers:
// opened by itself only when it fails), the error.
export function InstallProgress({ list: l }: { list: AgentList }) {
  const progress = useAgentList(l, (s) => s.progress), log = useAgentList(l, (s) => s.log), error = useAgentList(l, (s) => s.error);
  const details = useAgentList(l, (s) => s.showDetails), open = useAgentList(l, (s) => s.detailsOpen);
  const installing = useAgentList(l, (s) => s.installing);
  if (!progress && !details && !error) return null;
  return <div className="flex flex-col gap-2">
    {progress && (installing ? <Working>{progress}</Working>
      : <Alert><CircleCheckIcon className="text-success" /><AlertDescription>{progress}</AlertDescription></Alert>)}
    {details && <Details open={open} onOpenChange={(o) => l.openDetails(o)}>
      {/* the installer's output as its terminal showed it, a line a line (Settings' AgentPage too) */}
      <div role="log" aria-label="What the installer said" data-selectable className="max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap">
        {log.split('\n').map((line, i) => <div key={i}>{line || ' '}</div>)}
      </div>
    </Details>}
    {error && <ErrorBar>{error}</ErrorBar>}
  </div>;
}

// A row: who makes it and what it needs, whether it is on this computer; one not installed has Install (Kulisa runs its
// maker's installer: the command line is shown, for the chosen one).
function AgentRow({ a, chosen, installing, home }: { a: AgentInfo; chosen: boolean; installing: boolean; home: string | null }) {
  const where = !list.details ? '' : a.account ? `its own sign-in, in ${shortPath(a.account, home)}`
    : a.path ? [a.version, shortPath(a.path, home), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '';
  const installLine = chosen && a.install && !a.installed && !a.account ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '';
  const status = a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed';
  const id = `agent-${a.id}`;
  return <div data-agent={a.id} className="flex items-center gap-3 border-b pb-2 last:border-b-0 last:pb-0">
    <RadioGroupItem id={id} value={a.id} aria-label={a.name} />
    <Label htmlFor={id} className="min-w-0 flex-1 items-start">
      {createElement(agentMark(a.agent || a.id), { className: 'mt-0.5 size-5 shrink-0' })}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{a.account || !a.maker ? a.name : `${a.name} · ${a.maker}`}</span>
        {!a.account && a.needs && <span className="text-xs font-normal text-muted-foreground">{a.needs}</span>}
        {where && <span data-selectable className="font-mono text-xs font-normal break-all text-muted-foreground">{where}</span>}
        {installLine && <span data-selectable className="font-mono text-xs font-normal break-all text-muted-foreground">{installLine}</span>}
      </span>
    </Label>
    {list.details && a.site && !a.account && <Button variant="link" size="sm" asChild><a href={a.site} target="_blank" rel="noreferrer">Website</a></Button>}
    {status && <Badge variant="outline">{status}</Badge>}
    {!a.installed && a.install && !a.account && <Button type="button" variant="outline" size="sm" disabled={installing} onClick={() => void list.install(a.id)}>Install</Button>}
  </div>;
}

export function AgentPicker() {
  const [open, setOpen] = useState(false);
  const agents = useAgentList(list, (s) => s.agents), selected = useAgentList(list, (s) => s.selected);
  const installing = useAgentList(list, (s) => s.installing), looking = useAgentList(list, (s) => s.looking), home = useAgentList(list, (s) => s.home);
  useEffect(() => { show = setOpen; return () => { show = null; }; }, []);
  // However it closed without Start (Cancel, Esc, another task shown: closeLayers' Esc), none opens.
  useEffect(() => { if (!open && asking !== null) answer(null); }, [open]);
  const chosen = agents.find((a) => a.id === selected);
  const start = () => { if (!chosen?.installed) return; answer(chosen.id); setOpen(false); };

  // It waits for an answer: no × and no click outside; Esc is Cancel, as a question's, but not while an install runs.
  return <Dialog open={open} onOpenChange={(o) => { if (!o && installing) return; setOpen(o); }}>
    <DialogContent showCloseButton={false} className="sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>Choose the Agent</DialogTitle></DialogHeader>
      <div className="flex max-h-[60vh] min-h-0 flex-col gap-3 overflow-auto">
        {looking && <Working>Looking for agents on this computer…</Working>}
        <FieldSet>
          <FieldLegend variant="label">Agents</FieldLegend>
          <FieldDescription>It works in a terminal of this task: it writes the code and uses the profiles. If it is not on this computer yet,
            Kulisa installs it with its maker's installer. On its first start it asks you to sign in.</FieldDescription>
          <RadioGroup value={selected ?? ''} disabled={installing} onValueChange={(v) => list.select(v)}>
            {agents.map((a) => <AgentRow key={a.id} a={a} chosen={a.id === selected} installing={installing} home={home} />)}
          </RadioGroup>
        </FieldSet>
        <InstallProgress list={list} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={installing} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={installing || !chosen?.installed} onClick={start}>Start</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
