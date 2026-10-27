// The empty window (docs/tasks.md, The empty window): no task open. With no project at all, the welcome (Welcome.tsx);
// else the sidebar docked, every project with its tasks, and in the grid's place what to do.
import { Divider, Text, makeStyles, tokens } from '@fluentui/react-components';
import { DockedSidebar } from './Sidebar';
import { Welcome } from './Welcome';
import { useWindow, pageOf } from '../lib/store';
import { useCommonStyles } from './theme';

const useStyles = makeStyles({
  empty: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: tokens.colorNeutralBackground1 },
  line: { flex: 'none' },
  body: { flex: 1, display: 'flex', minWidth: 0, minHeight: 0 },
  none: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL, textAlign: 'center' },
});

export function Empty() {
  const page = useWindow(pageOf), styles = useStyles(), common = useCommonStyles();
  return <div id="empty" data-page={page} className={styles.empty}>
    <Divider className={styles.line} />
    <div className={styles.body}>
      {page === 'welcome' ? <Welcome /> : <>
        <DockedSidebar />
        <section aria-label="No task open" className={styles.none}>
          <Text size={400} weight="semibold">No task open</Text>
          <Text className={common.muted}>Choose a task on the left, or make a new one with + next to its project, or a new project below them.</Text>
        </section>
      </>}
    </div>
  </div>;
}
