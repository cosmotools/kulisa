// Built-in scene membership and persisted panel identities (../README.md, Scene registration).
interface ScenePanel { id: string; title: string }
export interface SceneDefinition<State> {
  kind: string;
  // Dockview persists this name independently of the scene's product name.
  component: string;
  panels(state: State): readonly ScenePanel[];
}
export interface RegisteredScenePanel extends ScenePanel { component: string; tabComponent: string }

export class SceneRegistry<State, Definition extends SceneDefinition<State> = SceneDefinition<State>> {
  readonly definitions: readonly Definition[];
  constructor(definitions: readonly Definition[]) {
    const kinds = new Set<string>(), components = new Set<string>();
    for (const scene of definitions) {
      if (!scene.kind || kinds.has(scene.kind)) throw new Error(`Duplicate or empty scene kind: ${scene.kind}`);
      if (!scene.component || components.has(scene.component)) throw new Error(`Duplicate or empty scene component: ${scene.component}`);
      kinds.add(scene.kind); components.add(scene.component);
    }
    this.definitions = [...definitions];
  }
  panels(state: State): RegisteredScenePanel[] {
    const ids = new Set<string>();
    return this.definitions.flatMap((scene) => scene.panels(state).map((panel) => {
      if (!panel.id || ids.has(panel.id)) throw new Error(`Duplicate or empty scene panel: ${panel.id}`);
      ids.add(panel.id);
      return { ...panel, component: scene.component, tabComponent: scene.component };
    }));
  }
  changed(next: State, previous: State) {
    const a = this.panels(next), b = this.panels(previous);
    return a.length !== b.length || a.some((panel, i) => panel.id !== b[i]!.id || panel.title !== b[i]!.title || panel.component !== b[i]!.component);
  }
}
