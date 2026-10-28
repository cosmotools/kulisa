// A new account of an agent, signed in with the agent's own sign-in, started as it is shown (docs/tasks.md, Accounts):
// in a project (project) or in none. Its terminal is under Details: the address it prints, with the sign-in page open
// in the browser, only confuses; it is there for a failure (opened by itself then) and for what the browser does not
// show (a code the agent asks for). Gone (Cancel, its page left), the sign-in is cancelled.
import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@ui';
import { forgetTerminals } from '../../terminal/renderer';
import { Terminal } from './Terminal';
import type { SignedIn as Answer } from '../../shared/types';
import { ErrorBar } from './ErrorBar';
import { Working } from './Working';
import { Details } from './Details';

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
    <Details open={details} onOpenChange={setDetails}><Terminal terminal={key} className="h-40" /></Details>
    {error && <ErrorBar actions={<Button type="button" variant="outline" size="sm" onClick={again}>Try Again</Button>}>{error}</ErrorBar>}
    {running && <Working>Waiting for the sign-in…</Working>}
    <div className="flex gap-2">
      {!running && !error && <Button type="button" variant="outline" onClick={again}>Try Again</Button>}
      <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
    </div>
  </div>;
}
