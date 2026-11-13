// Built-in Stage pane registration and membership (../README.md, Pane registration).
import { createBrowserPane, type BrowserPaneHost } from '../../browser-pane/renderer';
import { createTerminalPane, type TerminalPaneHost } from '../../terminal-pane/renderer';
import { store, act, taskIdentity } from './state';
import { PaneFocus, paneFocusItem } from './PaneFocus';
import type { LauncherMode, StagePaneKind } from '../../shared/stage-pane';

const host = { task: taskIdentity, facts: store, act, controls: { Focus: PaneFocus, focusItem: paneFocusItem } } satisfies BrowserPaneHost;
export const browserPanes = createBrowserPane(host);
const terminalPane = createTerminalPane({ ...host, hasAgent: () => store.getState().developmentTerminals.list.some((t) => !!t.agent && !t.starting) } satisfies TerminalPaneHost);

export const stagePaneKinds: readonly StagePaneKind[] = [browserPanes.definition, terminalPane];
for (const field of ['kind', 'component'] as const) {
  const values = stagePaneKinds.map((definition) => definition[field]);
  if (values.some((value) => !value) || new Set(values).size !== values.length) throw new Error(`Duplicate or empty Stage pane ${field}`);
}
export function stagePanes() {
  const ids = new Set<string>();
  return stagePaneKinds.flatMap((definition) => definition.panes().map((pane) => {
    if (!pane.id || ids.has(pane.id)) throw new Error(`Duplicate or empty Stage pane ID: ${pane.id}`);
    ids.add(pane.id);
    return { ...pane, component: definition.component, tabComponent: definition.component };
  }));
}
export function stagePanesChanged(a: ReturnType<typeof stagePanes>, b: ReturnType<typeof stagePanes>) {
  return a.length !== b.length || a.some((pane, i) => pane.id !== b[i]!.id || pane.title !== b[i]!.title || pane.component !== b[i]!.component);
}
export const stageComponents = Object.fromEntries(stagePaneKinds.map((definition) => [definition.component, definition.pane]));
export const stageHeaders = Object.fromEntries(stagePaneKinds.map((definition) => [definition.component, definition.header]));
const launchers = [...stagePaneKinds].sort((a, b) => a.launcherOrder - b.launcherOrder);
export function StagePaneLaunchers({ mode }: { mode: LauncherMode }) {
  return launchers.map(({ kind, Launchers }) => <Launchers key={kind} mode={mode} />);
}
export const hasStagePanes = () => stagePanes().length > 0;
