// The empty window (docs/tasks.md, The empty window): no task open. With no project at all, the welcome (Welcome.tsx);
// else the sidebar docked, every project with its tasks, and in the grid's place what to do.
import { Empty as Nothing, EmptyDescription, EmptyHeader, EmptyTitle } from '@ui';
import { DockedSidebar } from './Sidebar';
import { Welcome } from './Welcome';
import { useWindow, pageOf } from '../lib/store';

export function Empty() {
  const page = useWindow(pageOf);
  return <div id="empty" data-page={page} className="flex min-h-0 min-w-0 border-t bg-card">
    {page === 'welcome' ? <Welcome /> : <>
      <DockedSidebar />
      <Nothing aria-label="No task open" role="region" className="flex-1">
        <EmptyHeader>
          <EmptyTitle>No task open</EmptyTitle>
          <EmptyDescription>Choose a task on the left, or make a new one with + next to its project, or a new project below them.</EmptyDescription>
        </EmptyHeader>
      </Nothing>
    </>}
  </div>;
}
