// The window's dialogs, opened from anywhere by name: dialog('newproject').then((d) => d.open()). Each is in
// App.tsx from the start and registers what it does once mounted (registerDialog). Not loaded when first opened: the
// window's code is one bundle read from disk, a dialog's part of it a few KB.

import type { Terminal } from '../../shared/types';

interface Dialogs {
  taskrename: { rename(key: string, name: string): void };
  // New Project (components/NewProject.tsx).
  newproject: { open(): Promise<void> };
  shortcuts: { showShortcuts(): void };
  // Change Agent (components/HandOver.tsx): an agent's tab handed over.
  handover: { open(t: Terminal): Promise<void> };
}
type Name = keyof Dialogs;

const registered = new Map<Name, PromiseWithResolvers<unknown>>();
const entry = (name: Name) => registered.get(name) ?? registered.set(name, Promise.withResolvers()).get(name)!;
export function registerDialog<N extends Name>(name: N, api: Dialogs[N]) { entry(name).resolve(api); }
export const dialog = <N extends Name>(name: N) => entry(name).promise as Promise<Dialogs[N]>;
