// The empty window (docs/tasks.md, The empty window): no task open. With no project at all, the welcome (Welcome.tsx);
// else the sidebar docked, every project with its tasks, and in the grid's place what to do.
import { Divider, Text } from '@fluentui/react-components';
import { DockedSidebar } from './Sidebar';
import { Welcome } from './Welcome';
import { useWindow, pageOf } from '../lib/store';

export function Empty() {
  const page = useWindow(pageOf);
  return <div id="empty" data-page={page} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--colorNeutralBackground1)' }}>
    <Divider style={{ flex: 'none' }} />
    <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
      {page === 'welcome' ? <Welcome /> : <>
        <DockedSidebar />
        <section aria-label="No task open" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
          <Text size={400} weight="semibold">No task open</Text>
          <Text style={{ color: 'var(--colorNeutralForeground3)' }}>Choose a task on the left, or make a new one with + next to its project, or a new project below them.</Text>
        </section>
      </>}
    </div>
  </div>;
}
