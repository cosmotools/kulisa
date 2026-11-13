// Stage's renderer integration boundary; pane packages own their UI (docs/packages.md).
import type { FunctionComponent } from 'react';
import type { StoreApi } from 'zustand';
import type { DockviewApi, IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import type { Events, PageLayout } from './ipc.ts';

// Packages can observe their facts without replacing or editing the task's store.
export type PaneFacts<State> = Pick<StoreApi<State>, 'getState' | 'getInitialState' | 'subscribe'>;
export type LauncherMode = 'tile' | 'strip';
export interface PaneControls {
  Focus: FunctionComponent<Pick<IDockviewPanelHeaderProps, 'api' | 'containerApi'>>;
  focusItem(api: IDockviewPanelHeaderProps['api']): { label: string; run(): void };
}
export interface PaneHost {
  show(panel: string): void;
  activity(task: string, panel: string): void;
  reportLayout(): void;
}
export interface StagePaneKind {
  kind: string;
  // Dockview persists this name independently of the pane kind's product name.
  component: string;
  panes(): readonly { id: string; title: string }[];
  pane: FunctionComponent<IDockviewPanelProps>;
  header: FunctionComponent<IDockviewPanelHeaderProps>;
  launcherOrder: number;
  Launchers: FunctionComponent<{ mode: LauncherMode }>;
  bind?(host: PaneHost): void;
  command?(event: Events['task:command']): boolean;
  layout?(context: { api: DockviewApi | null; viewport: HTMLElement | null }): Record<string, PageLayout>;
  dismiss?(): void;
  reset?(): void;
}
