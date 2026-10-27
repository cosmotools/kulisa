// A question before something that cannot be undone, before closing, or between two ways (docs/ui.md, Dialogs), on
// Fluent UI's alert Dialog: Cancel has the keyboard, Esc is Cancel, a click outside does nothing. Questions asked while
// one is open wait their turn; the main process's (shell.ask) are asked here and answered back.
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, FluentProvider, Link } from '@fluentui/react-components';
import { useAsking } from '../lib/ask';
import { layer } from '../lib/cover';
import type { Question } from '../../shared/types';
import { danger } from './theme';
import common from './common.module.css';
import css from './Ask.module.css';

export function Ask() {
  const a = useAsking();
  const [shown, setShown] = useState<Question | null>(null);
  if (a && shown !== a.q) setShown(a.q);
  const answer = (value: string) => a?.answer(value);
  const q = a?.q ?? shown;
  // A dialog over the window (what is under it hidden: lib/cover.ts).
  useEffect(() => {
    if (!a) return;
    const cancel = () => a.answer('');
    layer('hide', true, cancel, () => {});
    return () => layer('hide', false, cancel, () => {});
  }, [a]);
  // Esc is Cancel: Fluent's onOpenChange, from a key in the dialog. A click on the backdrop (which an alert dialog
  // ignores) would move the keyboard to the page's body, where Esc reaches no dialog: it keeps the keyboard where it is.
  const ok = <Button appearance="primary" onClick={() => answer('ok')}>{q?.ok || 'OK'}</Button>;
  return <Dialog modalType="alert" open={!!a} onOpenChange={(_, d) => { if (!d.open) answer(''); }}>
    <DialogSurface aria-describedby="askdetail" backdrop={{ onMouseDown: (e) => e.preventDefault() }}>
      <DialogBody>
        <DialogTitle>{q?.message}</DialogTitle>
        <DialogContent id="askdetail">
          <div className={css.detail}>
            {q?.detail && <span className={common.selectable}>{q.detail}</span>}
            {q?.link && <Link href={q.link.url} target="_blank">{q.link.label}</Link>}
          </div>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => answer('')}>{q?.cancel || 'Cancel'}</Button>
          {q?.other && <Button onClick={() => answer('other')}>{q.other}</Button>}
          {q?.danger ? <FluentProvider theme={danger}>{ok}</FluentProvider> : ok}
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
