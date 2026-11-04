// Shared New Project sequence (docs/tasks.md, Projects). Owns step navigation and focus; the draft owns
// validation/submission. The bounded body scrolls independently so actions remain reachable in short windows.
import { useEffect, useRef } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CircleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Spinner } from '@ui';
import { AgentsStep } from './AgentsStep';
import { CodeStep } from './CodeStep';
import { FinishStep } from './FinishStep';
import { useAgentList } from '../../../agent-management/renderer';
import { refusalOf, useProjectDraft, type ProjectDraft } from './draft';

const steps = [
  { id: 'agents', label: 'Agents', title: 'Choose your agent', detail: 'Start with one agent. Use an existing setup or connect a new account.' },
  { id: 'code', label: 'Code', title: 'Where shall we start?', detail: 'Bring existing code or make room for a new idea.' },
  { id: 'finish', label: 'Start', title: 'Make it your project', detail: 'A few details, then you and your agent are ready to work.' },
] as const;
export function ProjectFlow({ draft: d, back, done }: { draft: ProjectDraft; back?: () => void; done?: () => void }) {
  const s = useProjectDraft(d, (x) => x), heading = useRef<HTMLHeadingElement>(null), body = useRef<HTMLDivElement>(null);
  const installing = useAgentList(d.installs, (x) => x.installing), current = steps.findIndex((x) => x.id === s.step), step = steps[current]!;
  const busy = s.saving || s.checking || s.connecting || installing, error = s.error || (s.step === 'code' ? refusalOf(s) : '');
  useEffect(() => { void d.reset(); }, [d]);
  useEffect(() => { if (s.ready) { heading.current?.focus(); body.current?.scrollTo(0, 0); } }, [s.step, s.ready]);
  return <form aria-label="New Project" className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={(e) => {
    e.preventDefault(); if (busy) return;
    if (s.step === 'finish') void d.create().then((created) => { if (created) done?.(); }); else void d.next();
  }}>
    <ol aria-label="Project setup steps" className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
      {steps.map((item, index) => <li key={item.id} aria-current={index === current ? 'step' : undefined} className="flex items-center gap-2 aria-current:font-medium aria-current:text-foreground">
        <span className="flex size-6 items-center justify-center rounded-full border">{index < current ? <CheckIcon className="size-3.5" /> : index + 1}</span>{item.label}
        {index < steps.length - 1 && <span aria-hidden className="ms-1 h-px w-6 bg-border sm:w-12" />}
      </li>)}
    </ol>
    <div ref={body} className="min-h-0 flex-1 overflow-auto p-1">
      <div className="mb-5"><h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p></div>
      {!s.ready ? <p role="status" className="flex items-center gap-2 p-4"><Spinner />Preparing your project…</p> : <fieldset disabled={s.saving || s.checking} className="min-w-0">
        {s.step === 'agents' ? <AgentsStep draft={d} /> : s.step === 'code' ? <CodeStep draft={d} /> : <FinishStep draft={d} />}
      </fieldset>}
      {error && <Alert variant="destructive" className="mt-4"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>}
    </div>
    <div className="flex shrink-0 items-center justify-between gap-3 border-t pt-4">
      <div>{(current > 0 || back) && <Button type="button" variant="ghost" disabled={busy} onClick={current ? d.back : back}><ArrowLeftIcon />Back</Button>}</div>
      <Button type="submit" size="lg" disabled={!s.ready || busy || (s.step === 'agents' && !s.selected)}>
        {busy && !s.connecting && <Spinner />}{s.saving ? s.from === 'clone' ? 'Cloning…' : 'Creating…' : s.step === 'finish' ? 'Create project' : 'Continue'}{!busy && <ArrowRightIcon />}
      </Button>
    </div>
  </form>;
}
