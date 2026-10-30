// Rename… a task (docs/tasks.md, Tasks), a tab's menu or a double click on it. The main process's refusal is shown at
// the field until the name is changed.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldDescription, FieldError, FieldLabel, Input } from '@ui';
import { registerDialog } from '../lib/dialogs';
import { refused } from '../../shared/result';

export function TaskRename() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(''), [name, setName] = useState(''), [error, setError] = useState('');
  useEffect(() => registerDialog('taskrename', { rename(k, current) { setKey(k); setName(current); setError(''); setOpen(true); } }), []);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await kulisa.invoke('task:rename', { key, name });
    if (refused(r)) setError(r.error); else setOpen(false);
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent aria-describedby={undefined}>
      <form onSubmit={save} className="grid gap-4">
        <DialogHeader><DialogTitle>Rename Task</DialogTitle></DialogHeader>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="taskname">Name</FieldLabel>
          <Input id="taskname" autoFocus value={name} maxLength={64} placeholder="e.g. Fix header" spellCheck={false} aria-invalid={!!error || undefined}
            onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setName(e.target.value); setError(''); }} />
          <FieldDescription>What the task is about. Its git branch takes it too (fix-header); its folder stays. The agent names it as well, once it knows.</FieldDescription>
          {error && <FieldError><span data-selectable>{error}</span></FieldError>}
        </Field>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button type="submit">Rename</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
