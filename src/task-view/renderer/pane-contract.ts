// Built-in pane capabilities supplied to the Stage host (../README.md, Pane registration).
import type { FunctionComponent } from 'react';
import type { DockviewApi, IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import type { TaskState } from './state';
import type { PaneHandle } from './pages';
import type { Events, PageLayout } from '../../shared/ipc';

export type LauncherMode = 'tile' | 'strip';
export interface PaneHost {
  show(panel: string): void;
  activity(task: string, panel: string): void;
}
interface PaneLayout {
  state: TaskState;
  api: DockviewApi | null;
  viewport: HTMLElement | null;
  panes: Map<string, PaneHandle>;
}
export interface StagePaneKind {
  kind: string;
  // Dockview persists this name independently of the pane kind's product name.
  component: string;
  panes(state: TaskState): readonly { id: string; title: string }[];
  pane: FunctionComponent<IDockviewPanelProps>;
  header: FunctionComponent<IDockviewPanelHeaderProps>;
  launcherOrder: number;
  Launchers: FunctionComponent<{ mode: LauncherMode }>;
  // Bound once per task page. Core owns the underlying processes and native views.
  bind?(host: PaneHost): void;
  command?(event: Events['task:command'], state: TaskState, host: PaneHost): boolean;
  layout?(context: PaneLayout): Record<string, PageLayout>;
}
