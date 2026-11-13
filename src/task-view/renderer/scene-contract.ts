// Optional scene capabilities supplied to the common Stage host (../README.md, Scene registration).
import type { FunctionComponent } from 'react';
import type { DockviewApi, IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import type { SceneDefinition } from '../shared/scenes';
import type { TaskState } from './state';
import type { PaneHandle } from './pages';
import type { Events, PageLayout } from '../../shared/ipc';

export type LauncherMode = 'tile' | 'strip';
export interface SceneHost {
  show(panel: string): void;
  activity(task: string, panel: string): void;
}
interface SceneLayout {
  state: TaskState;
  api: DockviewApi | null;
  viewport: HTMLElement | null;
  panes: Map<string, PaneHandle>;
}
export interface StageScene extends SceneDefinition<TaskState> {
  pane: FunctionComponent<IDockviewPanelProps>;
  header: FunctionComponent<IDockviewPanelHeaderProps>;
  launcherOrder: number;
  Launchers: FunctionComponent<{ mode: LauncherMode }>;
  // Bound once per task page. These adapters never own environment processes or native views.
  bind?(host: SceneHost): void;
  command?(event: Events['task:command'], state: TaskState, host: SceneHost): boolean;
  layout?(context: SceneLayout): Record<string, PageLayout>;
}
