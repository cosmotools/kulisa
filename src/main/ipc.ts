// The main process's ends of the windows' channels, checked against their table (src/shared/ipc.ts; docs/window.md,
// IPC). The window's ends: renderer/env.d.ts.
import { ipcMain } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import type { Invoke, Send } from '../shared/ipc.ts';
import type { Shell } from './shell.ts';
import type { AppWindow, Asker } from './window.ts';
import type { OpenTasks } from './open-tasks.ts';

// An answer the window does not read (`void`) may be anything; one it reads is the table's.
type Answer<R> = [R] extends [void] ? unknown : R | Promise<R>;

export function handle<C extends keyof Invoke>(channel: C, fn: (e: IpcMainInvokeEvent, ...args: Invoke[C]['args']) => Answer<Invoke[C]['result']>) {
  ipcMain.handle(channel, fn as (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown);
}

export function on<C extends keyof Send>(channel: C, fn: (e: IpcMainEvent, arg: Send[C]) => void) {
  ipcMain.on(channel, fn);
}

export type IpcEvent = IpcMainEvent | IpcMainInvokeEvent;

// What the windows' handles (ipc/) get: the app, the tasks' window a message comes from (at) or is about (owner: for
// Settings, the tasks' window last in front), where its questions are asked (asker: its own window, Settings' too),
// the open tasks (open-tasks.ts) and their one-after-another.
export interface Ipc {
  shell: Shell;
  at: (e: IpcEvent) => AppWindow | null;
  owner: (e: IpcEvent) => AppWindow | null;
  asker: (e: IpcEvent) => Asker | null;
  tasks: OpenTasks;
  serial: OpenTasks['serial'];
}
