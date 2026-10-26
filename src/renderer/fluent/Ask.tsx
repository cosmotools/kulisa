// A question before something that cannot be undone, before closing, or between two ways (docs/ui.md, Dialogs), on
// Fluent UI's alert Dialog: Cancel has the keyboard, Esc is Cancel, a click outside does nothing. Questions asked while
// one is open wait their turn; the main process's (shell.ask) are asked here and answered back.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Link } from '@fluentui/react-components';
import type { Question } from '../../shared/types';

let asking: { q: Question; answer: (value: string) => void } | null = null;
const listeners = new Set<() => void>();
const set = (a: typeof asking) => { asking = a; for (const l of listeners) l(); };
let turn: Promise<string> = Promise.resolve('');
function ask(q: Question): Promise<string> {
  const answer = turn.then(() => new Promise<string>((resolve) => set({ q, answer: resolve })));
  turn = answer;
  return answer;
}
kulisa.on('ask', async ({ id, ...q }) => kulisa.send('ask:answer', { id, answer: await ask(q) }));

export function Ask() {
  const a = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => asking);
  const [shown, setShown] = useState<Question | null>(null);
  if (a && shown !== a.q) setShown(a.q);
  const answer = (value: string) => { const now = asking; set(null); now?.answer(value); };
  const q = a?.q ?? shown;
  // Esc is Cancel: Fluent's alert dialog takes no Esc
  useEffect(() => {
    if (!a) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); answer(''); } };
    addEventListener('keydown', esc, true);
    return () => removeEventListener('keydown', esc, true);
  }, [a]);
  return <Dialog modalType="alert" open={!!a} onOpenChange={(_, d) => { if (!d.open) answer(''); }}>
    <DialogSurface aria-describedby="askdetail" style={{ maxWidth: 480 }}>
      <DialogBody>
        <DialogTitle>{q?.message}</DialogTitle>
        <DialogContent id="askdetail" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere', userSelect: 'text' }}>
          {q?.detail}
          {q?.link && <div style={{ marginTop: 8 }}><Link href={q.link.url} target="_blank">{q.link.label}</Link></div>}
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => answer('')}>{q?.cancel || 'Cancel'}</Button>
          {q?.other && <Button onClick={() => answer('other')}>{q.other}</Button>}
          <Button appearance="primary" style={q?.danger ? { background: '#dc2626', color: '#fff' } : undefined} onClick={() => answer('ok')}>{q?.ok || 'OK'}</Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
