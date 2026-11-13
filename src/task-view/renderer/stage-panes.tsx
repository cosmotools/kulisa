// Built-in Stage pane registration and membership (../README.md, Pane registration).
import { browserPane } from './browser-pane';
import { terminalPane } from './terminal-pane';
import type { TaskState } from './state';
import type { LauncherMode, StagePaneKind } from './pane-contract';

export const stagePaneKinds: readonly StagePaneKind[] = [browserPane, terminalPane];
for (const field of ['kind', 'component'] as const) {
  const values = stagePaneKinds.map((definition) => definition[field]);
  if (values.some((value) => !value) || new Set(values).size !== values.length) throw new Error(`Duplicate or empty Stage pane ${field}`);
}
export function stagePanes(state: TaskState) {
  const ids = new Set<string>();
  return stagePaneKinds.flatMap((definition) => definition.panes(state).map((pane) => {
    if (!pane.id || ids.has(pane.id)) throw new Error(`Duplicate or empty Stage pane ID: ${pane.id}`);
    ids.add(pane.id);
    return { ...pane, component: definition.component, tabComponent: definition.component };
  }));
}
export function stagePanesChanged(next: TaskState, previous: TaskState) {
  const a = stagePanes(next), b = stagePanes(previous);
  return a.length !== b.length || a.some((pane, i) => pane.id !== b[i]!.id || pane.title !== b[i]!.title || pane.component !== b[i]!.component);
}
export const stageComponents = Object.fromEntries(stagePaneKinds.map((definition) => [definition.component, definition.pane]));
export const stageHeaders = Object.fromEntries(stagePaneKinds.map((definition) => [definition.component, definition.header]));
const launchers = [...stagePaneKinds].sort((a, b) => a.launcherOrder - b.launcherOrder);
export function StagePaneLaunchers({ mode }: { mode: LauncherMode }) {
  return launchers.map(({ kind, Launchers }) => <Launchers key={kind} mode={mode} />);
}
export const hasStagePanes = (state: TaskState) => stagePanes(state).length > 0;
