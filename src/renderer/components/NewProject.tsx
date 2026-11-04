// New Project's dialog (docs/tasks.md, Projects). The shared flow owns the form; this wrapper owns opening and closing.
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui';
import { ProjectFlow } from './new-project/ProjectFlow';
import { projectDraft, type ProjectDraft } from '../lib/new-project';
import { registerDialog } from '../lib/dialogs';

export function NewProject() {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<ProjectDraft | null>(null);
  useEffect(() => { registerDialog('newproject', { open: async () => { setDraft(projectDraft()); setOpen(true); } }); }, []);
  const close = () => { if (!draft?.store.getState().saving && !draft?.installs.store.getState().installing) setOpen(false); };
  return <Dialog open={open && !!draft} onOpenChange={(o) => { if (!o) close(); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
      <div className="flex h-[min(680px,78vh)] min-h-0 flex-col">{draft && <ProjectFlow draft={draft} done={() => setOpen(false)} />}</div>
    </DialogContent>
  </Dialog>;
}
