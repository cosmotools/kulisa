// The main process's ends of the windows' channels, checked against their table (src/shared/ipc.ts; docs/window.md,
// IPC). The window's ends: renderer/env.d.ts.
import { ipcMain } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import type { Invoke, Send } from '../shared/ipc.ts';

// An answer the window does not read (`void`) may be anything; one it reads is the table's.
type Answer<R> = [R] extends [void] ? unknown : R | Promise<R>;

export function handle<C extends keyof Invoke>(channel: C, fn: (e: IpcMainInvokeEvent, ...args: Invoke[C]['args']) => Answer<Invoke[C]['result']>) {
  ipcMain.handle(channel, fn as (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown);
}

export function on<C extends keyof Send>(channel: C, fn: (e: IpcMainEvent, arg: Send[C]) => void) {
  ipcMain.on(channel, fn);
}
