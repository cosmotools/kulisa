// One task UI's lifetime, presentation and native geometry contracts (README.md).
type I<A extends unknown[], R = void> = { args: A; result: R };
export type PageLayout = Partial<{ x: number; y: number; width: number; height: number }> & { shown?: boolean; clip?: { x: number; y: number; width: number; height: number } };
type Grid = Record<string, PageLayout>;
export type StagePosition = 'left' | 'right' | 'above';
export type StageLayout = 'vertical' | 'tabs' | 'horizontal';
export interface TaskPresentation {
  workbenchItem: 'terminals' | 'project' | 'diff' | 'artifacts'; selectedArtifact: string | null;
  stagePosition: StagePosition; stageLayout: StageLayout | null; stageOverflow: boolean; stageFollowPaused: boolean;
}
export interface TaskViewport { revision: number; width: number; height: number; zoom: number }
export interface TaskViewInvoke {
  'task:ready': I<[]>;
  'task:drained': I<[number]>;
  'task:view-failed': I<[{ task: string; kind: string; frames: string[] }]>;
  'views:pictures': I<[], Record<string, string> | undefined>;
  'views:hidden': I<[hidden: boolean, opts?: { focus?: boolean; task?: string }]>;
}
export interface TaskViewSend {
  'layout:apply': { task: string | null; rects: Grid; revision: number; viewport: { width: number; height: number } };
  'task:presentation': TaskPresentation;
  'layout:save': { task: string | null; layout: unknown };
}
export interface TaskViewEvents {
  'task:initial': TaskPresentation;
  'task:viewport': TaskViewport;
  'task:activity': { active: boolean; covered: boolean };
  'task:dismiss': void;
  'task:drain': number;
  'task:command': { command: 'profile:show' | 'terminal:open'; profile?: string };
}
