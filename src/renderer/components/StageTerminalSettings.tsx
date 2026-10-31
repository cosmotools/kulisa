// A Stage terminal's saved configuration (docs/window.md, Stage terminals).
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldDescription, FieldError, FieldLabel, Input } from '@ui';
import { registerDialog } from '../lib/dialogs';
import { store } from '../lib/store';
import type { StageTerminal } from '../../shared/stage-terminal';

function Configuration({ app, task, close }: { app: StageTerminal; task: string | null; close: () => void }) {
  const [name, setName] = useState(app.name), [command, setCommand] = useState(app.command);
  const [cols, setCols] = useState(String(app.size?.cols ?? '')), [rows, setRows] = useState(String(app.size?.rows ?? ''));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await kulisa.invoke('stage-terminal:configure', {
        task, id: app.id, name, command,
        size: cols || rows ? { cols: Number(cols), rows: Number(rows) } : null,
      });
      if (result.error) setError(result.error); else close();
    } finally { setSaving(false); }
  };
  return <form onSubmit={save} className="grid gap-4">
    <DialogHeader><DialogTitle>Terminal Settings</DialogTitle></DialogHeader>
    <div className="grid max-h-[55vh] gap-4 overflow-y-auto">
      <Field>
        <FieldLabel htmlFor="stage-terminal-name">Name</FieldLabel>
        <Input id="stage-terminal-name" value={name} required onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="stage-terminal-command">Launch command</FieldLabel>
        <Input id="stage-terminal-command" spellCheck={false} value={command} placeholder="Your shell (default)" onChange={(e) => setCommand(e.target.value)} />
        <FieldDescription>Used by the run button. Leave empty to open your shell.</FieldDescription>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="stage-terminal-cols">Columns</FieldLabel>
          <Input id="stage-terminal-cols" type="number" min={2} max={500} value={cols} placeholder="Auto" required={!!rows} onChange={(e) => setCols(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="stage-terminal-rows">Rows</FieldLabel>
          <Input id="stage-terminal-rows" type="number" min={2} max={200} value={rows} placeholder="Auto" required={!!cols} onChange={(e) => setRows(e.target.value)} />
        </Field>
      </div>
      <FieldDescription>Leave both dimensions empty to fit the pane.</FieldDescription>
      {error && <FieldError><span data-selectable>{error}</span></FieldError>}
    </div>
    <DialogFooter>
      <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
      <Button type="submit" disabled={saving}>Save</Button>
    </DialogFooter>
  </form>;
}

export function StageTerminalSettings() {
  const [editing, setEditing] = useState<{ app: StageTerminal; task: string | null } | null>(null);
  useEffect(() => registerDialog('stageTerminalSettings', {
    open(app) { setEditing({ app, task: store.getState().current }); },
  }), []);
  return <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
    <DialogContent aria-describedby={undefined}>
      {editing && <Configuration app={editing.app} task={editing.task} close={() => setEditing(null)} />}
    </DialogContent>
  </Dialog>;
}
