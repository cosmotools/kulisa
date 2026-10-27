// A new account of an agent, signed in with the agent's own sign-in, started as it is shown (docs/tasks.md, Accounts):
// in a project (project) or in none. Its terminal is under Details: the address it prints, with the sign-in page open
// in the browser, only confuses; it is there for a failure (opened by itself then) and for what the browser does not
// show (a code the agent asks for). Gone (Cancel, its page left), the sign-in is cancelled.
import { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Text } from '@fluentui/react-components';
import { forgetTerminals } from '../../terminal/renderer';
import { Terminal } from './Terminal';
import type { SignedIn as Answer } from '../../shared/types';

let n = 0;
const fresh = () => `signin#${Date.now()}-${++n}`; // a sign-in's terminal: a new one for each try
export function SignIn({ agent, project, onDone, onClose }: { agent: { id: string; name: string }; project?: string; onDone: (r: Answer) => void; onClose: () => void }) {
  // key: its terminal, kept after its sign-in ends (a failure's Details show what the agent said); a new one on Try Again
  const [key, setKey] = useState(fresh), [running, setRunning] = useState(true);
  const [error, setError] = useState(''), [details, setDetails] = useState(false);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  // A sign-in, its terminal shown; cancelled when it goes (Cancel, its page left) while it runs, its terminal forgotten.
  useEffect(() => {
    let on = true;
    void kulisa.invoke('account:signin', { id: project ?? null, agent: agent.id, key }).then((r) => {
      if (!on) return;
      on = false;
      setRunning(false);
      if (r.error) { setError(r.error); setDetails(true); } else if (r.error === undefined) done.current(r);
    });
    return () => {
      if (on) { on = false; void kulisa.invoke('account:signin-cancel', { key }); }
      forgetTerminals([key]);
    };
  }, [key, agent.id, project]);

  return <div role="group" aria-label={`New account of ${agent.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Text size={200}>Signing in to a new account of {agent.name}: sign in in your browser, which opens (check the account it signs in to
      there; its address is under Details if it did not open). The account is {project ? 'added' : 'kept'} once you are signed in.</Text>
    <Accordion collapsible openItems={details ? ['details'] : []} onToggle={(_, d) => setDetails(d.openItems.includes('details'))}>
      <AccordionItem value="details">
        <AccordionHeader size="small">Details</AccordionHeader>
        <AccordionPanel>
          <Terminal terminal={key} background="colorNeutralBackground3"
            style={{ height: 160, boxSizing: 'border-box', padding: '4px 8px', border: '1px solid var(--colorNeutralStroke1)', borderRadius: 'var(--borderRadiusMedium)',
              background: 'var(--colorNeutralBackground3)', overflow: 'hidden' }} />
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
    {error && <Text role="alert" size={200} style={{ color: 'var(--colorPaletteRedForeground1)' }}>{error}</Text>}
    <div style={{ display: 'flex', gap: 8 }}>
      {!running && <Button onClick={() => { setKey(fresh()); setRunning(true); setError(''); setDetails(false); }}>Try Again</Button>}
      <Button onClick={onClose}>Cancel</Button>
    </div>
  </div>;
}
