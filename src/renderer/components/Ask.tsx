// A question before something that cannot be undone, before closing, or between two ways (docs/ui.md, Dialogs), on
// Fluent UI's alert Dialog: Cancel has the keyboard, Esc is Cancel, a click outside does nothing. Questions asked while
// one is open wait their turn; the main process's (shell.ask) are asked here and answered back.
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Link, tokens } from '@fluentui/react-components';
import { useAsking } from '../lib/ask';
import { layer } from '../lib/cover';
import type { Question } from '../../shared/types';

export function Ask() {
  const a = useAsking();
  const [shown, setShown] = useState<Question | null>(null);
  if (a && shown !== a.q) setShown(a.q);
  const answer = (value: string) => a?.answer(value);
  const q = a?.q ?? shown;
  // A dialog over the window (what is under it hidden: lib/cover.ts); Esc is Cancel: Fluent's alert dialog takes no Esc.
  useEffect(() => {
    if (!a) return;
    const cancel = () => a.answer('');
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
    addEventListener('keydown', esc, true);
    layer('hide', true, cancel, () => {});
    return () => { removeEventListener('keydown', esc, true); layer('hide', false, cancel, () => {}); };
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
          <Button appearance="primary" style={q?.danger ? { background: tokens.colorStatusDangerBackground3, color: tokens.colorNeutralForegroundStaticInverted } : undefined} onClick={() => answer('ok')}>{q?.ok || 'OK'}</Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
