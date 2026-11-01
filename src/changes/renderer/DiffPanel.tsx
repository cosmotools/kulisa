// The review renderer loads only while its document is mounted (../README.md).
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, Spinner } from '@ui';
import type { ChangeSelection } from '../ipc';
import { comparisonKey, type ChangesSession } from './session';

export type DiffPanelProps = { session: ChangesSession; selection: ChangeSelection; shade: 'dark' | 'light'; fontSize: number };
export function DiffPanel(props: DiffPanelProps) {
  const { selection } = props;
  const [loaded, setLoaded] = useState<typeof import('./ReviewDocument') | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import('./ReviewDocument').then((module) => {
      if (active) setLoaded(module);
    }, (e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const Document = loaded?.default;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  return Document ? <Document key={comparisonKey(selection)} {...props} />
    : <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner />Loading review…</div>;
}
