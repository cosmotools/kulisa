// Task ownership and IPC supplied to the Diffs Kulisa package (src/diffs/README.md).
import { createDiffs } from '../../diffs/renderer';
import { store } from './store';
import { selectDevelopmentFile, showDevelopmentDiff } from './grid';
import { menuAt } from './menu';

let current: { task: string; session: ReturnType<typeof createDiffs> } | null = null;
export function diffsFor(task: string) {
  if (current?.task !== task) current = { task, session: createDiffs({
    list: (folder, options) => kulisa.invoke('task:diffs:list', { key: task, folder, options }),
    targets: (folder) => kulisa.invoke('task:diffs:targets', { key: task, folder }),
    review: (folder, options, load) => kulisa.invoke('task:diffs:review', { key: task, folder, options, load }),
    contents: (folder, path, options) => kulisa.invoke('task:diffs:contents', { key: task, folder, path, options }),
    select: (selection) => showDevelopmentDiff({ ...selection, task }),
    selectFile: (path, navigation) => {
      if (store.getState().current === task) selectDevelopmentFile(path, navigation);
    },
    showMenu: menuAt,
  }) };
  return current.session;
}
store.subscribe((next, previous) => { if (next.current !== previous.current) current = null; });
