// The empty window (docs/tasks.md, The empty window): no task open. With no project at all, the welcome (Welcome.tsx);
// else the sidebar docked, every project with its tasks, and in the grid's place what to do.
import { Divider, Text } from '@fluentui/react-components';
import { DockedSidebar } from './Sidebar';
import { Welcome } from './Welcome';
import { useWindow, pageOf } from '../lib/store';
import css from './Empty.module.css';

export function Empty() {
  const page = useWindow(pageOf);
  return <div id="empty" data-page={page} className={css.empty}>
    <div className={css.line}><Divider /></div>
    <div className={css.body}>
      {page === 'welcome' ? <Welcome /> : <>
        <DockedSidebar />
        <section aria-label="No task open" className={css.none}>
          <Text size={400} weight="semibold">No task open</Text>
          <Text>Choose a task on the left, or make a new one with + next to its project, or a new project below them.</Text>
        </section>
      </>}
    </div>
  </div>;
}
