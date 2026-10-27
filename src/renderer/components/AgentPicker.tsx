// Choosing a task's agent when the one to open is not there or not installed (docs/tasks.md, Choosing the agent): the
// project's accounts and the terminal only, with Install. Asked once the grid it is for is on screen; closed without a
// choice (Cancel, another task shown), none opens. Also an install's progress, New Project's too (InstallProgress).
import { createElement, Fragment, useEffect } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Divider, Field,
  Link, MessageBar, MessageBarBody, Radio, RadioGroup, Spinner, Text } from '@fluentui/react-components';
import { agentMark } from './AgentMark';
import { agentList, shortPath, useAgentList, type AgentList } from '../lib/agents';
import { useCovered } from '../lib/cover';
import { whenLeft } from '../lib/grid';
import type { AgentInfo } from '../../shared/types';

const copyable = { overflowWrap: 'anywhere', userSelect: 'text' } as const; // paths and commands: text to copy

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
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {progress && <Text role="status">{progress}</Text>}
    {details && <Accordion collapsible openItems={open ? ['log'] : []} onToggle={(_, d) => l.openDetails(d.openItems.includes('log'))}>
      <AccordionItem value="log">
        <AccordionHeader size="small">Details</AccordionHeader>
        <AccordionPanel><Text as="pre" font="monospace" size={200} block style={{ ...copyable, maxHeight: 180, overflow: 'auto', margin: 0, padding: 8, whiteSpace: 'pre-wrap',
          background: 'var(--colorNeutralBackground3)', borderRadius: 'var(--borderRadiusMedium)' }}>{log}</Text></AccordionPanel>
      </AccordionItem>
    </Accordion>}
    {error && <MessageBar intent="error"><MessageBarBody style={{ userSelect: 'text' }}>{error}</MessageBarBody></MessageBar>}
  </div>;
}

// A row: who makes it and what it needs, whether it is on this computer; one not installed has Install (Kulisa runs its
// maker's installer: the command line is shown, for the chosen one).
function AgentRow({ a, chosen, installing, home }: { a: AgentInfo; chosen: boolean; installing: boolean; home: string | null }) {
  const where = !list.details ? '' : a.account ? `its own sign-in, in ${shortPath(a.account, home)}`
    : a.path ? [a.version, shortPath(a.path, home), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '';
  const installLine = chosen && a.install && !a.installed && !a.account ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '';
  const status = a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed';
  return <div data-agent={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
    <Radio value={a.id} aria-label={a.name} label={<span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {createElement(agentMark(a.agent || a.id), { style: { width: 20, height: 20, marginTop: 1 } })}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <Text weight="semibold">{a.account || !a.maker ? a.name : `${a.name} · ${a.maker}`}</Text>
        {!a.account && a.needs && <Text size={200}>{a.needs}</Text>}
        {where && <Text size={200} font="monospace" style={copyable}>{where}</Text>}
        {installLine && <Text size={200} font="monospace" style={copyable}>{installLine}</Text>}
      </span>
    </span>} style={{ flex: 1, minWidth: 0 }} />
    {list.details && a.site && !a.account && <Link href={a.site} target="_blank">Website</Link>}
    {status && <Badge appearance="outline">{status}</Badge>}
    {!a.installed && a.install && !a.account && <Button size="small" disabled={installing} onClick={() => void list.install(a.id)}>Install</Button>}
  </div>;
}

export function AgentPicker() {
  const { open, setOpen } = useCovered('hide');
  const agents = useAgentList(list, (s) => s.agents), selected = useAgentList(list, (s) => s.selected);
  const installing = useAgentList(list, (s) => s.installing), looking = useAgentList(list, (s) => s.looking), home = useAgentList(list, (s) => s.home);
  useEffect(() => { show = setOpen; return () => { show = null; }; }, [setOpen]);
  // However it closed without Start (Cancel, another task shown: closeLayers), none opens.
  useEffect(() => { if (!open && asking !== null) answer(null); }, [open]);
  const chosen = agents.find((a) => a.id === selected);
  const start = () => { if (!chosen?.installed) return; answer(chosen.id); setOpen(false); };

  // It waits for an answer: no ×, Esc or click outside.
  return <Dialog open={open} onOpenChange={() => {}}>
    <DialogSurface style={{ width: 640, maxWidth: '92vw' }}>
      <DialogBody>
        <DialogTitle>Choose the Agent</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {looking && <Spinner size="tiny" label="Looking for agents on this computer…" style={{ justifyContent: 'flex-start' }} />}
          <Field label="Agents" hint="It works in a terminal of this task: it writes the code and uses the profiles. If it is not on this computer yet,
            Kulisa installs it with its maker's installer. On its first start it asks you to sign in.">
            <RadioGroup value={selected ?? ''} disabled={installing} onChange={(_, d) => list.select(d.value)} style={{ display: 'flex', flexDirection: 'column' }}>
              {agents.map((a, i) => <Fragment key={a.id}>{i > 0 && <Divider />}<AgentRow a={a} chosen={a.id === selected} installing={installing} home={home} /></Fragment>)}
            </RadioGroup>
          </Field>
          <InstallProgress list={list} />
        </DialogContent>
        <DialogActions>
          <Button disabled={installing} onClick={() => setOpen(false)}>Cancel</Button>
          <Button appearance="primary" disabled={installing || !chosen?.installed} onClick={start}>Start</Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
