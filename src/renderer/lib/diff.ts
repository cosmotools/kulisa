// Task ownership and IPC supplied to the Diff Kulisa package (src/diff/README.md).
import { createDiff } from '../../diff/renderer';
import type { Diff } from '../../diff/ipc';
import { store } from './store';
import { selectDevelopmentFile, showDevelopmentDiff } from './grid';
import { menuAt } from './menu';

const summaries = new Map<string, (summary: Diff) => void>();
kulisa.on('task:diff:summary', ({ request, summary }) => summaries.get(request)?.(summary));

let current: { task: string; session: ReturnType<typeof createDiff> } | null = null;
export function diffFor(task: string) {
  if (current?.task !== task) current = { task, session: createDiff({
    list: (folder, options) => kulisa.invoke('task:diff:list', { key: task, folder, options }),
    targets: (folder) => kulisa.invoke('task:diff:targets', { key: task, folder }),
    review: (folder, options, load, onSummary) => {
      const request = crypto.randomUUID();
      summaries.set(request, onSummary);
      return kulisa.invoke('task:diff:review', { key: task, folder, options, load, request }).finally(() => summaries.delete(request));
    },
    contents: (folder, path, options) => kulisa.invoke('task:diff:contents', { key: task, folder, path, options }),
    select: (selection) => showDevelopmentDiff({ ...selection, task }),
    selectFile: (path, navigation) => {
      if (store.getState().current === task) selectDevelopmentFile(path, navigation);
    },
    showMenu: menuAt,
  }) };
  return current.session;
}
store.subscribe((next, previous) => { if (next.current !== previous.current) current = null; });
