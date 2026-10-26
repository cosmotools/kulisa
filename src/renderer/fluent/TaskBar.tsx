// The tasks' bar (docs/tasks.md, The tasks' bar): the window's open tasks as tabs. The shell: their names.
import { Tab, TabList } from '@fluentui/react-components';
import { useWindow } from '../lib/store';

export function TaskBar() {
  const tabs = useWindow((s) => s.projects.tabs), current = useWindow((s) => s.current);
  return <TabList id="projectTabs" selectedValue={current ?? ''} onTabSelect={(_, d) => void kulisa.invoke('task:show', d.value as string)}>
    {tabs.map((t) => <Tab key={t.key} value={t.key} data-task={t.key} className="tasktab">{t.name}</Tab>)}
  </TabList>;
}
