// The built-in scene registration point; the host does not enumerate scene kinds (../README.md).
import { SceneRegistry } from '../shared/scenes';
import { browserScene } from './browser-scene';
import { terminalScene } from './terminal-scene';
import type { TaskState } from './state';
import type { LauncherMode, StageScene } from './scene-contract';

export const scenes = new SceneRegistry<TaskState, StageScene>([browserScene, terminalScene]);
export const stageComponents = Object.fromEntries(scenes.definitions.map((scene) => [scene.component, scene.pane]));
export const stageHeaders = Object.fromEntries(scenes.definitions.map((scene) => [scene.component, scene.header]));
const launchers = [...scenes.definitions].sort((a, b) => a.launcherOrder - b.launcherOrder);
export function SceneLaunchers({ mode }: { mode: LauncherMode }) {
  return launchers.map(({ kind, Launchers }) => <Launchers key={kind} mode={mode} />);
}
export const hasScenes = (state: TaskState) => scenes.panels(state).length > 0;
