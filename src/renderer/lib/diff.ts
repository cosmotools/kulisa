// Task ownership and IPC supplied to the Diff Kulisa package (src/diff/README.md).
import { createDiff } from '../../diff/renderer';
import { store, taskStore } from './store';
import { selectDevelopmentFile, showDevelopmentDiff } from './grid';
import { menuAt } from './menu';

const sessions = new Map<string, { session: ReturnType<typeof createDiff>; stop: () => void }>();
function release(task: string) {
  const entry = sessions.get(task);
  sessions.delete(task); entry?.stop(); entry?.session.client.clear();
}
export function diffFor(task: string) {
  if (!sessions.has(task)) {
    const stop = taskStore(task).subscribe((next, previous) => { if (previous.developmentDiff && !next.developmentDiff) release(task); });
    const session = createDiff({
      list: (folder, options) => kulisa.invoke('task:diff:list', { key: task, folder, options }),
      targets: (folder) => kulisa.invoke('task:diff:targets', { key: task, folder }),
      review: (folder, options, load) => kulisa.invoke('task:diff:review', { key: task, folder, options, load }),
      contents: (folder, path, options) => kulisa.invoke('task:diff:contents', { key: task, folder, path, options }),
      select: (selection) => showDevelopmentDiff({ ...selection, task }),
      selectFile: (path, navigation) => selectDevelopmentFile(task, path, navigation),
      showMenu: menuAt,
    });
    sessions.set(task, { session, stop });
  }
  return sessions.get(task)!.session;
}
store.subscribe((next, previous) => {
  if (next.tasks !== previous.tasks) for (const task of sessions.keys()) if (!next.tasks[task]) release(task);
});
