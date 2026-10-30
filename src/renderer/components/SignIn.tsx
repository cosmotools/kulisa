// A new account of an agent, signed in with the agent's own sign-in, started as it is shown (docs/tasks.md, Accounts):
// in a project (project) or in none. Its terminal is under Details: the address it prints, with the sign-in page open
// in the browser, only confuses; it is there for a failure (opened by itself then) and for what the browser does not
// show (a code the agent asks for). Gone (Cancel, its page left), the sign-in is cancelled.
import { useEffect, useEffectEvent, useState } from 'react';
import { CircleAlertIcon, ChevronRightIcon } from 'lucide-react';
import { Button, Spinner, Alert, AlertDescription, AlertAction, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@ui';
import { forgetTerminals } from '../../terminal/renderer';
import { Terminal } from './Terminal';
import type { SignedIn as Answer } from '../../shared/types';

let n = 0;
const fresh = () => `signin#${Date.now()}-${++n}`; // a sign-in's terminal: a new one for each try

export function SignIn({ agent, project, onDone, onClose }: { agent: { id: string; name: string }; project?: string; onDone: (r: Answer) => void; onClose: () => void }) {
  // key: its terminal, kept after its sign-in ends (a failure's Details show what the agent said); a new one on Try Again
  const [key, setKey] = useState(fresh), [running, setRunning] = useState(true);
  const [error, setError] = useState(''), [details, setDetails] = useState(false);
  const done = useEffectEvent((r: Answer) => onDone(r));
  // A sign-in, its terminal shown; cancelled when it goes (Cancel, its page left) while it runs, its terminal forgotten.
  useEffect(() => {
    let on = true;
    void kulisa.invoke('account:signin', { id: project ?? null, agent: agent.id, key }).then((r) => {
      if (!on) return;
      on = false;
      setRunning(false);
      if (r.error) { setError(r.error); setDetails(true); } else if (r.error === undefined) done(r);
    });
    return () => {
      if (on) { on = false; void kulisa.invoke('account:signin-cancel', { key }); }
      forgetTerminals([key]);
    };
  }, [key, agent.id, project]);

  const again = () => { setKey(fresh()); setRunning(true); setError(''); setDetails(false); };
  return <div role="group" aria-label={`New account of ${agent.name}`} className="flex flex-col gap-3">
    <p className="text-muted-foreground">Signing in to a new account of {agent.name}: sign in in your browser, which opens (check the account it signs in to
      there; its address is under Details if it did not open). The account is {project ? 'added' : 'kept'} once you are signed in.</p>
    <Collapsible open={details} onOpenChange={setDetails}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm"><ChevronRightIcon className={details ? 'rotate-90' : undefined} />Details</Button>
      </CollapsibleTrigger>
      <CollapsibleContent><div className="mt-1 overflow-hidden rounded-lg border p-2"><Terminal terminal={key} className="h-40" /></div></CollapsibleContent>
    </Collapsible>
    {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription>
      <AlertAction><Button type="button" variant="outline" size="sm" onClick={again}>Try Again</Button></AlertAction></Alert>}
    {running && <div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner role={undefined} aria-hidden />Waiting for the sign-in…</div>}
    <div className="flex gap-2">
      {!running && !error && <Button type="button" variant="outline" onClick={again}>Try Again</Button>}
      <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
    </div>
  </div>;
}
