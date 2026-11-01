// Task ownership and IPC supplied to the Changes Kulisa package (src/changes/README.md).
import { createChanges } from '../../changes/renderer';
import { store } from './store';
import { selectDevelopmentFile, showDevelopmentDiff } from './grid';
import { menuAt } from './menu';

let current: { task: string; session: ReturnType<typeof createChanges> } | null = null;
export function changesFor(task: string) {
  if (current?.task !== task) current = { task, session: createChanges({
    list: (folder, options) => kulisa.invoke('task:changes', { key: task, folder, options }),
    targets: (folder) => kulisa.invoke('task:change-targets', { key: task, folder }),
    review: (folder, options, load) => kulisa.invoke('task:review', { key: task, folder, options, load }),
    contents: (folder, path, options) => kulisa.invoke('task:diff-contents', { key: task, folder, path, options }),
    select: (selection) => showDevelopmentDiff({ ...selection, task }),
    selectFile: (path, navigation) => {
      if (store.getState().current === task) selectDevelopmentFile(path, navigation);
    },
    showMenu: menuAt,
  }) };
  return current.session;
}
store.subscribe((next, previous) => { if (next.current !== previous.current) current = null; });
