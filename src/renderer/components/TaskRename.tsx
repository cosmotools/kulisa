// Rename… a task (docs/tasks.md, Tasks), a tab's menu or a double click on it. The main process's refusal is shown at
// the field until the name is changed.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, makeStyles } from '@fluentui/react-components';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';
import { refused } from '../../shared/result';

const useStyles = makeStyles({ surface: { maxWidth: '440px' } });

export function TaskRename() {
  const styles = useStyles();
  const { open, setOpen } = useCovered('hide');
  const [key, setKey] = useState(''), [name, setName] = useState(''), [error, setError] = useState('');
  useEffect(() => registerDialog('taskrename', { rename(k, current) { setKey(k); setName(current); setError(''); setOpen(true); } }), [setOpen]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await kulisa.invoke('task:rename', { key, name });
    if (refused(r)) setError(r.error); else setOpen(false);
  };
  return <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
    <DialogSurface className={styles.surface}>
      <form onSubmit={save}>
        <DialogBody>
          <DialogTitle>Rename Task</DialogTitle>
          <DialogContent>
            <Field label="Name" validationMessage={error || undefined} hint="What the task is about. Its git branch takes it too (fix-header); its folder stays. The agent names it as well, once it knows.">
              <Input autoFocus value={name} maxLength={64} placeholder="e.g. Fix header" spellCheck={false}
                onFocus={(e) => e.currentTarget.select()} onChange={(_, d) => { setName(d.value); setError(''); }} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" appearance="primary">Rename</Button>
          </DialogActions>
        </DialogBody>
      </form>
    </DialogSurface>
  </Dialog>;
}
