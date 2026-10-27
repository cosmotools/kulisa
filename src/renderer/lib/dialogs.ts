// The window's dialogs, opened from anywhere by name: dialog('newproject').then((d) => d.open()). Each is in
// App.tsx from the start and registers what it does once mounted (registerDialog). Not loaded when first opened, as
// the window's scripts were before Vite: the window's code is one bundle read from disk, a dialog's part of it a few
// KB.

import type { Terminal } from '../../shared/types';

export interface Dialogs {
  taskrename: { rename(key: string, name: string): void };
  // New Project (components/NewProject.tsx).
  newproject: { open(): Promise<void> };
  shortcuts: { showShortcuts(): void };
  // Change Agent (components/HandOver.tsx): an agent's tab handed over.
  handover: { open(t: Terminal): Promise<void> };
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
