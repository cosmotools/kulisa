// The window's dialogs, opened from anywhere by name: dialog('projects').then((d) => d.openProjects(id)). Each is in
// App.vue from the start and registers what it does once mounted (registerDialog). Not loaded when first opened, as
// the window's scripts were before Vite: the window's code is one bundle read from disk, a dialog's part of it a few
// KB.

export interface Dialogs {
  profiles: { manage(): void; about(key: string): void };
  taskrename: { rename(key: string, name: string): void };
  projects: { openProjects(id?: string): Promise<void>; newProject(): Promise<void> };
  agents: { showAgents(): Promise<void> };
  agentpick: { chooseAgent(q: { task: string; selected?: string; cancel?: boolean }): Promise<void> };
  shortcuts: { showShortcuts(): void };
}
type Name = keyof Dialogs;

const registered = new Map<Name, { api?: unknown; got?: (api: unknown) => void; ready: Promise<unknown> }>();
const entry = (name: Name) => {
  if (!registered.has(name)) {
    const e: { api?: unknown; got?: (api: unknown) => void; ready: Promise<unknown> } = { ready: Promise.resolve() };
    e.ready = new Promise((r) => (e.got = r));
    registered.set(name, e);
  }
  return registered.get(name)!;
};
export function registerDialog<N extends Name>(name: N, api: Dialogs[N]) { entry(name).got!(api); }
export const dialog = <N extends Name>(name: N) => entry(name).ready as Promise<Dialogs[N]>;
