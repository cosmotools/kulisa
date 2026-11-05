// Connect a CLI without copying its configuration (docs/tasks.md, Accounts). Shared by onboarding and Settings;
// the native sign-in component owns cancellation, while successfully connected accounts belong to the global store.
import { useState } from 'react';
import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Spinner } from '@ui';
import { useExistingSetup } from '../lib/agent-setup';
import { SignIn } from './SignIn';
import { refused } from '../../shared/result';
import type { AgentInfo, AccountsInfo, SignedIn } from '../../shared/types';

export function AgentSetup({ agent, disabled, signing, onSigning, onDone, onConnecting }: {
  agent: AgentInfo; disabled?: boolean; signing: boolean; onSigning: (on: boolean) => void;
  onDone: (result: SignedIn | (AccountsInfo & { connected: string })) => void; onConnecting?: (on: boolean) => void;
}) {
  const { setup, checking, error: detectionError, refresh } = useExistingSetup(agent);
  const [connecting, setConnecting] = useState(false), [error, setError] = useState('');
  async function connect() {
    setConnecting(true); onConnecting?.(true); setError('');
    try {
      const r = await kulisa.invoke('account:connect-existing', { agent: agent.id });
      if (refused(r)) { setError(r.error); return; }
      onDone(r);
    } catch (e) { setError(String(e)); }
    finally { setConnecting(false); onConnecting?.(false); }
  }
  if (signing) return <SignIn agent={agent} onDone={(r) => { onDone(r); onSigning(false); }} onClose={() => onSigning(false)} />;
  if (!agent.installed) return null;
  return <div className="flex flex-col gap-3">
    {checking ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner />Checking your existing setup…</p>
      : setup && <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{setup.email ? `Signed in as ${setup.email}` : 'A signed-in setup is available on this computer.'}</p>
        <p data-selectable className="font-mono break-all">{setup.directory}</p>
        <p>Uses this configuration directly. Login, settings and skills are shared with your other CLI sessions.</p>
      </div>}
    <div className="flex flex-wrap items-center gap-2">
      {setup && <Button type="button" disabled={disabled || connecting || checking} onClick={() => void connect()}>{connecting && <Spinner />}Use existing setup</Button>}
      <Button type="button" variant="outline" disabled={disabled || connecting} onClick={() => onSigning(true)}>{setup ? 'Create separate setup' : 'Connect'}</Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Check ${agent.name} setup again`} disabled={disabled || connecting || checking} onClick={refresh}><RefreshCwIcon /></Button>
    </div>
    <p className="text-xs text-muted-foreground">{setup ? 'A separate setup' : 'Connect'} starts with an empty configuration in Kulisa and opens your browser to sign in.</p>
    {(error || detectionError) && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error || detectionError}</span></AlertDescription></Alert>}
  </div>;
}
