// A question before something that cannot be undone, before closing, or between two ways (docs/ui.md, Dialogs), on
// shadcn's AlertDialog: Cancel has the keyboard, Esc is Cancel, a click outside does nothing. Questions asked while one
// is open wait their turn (lib/ask.ts); the main process's (shell.ask) are asked here and answered back.
import { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button } from '@ui';
import { useAsking } from '../lib/ask';
import type { Question } from '../../shared/types';

export function Ask() {
  const a = useAsking();
  // The question last asked, kept while its dialog fades out.
  const [shown, setShown] = useState<Question | null>(null);
  if (a && shown !== a.q) setShown(a.q);
  const q = a?.q ?? shown;
  const answer = (value: string) => a?.answer(value);
  // Cancel and Esc close it through onOpenChange; the other buttons answer themselves.
  return <AlertDialog open={!!a} onOpenChange={(open) => { if (!open) answer(''); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{q?.message}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div>
            {q?.detail && <span data-selectable className="block whitespace-pre-line">{q.detail}</span>}
            {q?.link && <a href={q.link.url} target="_blank" rel="noreferrer" className="mt-2 block w-fit">{q.link.label}</a>}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{q?.cancel || 'Cancel'}</AlertDialogCancel>
        {q?.other && <Button variant="outline" onClick={() => answer('other')}>{q.other}</Button>}
        <Button variant={q?.danger ? 'destructive' : 'default'} onClick={() => answer('ok')}>{q?.ok || 'OK'}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
